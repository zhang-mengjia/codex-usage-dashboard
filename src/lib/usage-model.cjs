function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function normalizeWindow(window, fallbackDurationMins) {
  if (!window) return null;
  const usedPercent = clampPercent(window.usedPercent);
  return {
    usedPercent,
    remainingPercent: 100 - usedPercent,
    windowDurationMins: Number(window.windowDurationMins) || fallbackDurationMins,
    resetsAt: Number(window.resetsAt) || null,
  };
}

function normalizeRateLimits(payload, now = Date.now()) {
  const snapshot = payload?.rateLimitsByLimitId?.codex || payload?.rateLimits;
  if (!snapshot) throw new Error("Codex 返回的数据中没有使用额度信息");
  const resetSummary = payload.rateLimitResetCredits || {};
  const hasResetCount = Object.prototype.hasOwnProperty.call(resetSummary, "availableCount")
    && Number.isFinite(Number(resetSummary.availableCount));
  const resetCredits = Array.isArray(resetSummary.credits)
    ? resetSummary.credits.map((credit) => ({
        id: String(credit.id || ""),
        title: credit.title || "Full reset (Weekly + 5 hr)",
        description: credit.description || "可重置本周与 5 小时使用额度",
        status: credit.status || "unknown",
        grantedAt: Number(credit.grantedAt) || null,
        expiresAt: Number(credit.expiresAt) || null,
      }))
    : [];

  return {
    source: payload.source || "codex-app-server",
    updatedAt: Number(payload.updatedAt) || now,
    limitId: snapshot.limitId || "codex",
    planType: snapshot.planType || "unknown",
    reachedType: snapshot.rateLimitReachedType || null,
    primary: normalizeWindow(snapshot.primary, 300),
    secondary: normalizeWindow(snapshot.secondary, 10_080),
    credits: {
      hasCredits: Boolean(snapshot.credits?.hasCredits),
      unlimited: Boolean(snapshot.credits?.unlimited),
      balance: snapshot.credits?.balance ?? null,
    },
    resetCredits: {
      availableCount: hasResetCount ? Math.max(0, Number(resetSummary.availableCount)) : null,
      items: resetCredits,
      source: resetSummary.source || null,
      updatedAt: Number(resetSummary.updatedAt) || null,
    },
  };
}

module.exports = { clampPercent, normalizeRateLimits, normalizeWindow };
