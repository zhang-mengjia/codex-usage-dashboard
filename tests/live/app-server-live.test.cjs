const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { CodexAppServerClient } = require("../../src/lib/codex-app-server.cjs");
const { CodexControlService } = require("../../src/lib/codex-control.cjs");
const { normalizeRateLimits } = require("../../src/lib/usage-model.cjs");

test("reads live account limits and individual reset credits", { timeout: 25_000 }, async (t) => {
  const sharedHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const dashboardHome = process.platform === "win32"
    ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "codex-usage-dashboard", "codex-home")
    : path.join(os.homedir(), "Library", "Application Support", "codex-usage-dashboard", "codex-home");
  const env = fs.existsSync(path.join(dashboardHome, "auth.json"))
    ? { ...process.env, CODEX_HOME: dashboardHome, CODEX_SQLITE_HOME: sharedHome }
    : process.env;
  const client = new CodexAppServerClient({ requestTimeoutMs: 20_000, env });
  t.after(() => client.stop());
  await client.start();

  const value = normalizeRateLimits(await client.readRateLimits());
  assert.equal(value.limitId, "codex");
  assert.equal(value.source, "codex-app-server");
  assert.ok(value.primary.remainingPercent >= 0 && value.primary.remainingPercent <= 100);
  assert.ok(value.secondary.remainingPercent >= 0 && value.secondary.remainingPercent <= 100);
  assert.ok(Number.isFinite(value.resetCredits.availableCount));
  assert.equal(value.resetCredits.detailsAvailable, true);
  assert.ok(value.resetCredits.items.length <= value.resetCredits.availableCount);

  const control = await new CodexControlService(client).refresh();
  assert.match(control.account.email, /^[^@\s]+@[^@\s]+$/);
  assert.ok(control.catalog.models.length > 0);
  assert.ok(control.catalog.permissions.length > 0);
  assert.ok(control.context.tokenUsage.contextWindow > 0);
});
