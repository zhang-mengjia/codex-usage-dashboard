function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function classifyLimitWindow(durationMins) {
  const duration = Number(durationMins);
  if (!Number.isFinite(duration) || duration <= 0) return "custom";
  if (Math.abs(duration - 300) <= 30) return "fiveHour";
  if (Math.abs(duration - 10_080) <= 120) return "weekly";
  return "custom";
}

function normalizeWindow(window, fallbackDurationMins = null, slot = null) {
  if (!window) return null;
  const usedPercent = clampPercent(window.usedPercent);
  const suppliedDuration = Number(window.windowDurationMins);
  const fallbackDuration = Number(fallbackDurationMins);
  const windowDurationMins = Number.isFinite(suppliedDuration) && suppliedDuration > 0
    ? suppliedDuration
    : Number.isFinite(fallbackDuration) && fallbackDuration > 0
      ? fallbackDuration
      : null;
  return {
    slot,
    kind: classifyLimitWindow(windowDurationMins),
    usedPercent,
    remainingPercent: 100 - usedPercent,
    windowDurationMins,
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
        title: credit.title || "Codex rate-limit reset",
        description: credit.description || "重置当前 Codex 使用额度",
        status: credit.status || "unknown",
        resetType: credit.resetType || "unknown",
        grantedAt: Number(credit.grantedAt) || null,
        expiresAt: Number(credit.expiresAt) || null,
      }))
    : [];

  // The API historically returned a five-hour primary window and a weekly
  // secondary window. It can now return only a weekly primary window, so the
  // duration—not the primary/secondary slot—is the source of truth.
  const primary = normalizeWindow(snapshot.primary, snapshot.secondary ? 300 : null, "primary");
  const secondary = normalizeWindow(snapshot.secondary, 10_080, "secondary");
  const limits = [primary, secondary]
    .filter(Boolean)
    .sort((left, right) => (left.windowDurationMins ?? Number.MAX_SAFE_INTEGER) - (right.windowDurationMins ?? Number.MAX_SAFE_INTEGER));

  return {
    source: payload.source || "codex-app-server",
    updatedAt: Number(payload.updatedAt) || now,
    limitId: snapshot.limitId || "codex",
    planType: snapshot.planType || "unknown",
    reachedType: snapshot.rateLimitReachedType || null,
    primary,
    secondary,
    limits,
    credits: {
      hasCredits: Boolean(snapshot.credits?.hasCredits),
      unlimited: Boolean(snapshot.credits?.unlimited),
      balance: snapshot.credits?.balance ?? null,
    },
    resetCredits: {
      availableCount: hasResetCount ? Math.max(0, Number(resetSummary.availableCount)) : null,
      items: resetCredits,
      detailsAvailable: Array.isArray(resetSummary.credits),
      source: resetSummary.source || null,
      updatedAt: Number(resetSummary.updatedAt) || null,
    },
  };
}

module.exports = { classifyLimitWindow, clampPercent, normalizeRateLimits, normalizeWindow };
