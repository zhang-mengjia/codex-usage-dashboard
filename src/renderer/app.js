(function () {
  const query = new URLSearchParams(window.location.search);
  const isBall = query.get("view") === "ball";
  document.body.dataset.view = isBall ? "ball" : "dashboard";
  document.getElementById("dashboard").hidden = isBall;
  document.getElementById("floating-ball").hidden = !isBall;

  const messages = {
    "zh-CN": {
      appTitle: "ChatGPT 控制台", loadingAccount: "正在读取账户…", connecting: "正在连接 Codex…",
      refreshAll: "刷新全部信息", minimize: "最小化", pinWindow: "置顶显示", floatingBall: "切换悬浮球", maximizeWindow: "全屏/恢复窗口", hideTray: "隐藏到托盘", hideMenuBar: "隐藏到菜单栏",
      openChatGpt: "打开 ChatGPT", openHost: "打开 {app}", usageTitle: "Codex 使用额度", usageSubtitle: "与当前 ChatGPT 账户共享", fiveHourLimit: "5 小时使用限制", weeklyLimit: "每周使用限额",
      waitingData: "等待数据", loadingResets: "正在读取重置额度…", contextTitle: "对话上下文", contextSubtitle: "选择最近对话并查看上下文占用", compact: "一键压缩",
      currentThread: "当前对话", loadingThreads: "正在读取最近对话…", noThread: "尚未选择对话", usedContext: "已用上下文", contextWindow: "上下文窗口", cachedInput: "缓存输入",
      runtimeTitle: "运行配置", runtimeSubtitle: "同步到所选对话，并保存为全局默认", scopeBadge: "当前对话 + 默认", model: "模型", reasoning: "推理强度", power: "能力强度", speed: "速度", permission: "权限",
      workModes: "工作模式", modesSubtitle: "对当前选择的对话立即生效", planMode: "计划模式", planDesc: "先澄清与规划，再进入执行", goalMode: "目标模式", goalDesc: "为当前对话设置持续目标",
      goalPlaceholder: "输入目标内容；启用时将作为当前对话目标", settingsEffect: "设置切换将在当前对话的下一次发送时生效", refresh: "刷新", dragBall: "拖动悬浮球", openConsole: "打开 ChatGPT 控制台", fiveHourRemaining: "5h 剩余",
      surfaceCodexCaption: "开发与本地智能体", surfaceWorkCaption: "文档、研究与工作流", surfaceChatCaption: "经典 ChatGPT 对话",
      surfaceCodexDesc: "完整监看 Codex 额度、线程、上下文和执行设置。", surfaceWorkDesc: "共享同一 Codex 额度与运行时，以通用工作语义显示高级设置。", surfaceChatDesc: "经典 Chat 由 ChatGPT 单独管理；此处只显示账户和明确标注的 Codex 额度。",
      hostRunning: "{app}{version} · 正在运行", hostWaiting: "等待 ChatGPT/Codex 启动", remaining: "剩余 {value}%", resetUnknown: "重置时间未知", resetAtTime: "将于 {value} 重置", resetAtDate: "将于 {value} 重置",
      resetCount: "可用 {value} 次", resetCountUnknown: "可用次数 —", resetDetailsTitle: "使用限额重置", resetDetailsSubtitle: "逐条查看每次重置机会", resetDetailsUnavailable: "当前有 {value} 次可用重置；官方接口未返回单次详情", resetDetailsCapped: "官方接口本次返回 {shown}/{total} 条明细", noResets: "当前暂无可用重置额度", resetExpiry: "{value} 到期", resetGranted: "{value} 获得", validUnknown: "有效期未知", connectAccount: "连接账户", connectingAccount: "等待浏览器授权…", noStats: "暂无统计",
      approval: "审批：{value}", sandbox: "沙箱：{value}", defaultValue: "默认", readOnly: "只读", workspace: "工作区读写", fullAccess: "完全访问",
      effortLow: "低", effortMedium: "中", effortHigh: "高", effortXHigh: "超高", effortMax: "最大", effortUltra: "Ultra（自动协作）",
      workLow: "快速", workMedium: "标准", workHigh: "增强", workXHigh: "超高", workMax: "最大", workUltra: "Ultra（自动协作）", standard: "标准", fast: "快速",
      goalInactive: "为当前对话设置持续目标", goalActive: "{status} · 已用 {tokens} tokens", refreshSuccess: "全部信息已刷新", refreshFailed: "刷新失败",
      settingSuccess: "设置已应用到当前对话与默认配置", settingFailed: "设置失败", threadSwitchFailed: "切换对话失败",
      goalEnabled: "目标模式已启用", goalDisabled: "目标模式已关闭", goalSwitchFailed: "目标模式切换失败", compactStarted: "上下文压缩已启动", compactFailed: "上下文压缩失败",
      interfaceFailed: "界面初始化失败", live: "实时更新", warning: "实时数据已过期", refreshing: "正在刷新…", error: "暂时无法更新", notSignedIn: "未登录账户",
    },
    en: {
      appTitle: "ChatGPT Console", loadingAccount: "Loading account…", connecting: "Connecting to Codex…",
      refreshAll: "Refresh all information", minimize: "Minimize", pinWindow: "Always on top", floatingBall: "Toggle floating ball", maximizeWindow: "Maximize/restore window", hideTray: "Hide to tray", hideMenuBar: "Hide to menu bar",
      openChatGpt: "Open ChatGPT", openHost: "Open {app}", usageTitle: "Codex usage", usageSubtitle: "Shared with the current ChatGPT account", fiveHourLimit: "5-hour usage limit", weeklyLimit: "Weekly usage limit",
      waitingData: "Waiting for data", loadingResets: "Loading reset credits…", contextTitle: "Conversation context", contextSubtitle: "Select a recent thread and inspect context usage", compact: "Compact now",
      currentThread: "Current thread", loadingThreads: "Loading recent threads…", noThread: "No thread selected", usedContext: "Context used", contextWindow: "Context window", cachedInput: "Cached input",
      runtimeTitle: "Runtime configuration", runtimeSubtitle: "Apply to the selected thread and save as global defaults", scopeBadge: "Thread + defaults", model: "Model", reasoning: "Reasoning effort", power: "Power", speed: "Speed", permission: "Permissions",
      workModes: "Work modes", modesSubtitle: "Applies immediately to the selected thread", planMode: "Plan mode", planDesc: "Clarify and plan before execution", goalMode: "Goal mode", goalDesc: "Set a persistent outcome for this thread",
      goalPlaceholder: "Enter a goal; enabling it sets the current thread goal", settingsEffect: "Setting changes take effect on the next message in this thread", refresh: "Refresh", dragBall: "Drag floating ball", openConsole: "Open ChatGPT Console", fiveHourRemaining: "5h left",
      surfaceCodexCaption: "Development and local agents", surfaceWorkCaption: "Documents, research, and workflows", surfaceChatCaption: "Classic ChatGPT conversations",
      surfaceCodexDesc: "Full Codex quota, thread, context, and execution controls.", surfaceWorkDesc: "Shares the Codex quota and runtime, presented with general-work semantics.", surfaceChatDesc: "Classic Chat is managed separately by ChatGPT; only the account and explicitly labeled Codex quota are shown here.",
      hostRunning: "{app}{version} · running", hostWaiting: "Waiting for ChatGPT/Codex to start", remaining: "{value}% left", resetUnknown: "Reset time unknown", resetAtTime: "Resets at {value}", resetAtDate: "Resets on {value}",
      resetCount: "{value} available", resetCountUnknown: "Availability —", resetDetailsTitle: "Usage limit resets", resetDetailsSubtitle: "Inspect every individual reset", resetDetailsUnavailable: "{value} resets available; the official API returned no item details", resetDetailsCapped: "The official API returned {shown}/{total} item details", noResets: "No reset credits available", resetExpiry: "Expires {value}", resetGranted: "Granted {value}", validUnknown: "Expiry unknown", connectAccount: "Connect account", connectingAccount: "Waiting for browser authorization…", noStats: "No statistics",
      approval: "Approval: {value}", sandbox: "Sandbox: {value}", defaultValue: "Default", readOnly: "Read only", workspace: "Workspace read/write", fullAccess: "Full access",
      effortLow: "Low", effortMedium: "Medium", effortHigh: "High", effortXHigh: "Extra high", effortMax: "Maximum", effortUltra: "Ultra (auto collaboration)",
      workLow: "Faster", workMedium: "Standard", workHigh: "Extended", workXHigh: "High", workMax: "Maximum", workUltra: "Ultra", standard: "Standard", fast: "Fast",
      goalInactive: "Set a persistent outcome for this thread", goalActive: "{status} · {tokens} tokens used", refreshSuccess: "All information refreshed", refreshFailed: "Refresh failed",
      settingSuccess: "Applied to the current thread and default configuration", settingFailed: "Setting failed", threadSwitchFailed: "Could not switch thread",
      goalEnabled: "Goal mode enabled", goalDisabled: "Goal mode disabled", goalSwitchFailed: "Could not switch goal mode", compactStarted: "Context compaction started", compactFailed: "Context compaction failed",
      interfaceFailed: "Interface initialization failed", live: "Live", warning: "Live data is stale", refreshing: "Refreshing…", error: "Update unavailable", notSignedIn: "Not signed in",
    },
  };

  let usage = null;
  let control = null;
  let host = { detected: false };
  let status = { state: "connecting", message: "正在连接 Codex…" };
  let currentMode = "window";
  let auth = { state: "checking" };
  let windowState = { alwaysOnTop: false, maximized: false };
  let platform = "win32";
  let preferences = { locale: "zh-CN", surface: "codex" };
  let toastTimer = null;

  const byId = (id) => document.getElementById(id);
  const tr = (key, values = {}) => {
    const platformKey = platform === "darwin"
      ? ({ hideTray: "hideMenuBar" })[key] || key
      : key;
    let value = messages[preferences.locale]?.[platformKey] ?? messages["zh-CN"][platformKey] ?? platformKey;
    for (const [name, replacement] of Object.entries(values)) value = value.replace(`{${name}}`, String(replacement));
    return value;
  };

  function planLabel(value) {
    const labels = { free: "Free", go: "Go", plus: "Plus", pro: "Pro", prolite: "Pro Lite", team: "Team", business: "Business", enterprise: "Enterprise", edu: "Edu" };
    return labels[value] || "Codex";
  }

  function permissionLabel(value) {
    return ({ ":read-only": tr("readOnly"), ":workspace": tr("workspace"), ":danger-full-access": tr("fullAccess") })[value] || value;
  }

  function effortLabel(value) {
    const prefix = preferences.surface === "work" ? "work" : "effort";
    const suffix = ({ low: "Low", medium: "Medium", high: "High", xhigh: "XHigh", max: "Max", ultra: "Ultra" })[value];
    return suffix ? tr(`${prefix}${suffix}`) : value;
  }

  function formatReset(epochSeconds, durationMins) {
    if (!epochSeconds) return tr("resetUnknown");
    const date = new Date(epochSeconds * 1000);
    if (durationMins <= 24 * 60) {
      return tr("resetAtTime", { value: date.toLocaleTimeString(preferences.locale, { hour: "2-digit", minute: "2-digit", hour12: false }) });
    }
    return tr("resetAtDate", { value: date.toLocaleDateString(preferences.locale, { month: "short", day: "numeric" }) });
  }

  function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
    if (number >= 1_000) return `${Math.round(number / 1_000)}K`;
    return String(number);
  }

  function showToast(message, error = false) {
    if (isBall) return;
    const toast = byId("toast");
    toast.textContent = message;
    toast.classList.toggle("error", error);
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2_800);
  }

  function renderLimit(prefix, value) {
    const remaining = value?.remainingPercent;
    byId(`${prefix}-bar`).style.width = `${remaining ?? 0}%`;
    byId(`${prefix}-remaining`).textContent = remaining === undefined ? "--" : tr("remaining", { value: remaining });
    byId(`${prefix}-reset`).textContent = value ? formatReset(value.resetsAt, value.windowDurationMins) : tr("waitingData");
  }

  function renderUsage() {
    if (isBall) {
      byId("ball-percent").textContent = usage?.primary ? `${usage.primary.remainingPercent}%` : "--";
      return;
    }
    renderLimit("primary", usage?.primary);
    renderLimit("secondary", usage?.secondary);
    const count = usage?.resetCredits?.availableCount;
    byId("reset-count").textContent = count == null ? tr("resetCountUnknown") : tr("resetCount", { value: count });
    const items = usage?.resetCredits?.items || [];
    const resetList = byId("reset-list");
    if (!usage) resetList.textContent = tr("loadingResets");
    else if (!items.length && Number.isFinite(Number(count)) && Number(count) > 0) resetList.textContent = tr("resetDetailsUnavailable", { value: count });
    else if (!items.length) resetList.textContent = tr("noResets");
    else {
      const rows = items.map((item) => {
        const row = document.createElement("div");
        row.className = "reset-item";
        const copy = document.createElement("div");
        const title = document.createElement("strong");
        const description = document.createElement("span");
        const meta = document.createElement("small");
        const expiry = item.expiresAt
          ? tr("resetExpiry", { value: new Date(item.expiresAt * 1000).toLocaleDateString(preferences.locale, { month: "short", day: "numeric" }) })
          : tr("validUnknown");
        title.textContent = item.title;
        description.textContent = item.description || (item.grantedAt ? tr("resetGranted", { value: new Date(item.grantedAt * 1000).toLocaleDateString(preferences.locale, { month: "short", day: "numeric" }) }) : "");
        meta.textContent = expiry;
        copy.append(title, description);
        row.append(copy, meta);
        return row;
      });
      if (Number(count) > rows.length) {
        const note = document.createElement("div");
        note.className = "reset-empty";
        note.textContent = tr("resetDetailsCapped", { shown: rows.length, total: count });
        rows.push(note);
      }
      resetList.replaceChildren(...rows);
    }
    resetList.classList.toggle("reset-empty", !items.length);
  }

  function renderAuth() {
    if (isBall) return;
    const button = byId("connect-account-button");
    button.hidden = auth.state === "signedIn";
    button.disabled = auth.state === "pending" || auth.state === "checking";
    button.textContent = tr(auth.state === "pending" ? "connectingAccount" : "connectAccount");
  }

  function renderWindowState() {
    if (isBall) return;
    byId("pin-button").classList.toggle("active", Boolean(windowState.alwaysOnTop));
    byId("floating-button").classList.toggle("active", currentMode === "floating");
    document.querySelector(".dashboard-panel").classList.toggle("maximized", Boolean(windowState.maximized));
  }

  function replaceOptions(select, options, selectedValue) {
    const signature = JSON.stringify(options.map((option) => [option.value, option.label]));
    if (select.dataset.signature !== signature) {
      select.replaceChildren(...options.map((item) => {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = item.label;
        option.title = item.title || "";
        return option;
      }));
      select.dataset.signature = signature;
    }
    if (selectedValue !== undefined && selectedValue !== null) select.value = selectedValue;
  }

  function selectedModel() {
    const modelId = byId("model-select")?.value || control?.settings?.model;
    return control?.catalog?.models?.find((model) => model.id === modelId || model.model === modelId) || null;
  }

  function renderModelDependentOptions() {
    if (isBall || !control) return;
    const model = selectedModel();
    const reasoningOptions = (model?.efforts || []).map((effort) => ({ value: effort.id, label: effortLabel(effort.id), title: effort.description }));
    if (!reasoningOptions.length && control.settings.reasoningEffort) reasoningOptions.push({ value: control.settings.reasoningEffort, label: effortLabel(control.settings.reasoningEffort) });
    replaceOptions(byId("reasoning-select"), reasoningOptions, control.settings.reasoningEffort);

    const speedOptions = [{ value: "default", label: tr("standard") }];
    for (const tier of model?.serviceTiers || []) speedOptions.push({ value: tier.id, label: tier.name === "Fast" ? tr("fast") : tier.name, title: tier.description });
    if (!speedOptions.some((option) => option.value === control.settings.serviceTier)) speedOptions.push({ value: control.settings.serviceTier, label: control.settings.serviceTier });
    replaceOptions(byId("speed-select"), speedOptions, control.settings.serviceTier || "default");
  }

  function renderControl() {
    if (isBall || !control) return;
    const account = control.account;
    byId("account-email").textContent = account?.email || (account?.type === "apiKey" ? "OpenAI API Key" : tr("notSignedIn"));
    byId("account-avatar").textContent = (account?.email || "C").slice(0, 1).toUpperCase();
    byId("plan-badge").textContent = planLabel(account?.planType || usage?.planType);

    replaceOptions(byId("thread-select"), (control.threads || []).map((thread) => ({ value: thread.id, label: thread.name, title: thread.cwd })), control.selectedThreadId);
    const context = control.context;
    const tokens = context?.tokenUsage;
    byId("context-name").textContent = context?.name || tr("noThread");
    byId("context-cwd").textContent = context?.cwd || "--";
    byId("context-percent").textContent = tokens ? `${tokens.usedPercent}%` : tr("noStats");
    byId("context-bar").style.width = `${tokens?.usedPercent || 0}%`;
    byId("context-bar").classList.toggle("warning", (tokens?.usedPercent || 0) >= 70 && (tokens?.usedPercent || 0) < 88);
    byId("context-bar").classList.toggle("critical", (tokens?.usedPercent || 0) >= 88);
    byId("context-used").textContent = formatNumber(tokens?.usedTokens);
    byId("context-window").textContent = formatNumber(tokens?.contextWindow);
    byId("context-cached").textContent = formatNumber(tokens?.cachedInputTokens);

    replaceOptions(byId("model-select"), (control.catalog?.models || []).map((model) => ({ value: model.id, label: model.displayName, title: model.description })), control.settings?.model);
    renderModelDependentOptions();
    replaceOptions(byId("permission-select"), (control.catalog?.permissions || []).map((profile) => ({ value: profile.id, label: permissionLabel(profile.id), title: profile.description || "" })), control.settings?.permission);
    byId("approval-summary").textContent = tr("approval", { value: control.settings?.approvalPolicy || tr("defaultValue") });
    byId("sandbox-summary").textContent = tr("sandbox", { value: control.settings?.sandboxType || tr("defaultValue") });

    const planEnabled = control.settings?.planMode === "plan";
    byId("plan-toggle").setAttribute("aria-checked", String(planEnabled));
    const goalEnabled = Boolean(control.goal);
    byId("goal-toggle").setAttribute("aria-checked", String(goalEnabled));
    byId("goal-status").textContent = goalEnabled
      ? tr("goalActive", { status: control.goal.status, tokens: formatNumber(control.goal.tokensUsed) })
      : tr("goalInactive");
    const goalInput = byId("goal-objective");
    if (document.activeElement !== goalInput) goalInput.value = control.goal?.objective || "";
    goalInput.classList.toggle("active", goalEnabled);
  }

  function renderSurface() {
    if (isBall) return;
    const surface = preferences.surface;
    document.body.dataset.surface = surface;
    for (const button of document.querySelectorAll("[data-surface]")) {
      const active = button.dataset.surface === surface;
      const available = !host.surfaces || host.surfaces.includes(button.dataset.surface);
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.disabled = !available;
    }
    const info = {
      codex: { icon: "C", title: "Codex", desc: "surfaceCodexDesc", caption: "surfaceCodexCaption" },
      work: { icon: "W", title: "Work", desc: "surfaceWorkDesc", caption: "surfaceWorkCaption" },
      chat: { icon: "⌁", title: "Chat", desc: "surfaceChatDesc", caption: "surfaceChatCaption" },
    }[surface];
    byId("surface-icon").textContent = info.icon;
    byId("surface-title").textContent = info.title;
    byId("surface-description").textContent = tr(info.desc);
    byId("surface-caption").textContent = tr(info.caption);
    byId("reasoning-label").textContent = tr(surface === "work" ? "power" : "reasoning");
    const version = host.version ? ` ${host.version}` : "";
    const appName = host.appName || "ChatGPT";
    byId("host-meta").textContent = host.detected ? tr("hostRunning", { app: appName, version }) : tr("hostWaiting");
    byId("open-host-button").textContent = tr("openHost", { app: appName });
    renderControl();
  }

  function renderStatus() {
    const statusClass = ["live", "warning", "error"].includes(status.state) ? status.state : "connecting";
    if (isBall) {
      byId("ball-status").className = `ball-status ${statusClass}`;
      return;
    }
    byId("status-dot").className = `status-dot ${statusClass}`;
    const knownMessage = ({ live: "live", warning: "warning", refreshing: "refreshing", connecting: "connecting", error: "error" })[status.state] || "connecting";
    const updated = status.lastSuccessfulAt ? ` · ${new Date(status.lastSuccessfulAt).toLocaleTimeString(preferences.locale, { hour: "2-digit", minute: "2-digit", hour12: false })}` : "";
    byId("status-text").textContent = `${tr(knownMessage)}${updated}`;
    byId("status-button").title = status.error || tr("refreshAll");
  }

  function renderMode() {
    if (isBall) return;
    renderWindowState();
  }

  function applyLocale() {
    document.documentElement.lang = preferences.locale;
    document.title = tr("appTitle");
    for (const element of document.querySelectorAll("[data-i18n]")) element.textContent = tr(element.dataset.i18n);
    for (const element of document.querySelectorAll("[data-i18n-title]")) element.title = tr(element.dataset.i18nTitle);
    for (const element of document.querySelectorAll("[data-i18n-aria]")) element.setAttribute("aria-label", tr(element.dataset.i18nAria));
    for (const element of document.querySelectorAll("[data-i18n-placeholder]")) element.placeholder = tr(element.dataset.i18nPlaceholder);
    if (!isBall) byId("language-button").textContent = preferences.locale === "zh-CN" ? "EN" : "中";
    renderUsage();
    renderControl();
    renderStatus();
    renderSurface();
    renderAuth();
  }

  async function refreshEverything() {
    try {
      const result = await window.dashboardApi.refreshAll();
      usage = result.usage;
      control = result.control;
      renderUsage();
      renderControl();
      showToast(tr("refreshSuccess"));
    } catch (error) {
      showToast(error.message || tr("refreshFailed"), true);
    }
  }

  async function applyControl(kind, value, element) {
    if (element) element.disabled = true;
    try {
      control = await window.dashboardApi.updateControl(kind, value);
      renderControl();
      showToast(tr("settingSuccess"));
    } catch (error) {
      showToast(error.message || tr("settingFailed"), true);
      renderControl();
    } finally {
      if (element) element.disabled = false;
    }
  }

  function bindWindowPointer(element, action, edge = "") {
    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      window.dashboardApi.beginWindowAction({ action, edge, screenX: event.screenX, screenY: event.screenY });
    });
    element.addEventListener("pointermove", (event) => {
      if (!element.hasPointerCapture(event.pointerId)) return;
      window.dashboardApi.updateWindowAction({ screenX: event.screenX, screenY: event.screenY });
    });
    const finish = (event) => {
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      window.dashboardApi.endWindowAction();
    };
    element.addEventListener("pointerup", finish);
    element.addEventListener("pointercancel", finish);
  }

  async function initialize() {
    const initial = await window.dashboardApi.getInitialState();
    usage = initial.usage;
    control = initial.control;
    host = initial.host || host;
    status = initial.status;
    auth = initial.auth || auth;
    windowState = initial.window || windowState;
    currentMode = initial.mode;
    platform = initial.platform || platform;
    preferences = initial.preferences || preferences;
    applyLocale();
    renderMode();
  }

  window.dashboardApi.onUsage((value) => { usage = value; renderUsage(); });
  window.dashboardApi.onControl((value) => { control = value; renderControl(); });
  window.dashboardApi.onStatus((value) => { status = value; renderStatus(); });
  window.dashboardApi.onMode((value) => { currentMode = value; renderMode(); });
  window.dashboardApi.onHost((value) => { host = value; renderSurface(); });
  window.dashboardApi.onPreferences((value) => { preferences = value; applyLocale(); });
  window.dashboardApi.onAuth((value) => { auth = value; renderAuth(); });
  window.dashboardApi.onWindowState((value) => { windowState = value; renderWindowState(); });

  if (isBall) {
    byId("ball-open").addEventListener("click", () => window.dashboardApi.restoreFromBall());
  } else {
    for (const handle of document.querySelectorAll("[data-resize]")) bindWindowPointer(handle, "resize", handle.dataset.resize);

    byId("pin-button").addEventListener("click", () => window.dashboardApi.togglePinned());
    byId("floating-button").addEventListener("click", () => window.dashboardApi.toggleFloating());
    byId("layer-button").addEventListener("click", () => window.dashboardApi.toggleMaximized());
    for (const button of document.querySelectorAll("[data-surface]")) {
      button.addEventListener("click", async () => {
        preferences = await window.dashboardApi.setPreferences({ surface: button.dataset.surface });
        renderSurface();
      });
    }

    byId("language-button").addEventListener("click", async () => {
      preferences = await window.dashboardApi.setPreferences({ locale: preferences.locale === "zh-CN" ? "en" : "zh-CN" });
      applyLocale();
    });
    byId("open-host-button").addEventListener("click", () => window.dashboardApi.openChatGpt());
    byId("refresh-button").addEventListener("click", refreshEverything);
    byId("status-button").addEventListener("click", refreshEverything);
    byId("footer-refresh").addEventListener("click", refreshEverything);
    byId("connect-account-button").addEventListener("click", async () => {
      try { auth = await window.dashboardApi.connectAccount(); renderAuth(); }
      catch (error) { showToast(error.message || tr("refreshFailed"), true); }
    });
    byId("reset-details-toggle").addEventListener("click", () => {
      const button = byId("reset-details-toggle");
      const expanded = button.getAttribute("aria-expanded") !== "false";
      button.setAttribute("aria-expanded", String(!expanded));
      byId("reset-list").hidden = expanded;
    });
    byId("minimize-button").addEventListener("click", () => window.dashboardApi.minimize());
    byId("close-button").addEventListener("click", () => window.dashboardApi.hide());

    byId("thread-select").addEventListener("change", async (event) => {
      event.target.disabled = true;
      try {
        control = await window.dashboardApi.selectThread(event.target.value);
        renderControl();
      } catch (error) {
        showToast(error.message || tr("threadSwitchFailed"), true);
      } finally {
        event.target.disabled = false;
      }
    });
    byId("model-select").addEventListener("change", (event) => { renderModelDependentOptions(); applyControl("model", event.target.value, event.target); });
    byId("reasoning-select").addEventListener("change", (event) => applyControl("reasoningEffort", event.target.value, event.target));
    byId("speed-select").addEventListener("change", (event) => applyControl("serviceTier", event.target.value, event.target));
    byId("permission-select").addEventListener("change", (event) => applyControl("permission", event.target.value, event.target));
    byId("plan-toggle").addEventListener("click", () => applyControl("planMode", control?.settings?.planMode === "plan" ? "default" : "plan", byId("plan-toggle")));
    byId("goal-toggle").addEventListener("click", async () => {
      const enabled = !control?.goal;
      const objective = byId("goal-objective").value.trim() || control?.context?.name || "Complete the current thread goal";
      byId("goal-toggle").disabled = true;
      try {
        control = await window.dashboardApi.setGoal(enabled, objective);
        renderControl();
        showToast(tr(enabled ? "goalEnabled" : "goalDisabled"));
      } catch (error) {
        showToast(error.message || tr("goalSwitchFailed"), true);
      } finally {
        byId("goal-toggle").disabled = false;
      }
    });
    byId("compact-button").addEventListener("click", async () => {
      const button = byId("compact-button");
      button.disabled = true;
      try {
        await window.dashboardApi.compactContext();
        showToast(tr("compactStarted"));
      } catch (error) {
        showToast(error.message || tr("compactFailed"), true);
      } finally {
        setTimeout(() => { button.disabled = false; }, 1_500);
      }
    });
  }

  initialize().catch((error) => {
    status = { state: "error", message: tr("interfaceFailed"), error: error.message };
    renderStatus();
  });
  setInterval(() => renderUsage(), 30_000);
})();
