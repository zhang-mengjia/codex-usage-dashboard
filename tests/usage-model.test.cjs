const test = require("node:test");
const assert = require("node:assert/strict");
const { clampPercent, normalizeRateLimits } = require("../src/lib/usage-model.cjs");

const fixture = {
  rateLimits: {
    limitId: "codex",
    primary: { usedPercent: 18, windowDurationMins: 300, resetsAt: 1_783_666_676 },
    secondary: { usedPercent: 3, windowDurationMins: 10_080, resetsAt: 1_784_253_476 },
    credits: { hasCredits: false, unlimited: false, balance: "0" },
    planType: "plus",
    rateLimitReachedType: null,
  },
  rateLimitsByLimitId: {
    codex: {
      limitId: "codex",
      primary: { usedPercent: 18, windowDurationMins: 300, resetsAt: 1_783_666_676 },
      secondary: { usedPercent: 3, windowDurationMins: 10_080, resetsAt: 1_784_253_476 },
      credits: { hasCredits: false, unlimited: false, balance: "0" },
      planType: "plus",
      rateLimitReachedType: null,
    },
  },
  rateLimitResetCredits: {
    availableCount: 2,
    credits: [
      {
        id: "credit-1",
        status: "available",
        resetType: "codexRateLimits",
        title: "Full reset (Weekly + 5 hr)",
        expiresAt: 1_785_110_712,
      },
      {
        id: "credit-2",
        status: "available",
        title: "Full reset (Weekly + 5 hr)",
        expiresAt: 1_785_529_722,
      },
    ],
  },
};

test("normalizes the live Codex rate-limit payload", () => {
  const value = normalizeRateLimits(fixture, 1234);
  assert.equal(value.updatedAt, 1234);
  assert.equal(value.planType, "plus");
  assert.equal(value.primary.remainingPercent, 82);
  assert.equal(value.secondary.remainingPercent, 97);
  assert.equal(value.resetCredits.availableCount, 2);
  assert.equal(value.resetCredits.items[0].id, "credit-1");
  assert.equal(value.resetCredits.items[0].resetType, "codexRateLimits");
  assert.equal(value.resetCredits.detailsAvailable, true);
  assert.equal(value.credits.balance, "0");
});

test("keeps a missing reset-credit count unknown instead of inventing zero", () => {
  const value = normalizeRateLimits({ rateLimits: fixture.rateLimits });
  assert.equal(value.resetCredits.availableCount, null);
  assert.equal(value.resetCredits.items.length, 0);
  assert.equal(value.resetCredits.detailsAvailable, false);
});

test("clamps malformed percentages safely", () => {
  assert.equal(clampPercent(-3), 0);
  assert.equal(clampPercent(122), 100);
  assert.equal(clampPercent("51.7"), 52);
  assert.equal(clampPercent("unknown"), 0);
});

test("rejects payloads without a rate-limit snapshot", () => {
  assert.throws(() => normalizeRateLimits({}), /没有使用额度信息/);
});
