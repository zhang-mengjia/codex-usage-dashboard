const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} = require("electron");
const { CodexAppServerClient } = require("./lib/codex-app-server.cjs");
const { CodexControlService } = require("./lib/codex-control.cjs");
const { detectIntegratedChatGpt, queryIntegratedChatGptPackage } = require("./lib/chatgpt-host.cjs");
const { HostProcessWatcher } = require("./lib/process-watcher.cjs");
const {
  clearMacWindowLayer,
  isVisibleOnAllWorkspaces,
  setMacFloatingLayer,
} = require("./lib/platform-window.cjs");
const { normalizeRateLimits } = require("./lib/usage-model.cjs");
const { WINDOW_MODES, clampFloatingBounds, isWindowMode, snapFloatingBounds } = require("./lib/window-modes.cjs");

const argv = process.argv.slice(1);
let isBackgroundLaunch = argv.includes("--background");
const isTestMode = argv.includes("--test-mode");
const selfTestOutputArg = argv.find((value) => value.startsWith("--self-test-output="));
const debugPortArg = argv.find((value) => value.startsWith("--remote-debugging-port="));
if (debugPortArg) app.commandLine.appendSwitch("remote-debugging-port", debugPortArg.split("=")[1]);

let dashboardWindow = null;
let ballWindow = null;
let tray = null;
let watcher = null;
let usageClient = null;
let controlService = null;
let refreshTimer = null;
let reconnectTimer = null;
let quitting = false;
let dashboardHasBeenShown = false;
let skipTaskbar = false;
let pointerSession = null;
let activeLoginId = null;

const DEFAULT_WINDOW_SIZE = Object.freeze({ width: 640, height: 820 });
const MIN_WINDOW_SIZE = Object.freeze({ width: 520, height: 620 });
const BALL_WINDOW_SIZE = 108;

const state = {
  platform: process.platform,
  mode: WINDOW_MODES.WINDOW,
  window: { alwaysOnTop: false, maximized: false },
  preferences: { locale: "zh-CN", surface: "codex" },
  auth: { state: "checking", error: null },
  usage: null,
  control: null,
  host: { detected: false, processName: null },
  status: {
    state: "connecting",
    message: "正在连接 Codex…",
    error: null,
    lastSuccessfulAt: null,
  },
  floatingBounds: null,
};

function rendererPath() {
  return path.join(__dirname, "renderer", "index.html");
}

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function sharedCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function dashboardCodexHome() {
  return path.join(app.getPath("userData"), "codex-home");
}

function prepareDashboardCodexHome() {
  const target = dashboardCodexHome();
  fs.mkdirSync(target, { recursive: true });
  const sourceConfig = path.join(sharedCodexHome(), "config.toml");
  const targetConfig = path.join(target, "config.toml");
  if (!fs.existsSync(targetConfig) && fs.existsSync(sourceConfig)) fs.copyFileSync(sourceConfig, targetConfig);
  return target;
}

function iconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "..", "resources", "icon.png");
}

function readSettings() {
  try {
    const value = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    if ([2, 3, 4, 5].includes(value.version)) {
      state.mode = value.mode === WINDOW_MODES.FLOATING ? WINDOW_MODES.FLOATING : WINDOW_MODES.WINDOW;
      state.window.alwaysOnTop = Boolean(value.alwaysOnTop || value.mode === "top");
      if (["zh-CN", "en"].includes(value.locale)) state.preferences.locale = value.locale;
      if (["codex", "work", "chat"].includes(value.surface)) state.preferences.surface = value.surface;
      if (Number.isFinite(value.floatingBounds?.x) && Number.isFinite(value.floatingBounds?.y)) {
        state.floatingBounds = { x: Math.round(value.floatingBounds.x), y: Math.round(value.floatingBounds.y) };
      }
      if (value.version !== 5) writeSettings();
    } else {
      state.mode = WINDOW_MODES.WINDOW;
      writeSettings();
    }
  } catch {
    // First run starts in regular window mode.
  }
}

function writeSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify({
      version: 5,
      mode: state.mode,
      alwaysOnTop: state.window.alwaysOnTop,
      locale: state.preferences.locale,
      surface: state.preferences.surface,
      floatingBounds: state.floatingBounds,
    }, null, 2));
  } catch (error) {
    updateStatus({ error: `无法保存窗口设置: ${error.message}` });
  }
}

function allWindows() {
  return [dashboardWindow, ballWindow].filter((window) => window && !window.isDestroyed());
}

function broadcast(channel, value) {
  for (const window of allWindows()) {
    if (!window.webContents.isDestroyed()) window.webContents.send(channel, value);
  }
}

function updateStatus(patch) {
  Object.assign(state.status, patch);
  broadcast("dashboard:status", state.status);
}

function updateAuth(patch) {
  Object.assign(state.auth, patch);
  broadcast("dashboard:auth", state.auth);
}

function updateWindowState() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    state.window.maximized = dashboardWindow.isMaximized();
    state.window.alwaysOnTop = dashboardWindow.isAlwaysOnTop();
  }
  broadcast("dashboard:window-state", state.window);
}

function updateHost(host) {
  const productProcess = String(host.processName || "").toLowerCase().replace(/\.exe$/, "");
  const productState = productProcess === "chatgpt"
    ? { integratedChatGpt: true, appName: "ChatGPT", surfaces: ["codex", "work", "chat"] }
    : productProcess === "codex"
      ? { integratedChatGpt: false, appName: "Codex", surfaces: ["codex"] }
      : {};
  state.host = {
    ...state.host,
    ...host,
    ...productState,
  };
  if (Array.isArray(state.host.surfaces) && !state.host.surfaces.includes(state.preferences.surface)) {
    state.preferences.surface = "codex";
    writeSettings();
    broadcast("dashboard:preferences", state.preferences);
  }
  broadcast("dashboard:host", state.host);
}

function createDashboardWindow() {
  const window = new BrowserWindow({
    width: DEFAULT_WINDOW_SIZE.width,
    height: DEFAULT_WINDOW_SIZE.height,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: "#fbfbfc",
    roundedCorners: true,
    shadow: true,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMenuBarVisibility(false);
  window.loadFile(rendererPath(), { query: { view: "dashboard" } });
  window.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      void hideDashboard();
    }
  });
  window.on("restore", () => {
    window.webContents.send("dashboard:mode", state.mode);
    updateWindowState();
  });
  window.on("maximize", updateWindowState);
  window.on("unmaximize", updateWindowState);
  window.webContents.on("did-finish-load", () => {
    window.webContents.send("dashboard:usage", state.usage);
    window.webContents.send("dashboard:control", state.control);
    window.webContents.send("dashboard:status", state.status);
    window.webContents.send("dashboard:mode", state.mode);
    window.webContents.send("dashboard:host", state.host);
    window.webContents.send("dashboard:preferences", state.preferences);
    window.webContents.send("dashboard:auth", state.auth);
    window.webContents.send("dashboard:window-state", state.window);
  });
  return window;
}

function createBallWindow() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const requestedBounds = {
    x: state.floatingBounds?.x ?? workArea.x + workArea.width - BALL_WINDOW_SIZE - 8,
    y: state.floatingBounds?.y ?? workArea.y + Math.round(workArea.height * 0.32),
    width: BALL_WINDOW_SIZE,
    height: BALL_WINDOW_SIZE,
  };
  const initialBounds = snapFloatingBounds(requestedBounds, screen.getDisplayMatching(requestedBounds).workArea);
  const window = new BrowserWindow({
    ...initialBounds,
    show: false,
    frame: false,
    thickFrame: false,
    transparent: true,
    backgroundColor: "#00000000",
    roundedCorners: true,
    shadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setAlwaysOnTop(true, "floating");
  window.loadFile(rendererPath(), { query: { view: "ball" } });
  window.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      window.hide();
    }
  });
  window.webContents.on("did-finish-load", () => {
    window.webContents.send("dashboard:usage", state.usage);
    window.webContents.send("dashboard:status", state.status);
    window.webContents.send("dashboard:mode", state.mode);
    window.webContents.send("dashboard:preferences", state.preferences);
    window.webContents.send("dashboard:auth", state.auth);
  });
  return window;
}

function createTray() {
  const english = state.preferences.locale === "en";
  let image = nativeImage.createFromPath(iconPath());
  if (image.isEmpty()) image = nativeImage.createEmpty();
  image = image.resize({ width: 18, height: 18 });
  if (process.platform === "darwin") image.setTemplateImage(true);
  tray = new Tray(image);
  tray.setToolTip(english ? "ChatGPT Console" : "ChatGPT 控制台");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: english ? "Show as regular window" : "显示为普通窗口（恢复）", click: () => applyWindowMode(WINDOW_MODES.WINDOW) },
      { label: english ? "Always on top" : "置顶显示", type: "checkbox", checked: state.window.alwaysOnTop, click: () => togglePinned() },
      { label: english ? "Floating ball" : "悬浮球", click: () => applyWindowMode(WINDOW_MODES.FLOATING) },
      { label: english ? "Refresh now" : "立即刷新", click: () => refreshAll() },
      { type: "separator" },
      {
        label: english ? "Quit" : "退出",
        click: () => void quitApplication(),
      },
    ]),
  );
  tray.on("click", () => applyWindowMode(WINDOW_MODES.WINDOW));
}

async function hideDashboard() {
  if (!dashboardWindow || dashboardWindow.isDestroyed()) return true;
  dashboardWindow.hide();
  return true;
}

async function quitApplication() {
  quitting = true;
  app.quit();
}

async function applyWindowMode(mode, options = {}) {
  if (!isWindowMode(mode)) throw new Error(`未知窗口模式: ${mode}`);
  state.mode = mode;
  if (!options.skipSave) writeSettings();

  clearMacWindowLayer(dashboardWindow);
  setMacFloatingLayer(ballWindow, false);
  ballWindow.hide();
  dashboardWindow.setResizable(true);
  dashboardWindow.setFocusable(true);
  dashboardWindow.setAlwaysOnTop(state.window.alwaysOnTop, "floating");
  dashboardWindow.setSkipTaskbar(false);
  skipTaskbar = false;

  if (mode === WINDOW_MODES.FLOATING) {
    dashboardWindow.hide();
    ballWindow.setAlwaysOnTop(true, "floating");
    setMacFloatingLayer(ballWindow, true);
    ballWindow.showInactive();
    snapBallToEdge();
  } else {
    if (dashboardWindow.isMinimized()) dashboardWindow.restore();
    dashboardWindow.show();
    dashboardWindow.focus();
    dashboardHasBeenShown = true;
  }
  broadcast("dashboard:mode", state.mode);
  updateWindowState();
  return diagnostics();
}

async function togglePinned() {
  state.window.alwaysOnTop = !state.window.alwaysOnTop;
  dashboardWindow.setAlwaysOnTop(state.window.alwaysOnTop, "floating");
  writeSettings();
  updateWindowState();
  tray?.destroy();
  createTray();
  return diagnostics();
}

async function toggleFloating() {
  return applyWindowMode(state.mode === WINDOW_MODES.FLOATING ? WINDOW_MODES.WINDOW : WINDOW_MODES.FLOATING);
}

async function toggleMaximized() {
  if (dashboardWindow.isMaximized()) dashboardWindow.unmaximize();
  else dashboardWindow.maximize();
  updateWindowState();
  return diagnostics();
}

function snapBallToEdge() {
  if (!ballWindow || ballWindow.isDestroyed() || !ballWindow.isVisible()) return;
  const bounds = ballWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const snapped = snapFloatingBounds(bounds, display.workArea);
  if (snapped.x !== bounds.x || snapped.y !== bounds.y) {
    ballWindow.setPosition(snapped.x, snapped.y, process.platform === "darwin");
  }
  const actual = process.platform === "darwin" ? snapped : ballWindow.getBounds();
  state.floatingBounds = { x: actual.x, y: actual.y };
  writeSettings();
}

async function showDashboard() {
  if (!dashboardWindow) return;
  if (state.mode === WINDOW_MODES.FLOATING) {
    ballWindow.showInactive();
    return;
  }
  await applyWindowMode(state.mode, { skipSave: true });
}

async function refreshUsage() {
  if (!usageClient) return null;
  updateStatus({ state: "refreshing", message: "正在更新…", error: null });
  try {
    const payload = await usageClient.readRateLimits();
    state.usage = normalizeRateLimits(payload);
    updateAuth({ state: "signedIn", error: null });
    updateStatus({
      state: "live",
      message: "实时更新",
      error: null,
      lastSuccessfulAt: state.usage.updatedAt,
    });
    broadcast("dashboard:usage", state.usage);
    return state.usage;
  } catch (error) {
    const authRequired = /401|token|sign.?in|登录|auth/i.test(error.message);
    if (authRequired) updateAuth({ state: "required", error: error.message });
    if (!state.usage) broadcast("dashboard:usage", null);
    updateStatus({
      state: "error",
      message: authRequired ? "请连接 ChatGPT 账户" : "实时额度暂不可用",
      error: error.message,
    });
    throw error;
  }
}

async function refreshControl() {
  if (!controlService) return null;
  state.control = await controlService.refresh();
  broadcast("dashboard:control", state.control);
  return state.control;
}

async function refreshAll() {
  updateStatus({ state: "refreshing", message: "正在刷新全部信息…", error: null });
  try {
    let control = state.control;
    try { control = await refreshControl(); } catch {}
    const usage = await refreshUsage();
    updateStatus({
      state: "live",
      message: "实时更新",
      error: null,
      lastSuccessfulAt: Date.now(),
    });
    return { usage, control };
  } catch (error) {
    updateStatus({ state: "error", message: "刷新失败", error: error.message });
    throw error;
  }
}

function scheduleReconnect() {
  if (reconnectTimer || quitting) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    usageClient?.stop();
    usageClient = null;
    await startUsageService();
  }, 15_000);
}

async function startUsageService() {
  if (usageClient || quitting) return;
  const codexHome = prepareDashboardCodexHome();
  usageClient = new CodexAppServerClient({
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      CODEX_SQLITE_HOME: sharedCodexHome(),
    },
  });
  controlService = new CodexControlService(usageClient);
  usageClient.on("rate-limits-updated", () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refreshUsage().catch(() => {}), 250);
  });
  usageClient.on("disconnected", (error) => {
    updateStatus({ state: "error", message: "连接已断开", error: error.message });
    usageClient = null;
    controlService = null;
    scheduleReconnect();
  });
  usageClient.on("notification", (message) => {
    if (message.method !== "account/login/completed") return;
    activeLoginId = null;
    updateAuth({ state: message.params?.success === false ? "required" : "signedIn", error: message.params?.error || null });
    if (message.params?.success !== false) refreshAll().catch(() => {});
  });
  try {
    await usageClient.start();
    const account = await usageClient.readAccount(false);
    updateAuth({ state: account?.account ? "signedIn" : "required", error: null });
    try { await refreshControl(); } catch {}
    if (account?.account) await refreshUsage();
    else updateStatus({ state: "error", message: "请连接 ChatGPT 账户", error: null });
  } catch (error) {
    updateAuth({ state: "required", error: error.message });
    updateStatus({ state: "error", message: "请连接 ChatGPT 账户", error: error.message });
  }
}

async function connectChatGptAccount() {
  if (!usageClient) await startUsageService();
  if (activeLoginId) return state.auth;
  const login = await usageClient.startChatGptLogin();
  activeLoginId = login.loginId;
  updateAuth({ state: "pending", error: null });
  await shell.openExternal(login.authUrl);
  return state.auth;
}

function startHostWatcher() {
  const override = isTestMode
    ? argv.find((value) => value.startsWith("--watch-process="))?.split("=")[1]
    : null;
  watcher = new HostProcessWatcher({ names: override ? [override] : undefined });
  watcher.on("change", (host) => updateHost(host));
  watcher.on("detected", () => {
    if (isBackgroundLaunch && !dashboardHasBeenShown) showDashboard();
  });
  watcher.on("error", (error) => {
    updateStatus({ error: `无法检测 Codex/ChatGPT 进程: ${error.message}` });
  });
  watcher.start();
}

function loginItemQueryOptions() {
  return process.platform === "darwin"
    ? { type: "mainAppService" }
    : { path: process.execPath, args: ["--background"] };
}

function enableLoginItem() {
  if (process.platform === "darwin") {
    app.setLoginItemSettings({ openAtLogin: true, type: "mainAppService" });
  } else {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: ["--background"],
    });
  }
}

async function openChatGpt() {
  if (process.platform !== "darwin") return shell.openExternal("codex://launch");
  const home = app.getPath("home");
  const names = state.host.appName === "Codex" ? ["Codex", "ChatGPT"] : ["ChatGPT", "Codex"];
  for (const name of names) {
    for (const applicationPath of [
      `/Applications/${name}.app`,
      path.join(home, "Applications", `${name}.app`),
    ]) {
      if (!fs.existsSync(applicationPath)) continue;
      const error = await shell.openPath(applicationPath);
      if (!error) return true;
    }
  }
  return shell.openExternal(state.host.appName === "Codex" ? "codex://launch" : "chatgpt://");
}

async function diagnostics() {
  return {
    mode: state.mode,
    platform: process.platform,
    main: dashboardWindow
      ? {
          visible: dashboardWindow.isVisible(),
          minimized: dashboardWindow.isMinimized(),
          maximized: dashboardWindow.isMaximized(),
          alwaysOnTop: dashboardWindow.isAlwaysOnTop(),
          visibleOnAllWorkspaces: isVisibleOnAllWorkspaces(dashboardWindow),
          skipTaskbar,
          bounds: dashboardWindow.getBounds(),
        }
      : null,
    ball: ballWindow
      ? {
          visible: ballWindow.isVisible(),
          alwaysOnTop: ballWindow.isAlwaysOnTop(),
          visibleOnAllWorkspaces: isVisibleOnAllWorkspaces(ballWindow),
          bounds: ballWindow.getBounds(),
        }
      : null,
    loginItem: app.getLoginItemSettings(loginItemQueryOptions()),
    status: state.status,
    auth: state.auth,
    host: state.host,
  };
}

function beginWindowPointerAction(payload) {
  const action = String(payload?.action || "");
  if (action === "move-ball") {
    if (!ballWindow || ballWindow.isDestroyed() || !ballWindow.isVisible()) return;
    const pointer = isTestMode
      ? { x: Number(payload.screenX), y: Number(payload.screenY) }
      : screen.getCursorScreenPoint();
    pointerSession = {
      action,
      startX: pointer.x,
      startY: pointer.y,
      bounds: ballWindow.getBounds(),
    };
    return;
  }
  if (action !== "resize" || !dashboardWindow || dashboardWindow.isDestroyed() || dashboardWindow.isMaximized()) return;
  const edge = String(payload?.edge || "").toLowerCase();
  if (!/^(n|s|e|w|ne|nw|se|sw)$/.test(edge)) return;
  pointerSession = {
    action,
    edge,
    startX: Number(payload.screenX),
    startY: Number(payload.screenY),
    bounds: dashboardWindow.getBounds(),
  };
}

function updateWindowPointerAction(payload) {
  if (!pointerSession) return;
  const pointer = pointerSession.action === "move-ball" && !isTestMode
    ? screen.getCursorScreenPoint()
    : { x: Number(payload.screenX), y: Number(payload.screenY) };
  const deltaX = pointer.x - pointerSession.startX;
  const deltaY = pointer.y - pointerSession.startY;
  const initial = pointerSession.bounds;
  if (pointerSession.action === "move-ball") {
    if (!ballWindow || ballWindow.isDestroyed()) return;
    const display = screen.getDisplayNearestPoint(pointer);
    const constrained = clampFloatingBounds({
      ...initial,
      x: initial.x + deltaX,
      y: initial.y + deltaY,
    }, display.workArea);
    ballWindow.setPosition(constrained.x, constrained.y, false);
    return;
  }
  if (!dashboardWindow || dashboardWindow.isDestroyed()) return;
  const edge = pointerSession.edge;
  let { x, y, width, height } = initial;
  if (edge.includes("e")) width = Math.max(MIN_WINDOW_SIZE.width, initial.width + deltaX);
  if (edge.includes("s")) height = Math.max(MIN_WINDOW_SIZE.height, initial.height + deltaY);
  if (edge.includes("w")) {
    width = Math.max(MIN_WINDOW_SIZE.width, initial.width - deltaX);
    x = initial.x + (initial.width - width);
  }
  if (edge.includes("n")) {
    height = Math.max(MIN_WINDOW_SIZE.height, initial.height - deltaY);
    y = initial.y + (initial.height - height);
  }
  dashboardWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }, false);
}

function endWindowPointerAction() {
  const action = pointerSession?.action;
  pointerSession = null;
  if (action === "move-ball") snapBallToEdge();
}

async function waitForCondition(check, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("自动测试等待条件超时");
}

async function runSelfTest(outputPath) {
  const report = { version: app.getVersion(), createdAt: new Date().toISOString(), checks: [] };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const record = (name, details = {}) => report.checks.push({ name, passed: true, ...details });
  const requireValue = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  try {
    await waitForCondition(() => !dashboardWindow.webContents.isLoadingMainFrame());
    await applyWindowMode(WINDOW_MODES.WINDOW, { skipSave: true });
    let refreshed = null;
    try { refreshed = await refreshAll(); } catch {}
    const liveUsage = refreshed?.usage || state.usage;
    if (state.auth.state === "signedIn") {
      requireValue(liveUsage?.limitId === "codex", "实时额度读取失败");
      requireValue(liveUsage?.source !== "codex-session", "错误地使用了会话快照冒充实时额度");
      requireValue(Array.isArray(liveUsage?.limits) && liveUsage.limits.length >= 1, "官方额度窗口没有被识别");
      requireValue(Number.isFinite(liveUsage?.resetCredits?.availableCount), "重置次数仍是未知值");
      record("live-usage", {
        source: liveUsage.source,
        limits: liveUsage.limits.map((limit) => ({ kind: limit.kind, remainingPercent: limit.remainingPercent, windowDurationMins: limit.windowDurationMins })),
        resetCount: liveUsage.resetCredits.availableCount,
        resetItemCount: liveUsage.resetCredits.items.length,
      });
    } else {
      requireValue(!state.usage, "未认证时不应显示旧会话额度");
      record("auth-required-no-fake-usage");
    }

    const controlDom = await dashboardWindow.webContents.executeJavaScript(`({
      account: document.getElementById('account-email').textContent,
      threadCount: document.getElementById('thread-select').options.length,
      modelCount: document.getElementById('model-select').options.length,
      permissionCount: document.getElementById('permission-select').options.length,
      compactEnabled: !document.getElementById('compact-button').disabled,
      resetCount: document.getElementById('reset-count').textContent,
      resetDetails: document.getElementById('reset-list').textContent,
      resetRows: document.querySelectorAll('.reset-item').length,
      visibleLimits: [...document.querySelectorAll('.limit-row')].filter((row) => getComputedStyle(row).display !== 'none').map((row) => row.textContent),
      connectVisible: !document.getElementById('connect-account-button').hidden,
      purchaseContent: document.body.textContent.includes('升级套餐') || document.body.textContent.includes('添加额度')
    })`);
    if (liveUsage) {
      requireValue(controlDom.resetCount.includes(String(liveUsage.resetCredits.availableCount)), "重置次数没有正确渲染到界面");
      requireValue(liveUsage.resetCredits.items.length === 0 || controlDom.resetDetails.includes(liveUsage.resetCredits.items[0].title), "单次重置详情没有渲染");
      requireValue(controlDom.resetRows === liveUsage.resetCredits.items.length, "单次重置详情数量与官方接口不一致");
      requireValue(controlDom.visibleLimits.length === liveUsage.limits.length, "界面显示了不存在的额度窗口");
      requireValue(liveUsage.limits.every((limit) => controlDom.visibleLimits.some((text) => text.includes(String(limit.remainingPercent)))), "额度窗口剩余量与官方接口不一致");
    } else requireValue(controlDom.connectVisible, "认证失效时没有显示连接账户入口");
    requireValue(!controlDom.purchaseContent, "仍残留购买额度内容");
    record("account-context-controls", controlDom);

    await dashboardWindow.webContents.executeJavaScript("window.dashboardApi.setPreferences({locale:'zh-CN',surface:'codex'})");
    await waitForCondition(() => state.preferences.locale === "zh-CN" && state.preferences.surface === "codex");
    await dashboardWindow.webContents.executeJavaScript("document.getElementById('language-button').click()");
    await waitForCondition(() => state.preferences.locale === "en");
    const englishUi = await dashboardWindow.webContents.executeJavaScript(`({
      title: document.querySelector('h1').textContent,
      usage: document.querySelector('.usage-card h2').textContent,
      languageButton: document.getElementById('language-button').textContent
    })`);
    requireValue(englishUi.title === "ChatGPT Console" && englishUi.usage === "Codex usage" && englishUi.languageButton === "中", "英文界面切换失败");

    await dashboardWindow.webContents.executeJavaScript("document.querySelector('[data-surface=work]').click()");
    await waitForCondition(() => state.preferences.surface === "work");
    const workUi = await dashboardWindow.webContents.executeJavaScript(`({
      surface: document.body.dataset.surface,
      reasoningLabel: document.getElementById('reasoning-label').textContent,
      controlsVisible: getComputedStyle(document.querySelector('[data-codex-controls]')).display !== 'none'
    })`);
    requireValue(workUi.surface === "work" && workUi.reasoningLabel === "Power" && workUi.controlsVisible, "Work 模式适配失败");
    const workScreenshotPath = path.join(path.dirname(outputPath), "dashboard-work-en.png");
    fs.writeFileSync(workScreenshotPath, (await dashboardWindow.webContents.capturePage()).toPNG());

    await dashboardWindow.webContents.executeJavaScript("document.querySelector('[data-surface=chat]').click()");
    await waitForCondition(() => state.preferences.surface === "chat");
    const chatUi = await dashboardWindow.webContents.executeJavaScript(`({
      surface: document.body.dataset.surface,
      controlsHidden: getComputedStyle(document.querySelector('[data-codex-controls]')).display === 'none',
      description: document.getElementById('surface-description').textContent
    })`);
    requireValue(chatUi.surface === "chat" && chatUi.controlsHidden && chatUi.description.includes("Classic Chat"), "Chat 模式边界展示失败");

    await dashboardWindow.webContents.executeJavaScript("document.querySelector('[data-surface=codex]').click(); document.getElementById('language-button').click()");
    await waitForCondition(() => state.preferences.surface === "codex" && state.preferences.locale === "zh-CN");
    await waitForCondition(() => state.host.detected);
    if (state.host.appName === "ChatGPT") {
      requireValue(state.host.integratedChatGpt && state.host.surfaces?.length === 3, "未识别集成版 ChatGPT 宿主");
    } else {
      requireValue(state.host.appName === "Codex" && state.host.surfaces?.includes("codex"), "未识别 Codex 宿主");
    }
    record("bilingual-chatgpt-surfaces", { englishUi, workUi, chatUi, host: state.host, workScreenshotPath });

    const bodyBackground = await dashboardWindow.webContents.executeJavaScript(
      "getComputedStyle(document.body).backgroundColor",
    );
    requireValue(bodyBackground === "rgb(251, 251, 252)", `主窗口背景不是不透明色: ${bodyBackground}`);
    record("opaque-window", { bodyBackground });

    await applyWindowMode(WINDOW_MODES.WINDOW);
    const pinBefore = dashboardWindow.isAlwaysOnTop();
    await dashboardWindow.webContents.executeJavaScript("document.getElementById('pin-button').click()");
    await waitForCondition(() => dashboardWindow.isAlwaysOnTop() !== pinBefore);
    requireValue(state.mode === WINDOW_MODES.WINDOW, "置顶按钮不应改变窗口模式");
    record("independent-always-on-top", { before: pinBefore, after: dashboardWindow.isAlwaysOnTop() });

    await dashboardWindow.webContents.executeJavaScript("document.getElementById('layer-button').click()");
    await waitForCondition(() => dashboardWindow.isMaximized());
    await dashboardWindow.webContents.executeJavaScript("document.getElementById('layer-button').click()");
    await waitForCondition(() => !dashboardWindow.isMaximized());
    record("maximize-restore-button");

    await dashboardWindow.webContents.executeJavaScript("document.getElementById('floating-button').click()");
    await waitForCondition(() => state.mode === WINDOW_MODES.FLOATING && ballWindow.isVisible());
    if (!liveUsage) {
      const previewUsage = {
        limits: [{
          kind: "weekly",
          slot: "primary",
          usedPercent: 4,
          remainingPercent: 96,
          windowDurationMins: 10_080,
          resetsAt: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        }],
      };
      dashboardWindow.webContents.send("dashboard:usage", previewUsage);
      ballWindow.webContents.send("dashboard:usage", previewUsage);
      await waitForCondition(() => ballWindow.webContents.executeJavaScript("document.getElementById('ball-percent').textContent === '96%'"));
    }
    const ballDom = await ballWindow.webContents.executeJavaScript(`({
      ringCount: document.querySelectorAll('.ball-ring circle').length,
      ringOffset: document.getElementById('ball-ring-progress').style.strokeDashoffset,
      label: document.getElementById('ball-label').textContent,
      reset: document.getElementById('ball-reset').textContent,
      dragThreshold: window.pointerGesture?.BALL_DRAG_THRESHOLD_PX,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      shell: (() => { const rect = document.getElementById('floating-ball').getBoundingClientRect(); return { width: rect.width, height: rect.height }; })()
    })`);
    requireValue(ballDom.shell.width === BALL_WINDOW_SIZE && ballDom.shell.height === BALL_WINDOW_SIZE, `悬浮球视觉尺寸错误: ${JSON.stringify(ballDom)}`);
    requireValue(ballDom.ringCount === 2 && ballDom.ringOffset !== "", "悬浮球额度圆环没有渲染");
    requireValue(ballDom.dragThreshold === 8, `悬浮球拖动阈值没有加载: ${JSON.stringify(ballDom)}`);
    requireValue(ballDom.label.includes("周") === (liveUsage?.limits || [{ kind: "weekly" }]).some((limit) => limit.kind === "weekly"), "悬浮球额度类型错误");
    const ballScreenshotPath = path.join(path.dirname(outputPath), "floating-ball.png");
    const ballScreenshot = await ballWindow.webContents.capturePage();
    const ballBitmap = ballScreenshot.toBitmap();
    const ballBitmapSize = ballScreenshot.getSize();
    const cornerAlphas = [
      [0, 0],
      [ballBitmapSize.width - 1, 0],
      [0, ballBitmapSize.height - 1],
      [ballBitmapSize.width - 1, ballBitmapSize.height - 1],
    ].map(([x, y]) => ballBitmap[(y * ballBitmapSize.width + x) * 4 + 3]);
    requireValue(cornerAlphas.every((alpha) => alpha <= 8), `悬浮球窗口四角不是透明的: ${JSON.stringify(cornerAlphas)}`);
    fs.writeFileSync(ballScreenshotPath, ballScreenshot.toPNG());

    const ballBeforeDrag = ballWindow.getBounds();
    const ballWorkArea = screen.getDisplayMatching(ballBeforeDrag).workArea;
    const dragX = ballBeforeDrag.x + ballBeforeDrag.width / 2 < ballWorkArea.x + ballWorkArea.width / 2 ? 32 : -32;
    const dragY = ballBeforeDrag.y + BALL_WINDOW_SIZE + 52 < ballWorkArea.y + ballWorkArea.height ? 44 : -44;
    await ballWindow.webContents.executeJavaScript(`
      window.dashboardApi.beginWindowAction({action:'move-ball',screenX:400,screenY:400});
      window.dashboardApi.updateWindowAction({screenX:${400 + dragX},screenY:${400 + dragY}});
      window.dashboardApi.endWindowAction();
    `);
    const expectedSnapped = snapFloatingBounds({ ...ballBeforeDrag, x: ballBeforeDrag.x + dragX, y: ballBeforeDrag.y + dragY }, ballWorkArea);
    await waitForCondition(() => {
      const bounds = ballWindow.getBounds();
      return Math.abs(bounds.x - expectedSnapped.x) <= 2 && Math.abs(bounds.y - expectedSnapped.y) <= 2;
    });
    const ballAfterDrag = ballWindow.getBounds();
    requireValue(Math.abs(ballAfterDrag.x - expectedSnapped.x) <= 2 && Math.abs(ballAfterDrag.y - expectedSnapped.y) <= 2, `悬浮球拖动后没有吸附到屏幕边缘: ${JSON.stringify({ ballBeforeDrag, expectedSnapped, ballAfterDrag })}`);
    record("floating-ball", { before: ballBeforeDrag, after: ballAfterDrag, renderer: ballDom, cornerAlphas, screenshotPath: ballScreenshotPath });

    await ballWindow.webContents.executeJavaScript("document.getElementById('ball-open').click()");
    await waitForCondition(() => state.mode === WINDOW_MODES.WINDOW && dashboardWindow.isVisible());
    record("floating-ball-restore");

    await applyWindowMode(WINDOW_MODES.WINDOW);
    await dashboardWindow.webContents.executeJavaScript("document.getElementById('minimize-button').click()");
    await waitForCondition(() => dashboardWindow.isMinimized());
    record("minimize-button");

    await applyWindowMode(WINDOW_MODES.WINDOW);
    const defaultBounds = dashboardWindow.getBounds();
    const dragRegions = await dashboardWindow.webContents.executeJavaScript(`({
      titlebar: getComputedStyle(document.getElementById('drag-region')).getPropertyValue('-webkit-app-region'),
      controls: getComputedStyle(document.querySelector('.window-controls')).getPropertyValue('-webkit-app-region')
    })`);
    requireValue(dragRegions.titlebar === "drag", "The title bar is not using native window dragging");
    requireValue(dragRegions.controls === "no-drag", "Window controls are inside the native drag region");
    requireValue(JSON.stringify(dashboardWindow.getBounds()) === JSON.stringify(defaultBounds), "Native drag setup changed the window size");
    record("native-drag-region", { bounds: defaultBounds, dragRegions });

    const beforeResize = dashboardWindow.getBounds();
    await dashboardWindow.webContents.executeJavaScript(
      `window.dashboardApi.beginWindowAction({action:'resize',edge:'se',screenX:300,screenY:300});
       window.dashboardApi.updateWindowAction({screenX:348,screenY:356});
       window.dashboardApi.endWindowAction();`,
    );
    await waitForCondition(() => {
      const bounds = dashboardWindow.getBounds();
      return bounds.width >= beforeResize.width + 44 && bounds.height >= beforeResize.height + 52;
    });
    record("manual-resize", { before: beforeResize, after: dashboardWindow.getBounds() });

    const removedControls = await dashboardWindow.webContents.executeJavaScript(`({
      defaultSize: document.getElementById('default-size-button'),
      desktopMode: document.querySelector('[data-mode=desktop]')
    })`);
    requireValue(!removedControls.defaultSize && !removedControls.desktopMode, "已取消的尺寸或桌面固定控件仍然存在");
    record("removed-default-size-and-desktop-mode");

    const screenshot = await dashboardWindow.webContents.capturePage();
    const screenshotPath = path.join(path.dirname(outputPath), "dashboard-renderer.png");
    fs.writeFileSync(screenshotPath, screenshot.toPNG());
    record("renderer-screenshot", { screenshotPath });

    await dashboardWindow.webContents.executeJavaScript("document.getElementById('close-button').click()");
    await waitForCondition(() => !dashboardWindow.isVisible());
    record("close-to-tray");

    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error.stack || error.message;
  }

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  setTimeout(() => void quitApplication(), 200);
}

function registerIpc() {
  ipcMain.handle("dashboard:get-initial-state", () => ({ ...state }));
  ipcMain.handle("dashboard:set-preferences", (_event, patch) => {
    if (patch.locale !== undefined) {
      if (!["zh-CN", "en"].includes(patch.locale)) throw new Error("Unsupported locale");
      state.preferences.locale = patch.locale;
    }
    if (patch.surface !== undefined) {
      if (!["codex", "work", "chat"].includes(patch.surface)) throw new Error("Unsupported surface");
      state.preferences.surface = patch.surface;
    }
    writeSettings();
    broadcast("dashboard:preferences", state.preferences);
    tray?.destroy();
    createTray();
    return state.preferences;
  });
  ipcMain.handle("dashboard:refresh", () => refreshAll());
  ipcMain.handle("dashboard:refresh-all", () => refreshAll());
  ipcMain.handle("dashboard:connect-account", () => connectChatGptAccount());
  ipcMain.handle("dashboard:select-thread", async (_event, threadId) => {
    state.control = await controlService.selectThread(threadId);
    broadcast("dashboard:control", state.control);
    return state.control;
  });
  ipcMain.handle("dashboard:update-control", async (_event, payload) => {
    updateStatus({ state: "refreshing", message: "正在应用设置…", error: null });
    try {
      state.control = await controlService.updateSetting(payload.kind, payload.value);
      broadcast("dashboard:control", state.control);
      updateStatus({ state: "live", message: "设置已应用", error: null, lastSuccessfulAt: Date.now() });
      return state.control;
    } catch (error) {
      updateStatus({ state: "error", message: "设置失败", error: error.message });
      throw error;
    }
  });
  ipcMain.handle("dashboard:compact-context", async () => {
    updateStatus({ state: "refreshing", message: "正在压缩对话上下文…", error: null });
    try {
      const result = await controlService.compactSelectedThread();
      updateStatus({ state: "live", message: "上下文压缩已启动", error: null, lastSuccessfulAt: Date.now() });
      setTimeout(() => refreshControl().catch(() => {}), 2_000);
      return result;
    } catch (error) {
      updateStatus({ state: "error", message: "压缩失败", error: error.message });
      throw error;
    }
  });
  ipcMain.handle("dashboard:set-goal", async (_event, payload) => {
    state.control = await controlService.setGoal(Boolean(payload.enabled), payload.objective);
    broadcast("dashboard:control", state.control);
    return state.control;
  });
  ipcMain.on("dashboard:window-action-begin", (_event, payload) => beginWindowPointerAction(payload));
  ipcMain.on("dashboard:window-action-update", (_event, payload) => updateWindowPointerAction(payload));
  ipcMain.on("dashboard:window-action-end", () => endWindowPointerAction());
  ipcMain.handle("dashboard:set-mode", (_event, mode) => applyWindowMode(mode));
  ipcMain.handle("dashboard:toggle-pinned", () => togglePinned());
  ipcMain.handle("dashboard:toggle-floating", () => toggleFloating());
  ipcMain.handle("dashboard:toggle-maximized", () => toggleMaximized());
  ipcMain.handle("dashboard:open-chatgpt", () => openChatGpt());
  ipcMain.handle("dashboard:minimize", async () => {
    dashboardWindow.minimize();
    return diagnostics();
  });
  ipcMain.handle("dashboard:hide", () => hideDashboard());
  ipcMain.handle("dashboard:restore-from-ball", () => applyWindowMode(WINDOW_MODES.WINDOW));
  ipcMain.handle("dashboard:get-diagnostics", () => diagnostics());
  ipcMain.handle("dashboard:quit-for-test", () => {
    if (!isTestMode) throw new Error("该操作仅供自动测试使用");
    setTimeout(() => void quitApplication(), 100);
    return true;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showDashboard());
  app.whenReady().then(async () => {
    if (process.platform === "darwin") {
      isBackgroundLaunch ||= Boolean(app.getLoginItemSettings({ type: "mainAppService" }).wasOpenedAtLogin);
    }
    readSettings();
    state.host = { ...state.host, ...detectIntegratedChatGpt() };
    queryIntegratedChatGptPackage().then((host) => {
      if (host) updateHost(host);
    });
    dashboardWindow = createDashboardWindow();
    ballWindow = createBallWindow();
    createTray();
    registerIpc();

    if (app.isPackaged && !isTestMode) {
      enableLoginItem();
    }

    startHostWatcher();
    const usageStartPromise = startUsageService();
    setInterval(() => refreshUsage().catch(() => {}), 30_000).unref();
    setInterval(() => refreshControl().catch(() => {}), 60_000).unref();

    if (!isBackgroundLaunch) await applyWindowMode(state.mode, { skipSave: true });
    if (isTestMode && selfTestOutputArg) {
      await usageStartPromise;
      await runSelfTest(selfTestOutputArg.slice("--self-test-output=".length));
    }
  });
}

app.on("activate", () => showDashboard());

app.on("before-quit", async () => {
  quitting = true;
  watcher?.stop();
  usageClient?.stop();
  clearTimeout(reconnectTimer);
  clearTimeout(refreshTimer);
});

app.on("window-all-closed", (event) => event?.preventDefault?.());
