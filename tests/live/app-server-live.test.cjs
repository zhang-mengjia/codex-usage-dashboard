const test = require("node:test");
const assert = require("node:assert/strict");
const { CodexAppServerClient } = require("../../src/lib/codex-app-server.cjs");
const { CodexControlService, readCachedResetCredits, readLatestRateLimits } = require("../../src/lib/codex-control.cjs");
const { normalizeRateLimits } = require("../../src/lib/usage-model.cjs");

test("reads the currently signed-in Codex account rate limits", { timeout: 25_000 }, async (t) => {
  const client = new CodexAppServerClient({ requestTimeoutMs: 20_000 });
  t.after(() => client.stop());
  await client.start();
  const control = await new CodexControlService(client).refresh();
  let payload;
  try {
    payload = await client.readRateLimits();
  } catch {
    payload = readLatestRateLimits(control.context?.path);
    const resetCredits = readCachedResetCredits();
    if (payload && resetCredits) payload.rateLimitResetCredits = resetCredits;
  }
  const value = normalizeRateLimits(payload);
  assert.equal(value.limitId, "codex");
  assert.ok(value.primary.remainingPercent >= 0 && value.primary.remainingPercent <= 100);
  assert.ok(value.secondary.remainingPercent >= 0 && value.secondary.remainingPercent <= 100);
  assert.ok(Number.isFinite(value.resetCredits.availableCount));
  assert.match(control.account.email, /^[^@\s]+@[^@\s]+$/);
  assert.ok(control.catalog.models.length > 0);
  assert.ok(control.catalog.permissions.length > 0);
  assert.ok(control.context.tokenUsage.contextWindow > 0);
});
