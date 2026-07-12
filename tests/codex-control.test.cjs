const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { CodexControlService, readCachedResetCredits, readLatestRateLimits, readLatestTokenUsage } = require("../src/lib/codex-control.cjs");

test("reads the reset-credit count for the signed-in ChatGPT account", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-dashboard-reset-"));
  const previousHome = process.env.CODEX_HOME;
  const accountId = "account-under-test";
  const payload = Buffer.from(JSON.stringify({
    email: "person@example.com",
    "https://api.openai.com/auth": { chatgpt_account_id: accountId, chatgpt_plan_type: "plus" },
  })).toString("base64url");
  fs.writeFileSync(path.join(directory, "auth.json"), JSON.stringify({ tokens: { id_token: `e30.${payload}.signature` } }));
  fs.writeFileSync(path.join(directory, ".codex-global-state.json"), JSON.stringify({
    "electron-persisted-atom-state": {
      "rate-limit-reset-home-announcement-dismissal-by-account-id": {
        "another-account": { availableCount: 99 },
        [accountId]: { availableCount: 3 },
      },
    },
  }));
  process.env.CODEX_HOME = directory;
  try {
    const value = readCachedResetCredits();
    assert.equal(value.availableCount, 3);
    assert.equal(value.source, "chatgpt-desktop-cache");
    assert.ok(value.updatedAt > 0);
  } finally {
    if (previousHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousHome;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("reads the latest context token usage from a rollout tail", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-dashboard-context-"));
  const rollout = path.join(directory, "rollout.jsonl");
  fs.writeFileSync(
    rollout,
    [
      JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: { last_token_usage: { total_tokens: 100 }, model_context_window: 1000 } } }),
      JSON.stringify({ timestamp: "2026-07-10T00:00:00Z", type: "event_msg", payload: { type: "token_count", info: { last_token_usage: { input_tokens: 720, cached_input_tokens: 600, output_tokens: 30, reasoning_output_tokens: 10, total_tokens: 750 }, model_context_window: 1000 } } }),
    ].join("\n"),
  );
  const value = readLatestTokenUsage(rollout);
  assert.equal(value.usedTokens, 750);
  assert.equal(value.contextWindow, 1000);
  assert.equal(value.usedPercent, 75);
  assert.equal(value.cachedInputTokens, 600);
});

test("reads a rate-limit fallback from the latest rollout event", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-dashboard-limits-"));
  const rollout = path.join(directory, "rollout.jsonl");
  fs.writeFileSync(
    rollout,
    JSON.stringify({
      timestamp: "2026-07-10T00:00:00Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {},
        rate_limits: {
          limit_id: "codex",
          primary: { used_percent: 34, window_minutes: 300, resets_at: 1_783_666_675 },
          secondary: { used_percent: 18, window_minutes: 10_080, resets_at: 1_784_253_475 },
          credits: { has_credits: false, unlimited: false, balance: "0" },
          plan_type: "plus",
        },
      },
    }),
  );
  const value = readLatestRateLimits(rollout);
  assert.equal(value.source, "codex-session");
  assert.equal(value.rateLimits.primary.usedPercent, 34);
  assert.equal(value.rateLimits.secondary.windowDurationMins, 10_080);
  assert.equal(value.rateLimits.planType, "plus");
});

test("routes every dashboard control through the Codex app-server protocol", async () => {
  const calls = [];
  const client = {
    start: async () => {},
    request: async (method, params) => {
      calls.push({ method, params });
      if (method === "account/read") return { account: { type: "chatgpt", email: "person@example.com", planType: "plus" } };
      if (method === "model/list") return { data: [{ id: "model-a", model: "model-a", displayName: "Model A", supportedReasoningEfforts: [{ reasoningEffort: "high" }], serviceTiers: [{ id: "priority", name: "Fast" }] }] };
      if (method === "config/read") return { config: { model: "model-a", model_reasoning_effort: "high", service_tier: "default" } };
      if (method === "collaborationMode/list") return { data: [{ mode: "default", model: "model-a", reasoning_effort: "high" }, { mode: "plan", model: "model-a", reasoning_effort: "high" }] };
      if (method === "thread/list") return { data: [{ id: "thread-a", name: "Test", cwd: "D:\\work", updatedAt: 1 }] };
      if (method === "thread/resume") return { model: "model-a", reasoningEffort: "high", serviceTier: "default", activePermissionProfile: { id: ":workspace" }, approvalPolicy: "on-request", sandbox: { type: "workspaceWrite" } };
      if (method === "thread/goal/get") return { goal: null };
      if (method === "permissionProfile/list") return { data: [{ id: ":workspace", allowed: true }, { id: ":read-only", allowed: true }] };
      return {};
    },
  };
  const service = new CodexControlService(client);
  await service.refresh();
  await service.updateSetting("model", "model-a");
  await service.updateSetting("reasoningEffort", "high");
  await service.updateSetting("serviceTier", "priority");
  await service.updateSetting("permission", ":read-only");
  await service.updateSetting("planMode", "plan");
  await service.compactSelectedThread();
  await service.setGoal(true, "Test goal");
  await service.setGoal(false, "");

  const hasCall = (method, predicate = () => true) => calls.some((call) => call.method === method && predicate(call.params || {}));
  assert.ok(hasCall("config/value/write", (params) => params.keyPath === "model"));
  assert.ok(hasCall("thread/settings/update", (params) => params.effort === "high"));
  assert.ok(hasCall("thread/settings/update", (params) => params.serviceTier === "priority"));
  assert.ok(hasCall("thread/settings/update", (params) => params.permissions === ":read-only"));
  assert.ok(hasCall("thread/settings/update", (params) => params.collaborationMode?.mode === "plan"));
  assert.ok(hasCall("thread/compact/start", (params) => params.threadId === "thread-a"));
  assert.ok(hasCall("thread/goal/set", (params) => params.objective === "Test goal"));
  assert.ok(hasCall("thread/goal/clear", (params) => params.threadId === "thread-a"));
});
