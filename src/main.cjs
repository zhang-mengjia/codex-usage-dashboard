const fs = require("node:fs");
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
const { CodexControlService, readCachedResetCredits, readLatestRateLimits } = require("./lib/codex-control.cjs");
const { detectIntegratedChatGpt, queryIntegratedChatGptPackage } = require("./lib/chatgpt-host.cjs");
const { HostProcessWatcher } = require("./lib/process-watcher.cjs");
const {
  applyMacDesktopLayer,
  clearMacWindowLayer,
  isVisibleOnAllWorkspaces,
  setMacFloatingLayer,
} = require("./lib/platform-window.cjs");
const { normalizeRateLimits } = require("./lib/usage-model.cjs");
const { WINDOW_MODES, isWindowMode, snapFloatingBounds } = require("./lib/window-modes.cjs");
const { invokeWindowsLayer, nativeWindowHandle } = require("./lib/windows-layer.cjs");

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
let snapTimer = null;
let quitting = false;
let dashboardHasBeenShown = false;
let desktopLayerActive = false;
let skipTaskbar = false;
let lastNativeLayer = null;
let pointerSession = null;

const DEFAULT_WINDOW_SIZE = Object.freeze({ width: 640, height: 820 });
const MIN_WINDOW_SIZE = Object.freeze({ width: 520, height: 620 });

const state = {
  platform: process.platform,
  mode: WINDOW_MODES.WINDOW,
  preferences: { locale: "zh-CN", surface: "codex" },
  usage: null,
  control: null,
  host: { detected: false, processName: null },
  status: {
    state: "connecting",
    message: "正在连接 Codex…",
    error: null,
    lastSuccessfulAt: null,
  },
};

function rendererPath() {
  return path.join(__dirname, "renderer", "index.html");
}

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function layerScriptPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "windows-layer.ps1")
    : path.join(__dirname, "..", "resources", "windows-layer.ps1");
}

function iconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "..", "resources", "icon.png");
}

function readSettings() {
  try {
    const value = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    if ((value.version === 2 || value.version === 3) && isWindowMode(value.mode)) {
      state.mode = value.mode;
      if (["zh-CN", "en"].includes(value.locale)) state.preferences.locale = value.locale;
      if (["codex", "work", "chat"].includes(value.surface)) state.preferences.surface = value.surface;
      if (value.version !== 3) writeSettings();
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
      version: 3,
      mode: state.mode,
      locale: state.preferences.locale,
      surface: state.preferences.surface,
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
    maxWidth: 960,
    maxHeight: 1080,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: "#fbfbfc",
    roundedCorners: true,
    shadow: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
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
  window.on("restore", () => window.webContents.send("dashboard:mode", state.mode));
  window.webContents.on("did-finish-load", () => {
    window.webContents.send("dashboard:usage", state.usage);
    window.webContents.send("dashboard:control", state.control);
    window.webContents.send("dashboard:status", state.status);
    window.webContents.send("dashboard:mode", state.mode);
    window.webContents.send("dashboard:host", state.host);
    window.webContents.send("dashboard:preferences", state.preferences);
  });
  return window;
}

function createBallWindow() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const window = new BrowserWindow({
    width: 78,
    height: 78,
    x: workArea.x + workArea.width - 86,
    y: workArea.y + Math.round(workArea.height * 0.32),
    show: false,
    frame: false,
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
  window.on("moved", () => {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => snapBallToEdge(), 180);
  });
  window.webContents.on("did-finish-load", () => {
    window.webContents.send("dashboard:usage", state.usage);
    window.webContents.send("dashboard:status", state.status);
    window.webContents.send("dashboard:mode", state.mode);
    window.webContents.send("dashboard:preferences", state.preferences);
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
      {
        label: english ? "Window mode" : "窗口模式",
        submenu: [
          { label: english ? "Always on top" : "置顶显示", click: () => applyWindowMode(WINDOW_MODES.TOP) },
          { label: english ? "Pin to desktop" : "固定在桌面", click: () => applyWindowMode(WINDOW_MODES.DESKTOP) },
          { label: english ? "Regular window" : "普通窗口", click: () => applyWindowMode(WINDOW_MODES.WINDOW) },
          { label: english ? "Floating ball" : "悬浮球", click: () => applyWindowMode(WINDOW_MODES.FLOATING) },
        ],
      },
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

async function runNativeLayer(mode) {
  if (process.platform !== "win32" || !dashboardWindow) return null;
  const result = await invokeWindowsLayer(
    layerScriptPath(),
    nativeWindowHandle(dashboardWindow),
    mode,
  );
  lastNativeLayer = result;
  desktopLayerActive = mode === "desktop" && result.parentHandle !== "0";
  return result;
}

async function refreshDesktop() {
  if (process.platform !== "win32") return;
  try {
    await invokeWindowsLayer(layerScriptPath(), "0", "refresh");
  } catch {
    // Desktop redraw is best-effort cleanup.
  }
}

async function attachNativeDesktopLayer() {
  await runNativeLayer("desktop");
  if (desktopLayerActive) return;
  await refreshDesktop();
  await new Promise((resolve) => setTimeout(resolve, 160));
  await runNativeLayer("desktop");
  if (!desktopLayerActive) throw new Error("Windows 桌面层暂时不可用");
}

async function restoreNativeLayer() {
  if (!desktopLayerActive) return;
  if (process.platform === "win32") await runNativeLayer("normal");
  else if (process.platform === "darwin") clearMacWindowLayer(dashboardWindow);
  desktopLayerActive = false;
}

async function hideDashboard() {
  if (!dashboardWindow || dashboardWindow.isDestroyed()) return true;
  if (desktopLayerActive || state.mode === WINDOW_MODES.DESKTOP) {
    await restoreNativeLayer();
    state.mode = WINDOW_MODES.WINDOW;
    writeSettings();
    broadcast("dashboard:mode", state.mode);
    await refreshDesktop();
  }
  dashboardWindow.hide();
  return true;
}

async function quitApplication() {
  if (desktopLayerActive) await restoreNativeLayer();
  await refreshDesktop();
  quitting = true;
  app.quit();
}

async function applyWindowMode(mode, options = {}) {
  if (!isWindowMode(mode)) throw new Error(`未知窗口模式: ${mode}`);
  await restoreNativeLayer();
  state.mode = mode;
  if (!options.skipSave) writeSettings();

  clearMacWindowLayer(dashboardWindow);
  setMacFloatingLayer(ballWindow, false);
  ballWindow.hide();
  dashboardWindow.setResizable(true);
  dashboardWindow.setFocusable(true);
  dashboardWindow.setAlwaysOnTop(false);
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
    if (mode === WINDOW_MODES.TOP) {
      dashboardWindow.setAlwaysOnTop(true, "floating");
    } else if (mode === WINDOW_MODES.DESKTOP) {
      dashboardWindow.setSkipTaskbar(true);
      skipTaskbar = true;
      if (process.platform === "darwin") {
        desktopLayerActive = applyMacDesktopLayer(dashboardWindow);
      }
    }
    if (mode === WINDOW_MODES.DESKTOP && process.platform === "darwin") dashboardWindow.showInactive();
    else {
      dashboardWindow.show();
      dashboardWindow.focus();
    }
    dashboardHasBeenShown = true;
    if (mode === WINDOW_MODES.DESKTOP && process.platform === "win32") {
      try {
        await attachNativeDesktopLayer();
      } catch (error) {
        updateStatus({
          state: "warning",
          message: "桌面层降级为普通窗口",
          error: error.message,
        });
      }
    }
  }
  broadcast("dashboard:mode", state.mode);
  return diagnostics();
}

function snapBallToEdge() {
  if (!ballWindow || ballWindow.isDestroyed() || !ballWindow.isVisible()) return;
  const bounds = ballWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const snapped = snapFloatingBounds(bounds, display.workArea);
  if (snapped.x !== bounds.x || snapped.y !== bounds.y) {
    ballWindow.setBounds(snapped, true);
  }
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
    updateStatus({
      state: "live",
      message: "实时更新",
      error: null,
      lastSuccessfulAt: state.usage.updatedAt,
    });
    broadcast("dashboard:usage", state.usage);
    return state.usage;
  } catch (error) {
    const fallback = readLatestRateLimits(state.control?.context?.path);
    if (fallback) {
      const resetCredits = readCachedResetCredits();
      if (resetCredits) fallback.rateLimitResetCredits = resetCredits;
      state.usage = normalizeRateLimits(fallback);
      updateStatus({
        state: "warning",
        message: "已从当前会话同步额度",
        error: `实时接口暂不可用：${error.message}`,
        lastSuccessfulAt: state.usage.updatedAt,
      });
      broadcast("dashboard:usage", state.usage);
      return state.usage;
    }
    updateStatus({ state: "error", message: "暂时无法更新", error: error.message });
    scheduleReconnect();
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
    const control = await refreshControl();
    const usage = await refreshUsage();
    const isSessionFallback = usage?.source === "codex-session";
    updateStatus({
      state: isSessionFallback ? "warning" : "live",
      message: isSessionFallback ? "已从当前会话同步额度" : "实时更新",
      error: isSessionFallback ? state.status.error : null,
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
  usageClient = new CodexAppServerClient();
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
  try {
    await usageClient.start();
    await refreshControl();
    await refreshUsage();
  } catch (error) {
    updateStatus({ state: "error", message: "无法连接 Codex", error: error.message });
    usageClient?.stop();
    usageClient = null;
    controlService = null;
    scheduleReconnect();
  }
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
  let nativeLayer = lastNativeLayer;
  if (dashboardWindow && process.platform === "win32") {
    try {
      nativeLayer = await invokeWindowsLayer(
        layerScriptPath(),
        nativeWindowHandle(dashboardWindow),
        "query",
      );
    } catch {
      // Keep the last successful native layer result.
    }
  }
  return {
    mode: state.mode,
    platform: process.platform,
    desktopLayerActive,
    nativeLayer,
    main: dashboardWindow
      ? {
          visible: dashboardWindow.isVisible(),
          minimized: dashboardWindow.isMinimized(),
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
    host: state.host,
  };
}

function restoreDefaultSize() {
  if (!dashboardWindow || dashboardWindow.isDestroyed()) return null;
  const display = screen.getDisplayMatching(dashboardWindow.getBounds());
  const width = Math.min(DEFAULT_WINDOW_SIZE.width, display.workArea.width);
  const height = Math.min(DEFAULT_WINDOW_SIZE.height, display.workArea.height);
  const bounds = {
    x: Math.round(display.workArea.x + (display.workArea.width - width) / 2),
    y: Math.round(display.workArea.y + (display.workArea.height - height) / 2),
    width,
    height,
  };
  dashboardWindow.setBounds(bounds, true);
  return bounds;
}

function beginWindowPointerAction(payload) {
  if (!dashboardWindow || dashboardWindow.isDestroyed()) return;
  const edge = String(payload?.edge || "").toLowerCase();
  if (!/^(n|s|e|w|ne|nw|se|sw)$/.test(edge)) return;
  pointerSession = {
    edge,
    startX: Number(payload.screenX),
    startY: Number(payload.screenY),
    bounds: dashboardWindow.getBounds(),
  };
}

function updateWindowPointerAction(payload) {
  if (!pointerSession || !dashboardWindow || dashboardWindow.isDestroyed()) return;
  const deltaX = Number(payload.screenX) - pointerSession.startX;
  const deltaY = Number(payload.screenY) - pointerSession.startY;
  const initial = pointerSession.bounds;
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
    const refreshed = await refreshAll();
    const liveUsage = refreshed.usage;
    requireValue(liveUsage?.limitId === "codex", "实时额度读取失败");
    requireValue(Number.isFinite(liveUsage?.resetCredits?.availableCount), "重置次数仍是未知值");
    record("live-usage", {
      source: liveUsage.source,
      primaryRemaining: liveUsage.primary?.remainingPercent,
      secondaryRemaining: liveUsage.secondary?.remainingPercent,
      resetCount: liveUsage.resetCredits.availableCount,
      resetCountSource: liveUsage.resetCredits.source,
    });

    requireValue(state.control?.account?.email, "账户信息读取失败");
    requireValue(state.control?.context?.tokenUsage?.contextWindow > 0, "对话上下文读取失败");
    requireValue(state.control?.catalog?.models?.length > 0, "模型列表读取失败");
    requireValue(state.control?.catalog?.permissions?.length > 0, "权限列表读取失败");
    const controlDom = await dashboardWindow.webContents.executeJavaScript(`({
      account: document.getElementById('account-email').textContent,
      threadCount: document.getElementById('thread-select').options.length,
      modelCount: document.getElementById('model-select').options.length,
      permissionCount: document.getElementById('permission-select').options.length,
      compactEnabled: !document.getElementById('compact-button').disabled,
      resetCount: document.getElementById('reset-count').textContent,
      resetDetails: document.getElementById('reset-list').textContent,
      purchaseContent: document.body.textContent.includes('升级套餐') || document.body.textContent.includes('添加额度')
    })`);
    requireValue(controlDom.account.includes("@"), "账户没有渲染到界面");
    requireValue(controlDom.threadCount > 0 && controlDom.modelCount > 0 && controlDom.permissionCount > 0, "控制选项没有渲染到界面");
    requireValue(controlDom.compactEnabled, "一键压缩按钮不可用");
    requireValue(controlDom.resetCount.includes(String(liveUsage.resetCredits.availableCount)), "重置次数没有正确渲染到界面");
    requireValue(controlDom.resetDetails.includes(String(liveUsage.resetCredits.availableCount)), "重置次数详情与徽标不一致");
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
    await dashboardWindow.webContents.executeJavaScript(
      "document.getElementById('layer-button').click(); document.querySelector('[data-mode=top]').click()",
    );
    await waitForCondition(() => state.mode === WINDOW_MODES.TOP && dashboardWindow.isAlwaysOnTop());
    record("always-on-top-ui");

    await dashboardWindow.webContents.executeJavaScript(
      "document.getElementById('layer-button').click(); document.querySelector('[data-mode=desktop]').click()",
    );
    await waitForCondition(() => state.mode === WINDOW_MODES.DESKTOP && desktopLayerActive);
    let diag = await diagnostics();
    if (process.platform === "win32") {
      requireValue(diag.nativeLayer?.parentHandle !== "0", "桌面层未绑定");
      requireValue(diag.nativeLayer?.acceptsHit === true, "桌面模式窗口未接收原生命中测试");
      record("desktop-layer-clickable", { nativeLayer: diag.nativeLayer });
    } else {
      requireValue(diag.main?.visibleOnAllWorkspaces === true, "macOS 桌面模式未显示在所有桌面空间");
      requireValue(diag.main?.alwaysOnTop === false, "macOS 桌面模式不应覆盖普通应用窗口");
      record("desktop-spaces-mode", { main: diag.main });
    }

    await dashboardWindow.webContents.executeJavaScript("document.getElementById('close-button').click()");
    await waitForCondition(() => !dashboardWindow.isVisible() && state.mode === WINDOW_MODES.WINDOW && !desktopLayerActive);
    diag = await diagnostics();
    if (process.platform === "win32") requireValue(diag.nativeLayer?.parentHandle === "0", "隐藏后仍残留桌面父级");
    else requireValue(diag.main?.visibleOnAllWorkspaces === false, "隐藏后仍残留 macOS 全桌面层");
    record("desktop-close-cleanup", process.platform === "win32" ? { nativeLayer: diag.nativeLayer } : { main: diag.main });

    await applyWindowMode(WINDOW_MODES.TOP);
    await dashboardWindow.webContents.executeJavaScript(
      "document.getElementById('layer-button').click(); document.querySelector('[data-mode=floating]').click()",
    );
    await waitForCondition(() => state.mode === WINDOW_MODES.FLOATING && ballWindow.isVisible());
    record("floating-ball", { bounds: ballWindow.getBounds() });

    await ballWindow.webContents.executeJavaScript("document.getElementById('ball-open').click()");
    await waitForCondition(() => state.mode === WINDOW_MODES.TOP && dashboardWindow.isVisible());
    record("floating-ball-restore");

    await applyWindowMode(WINDOW_MODES.WINDOW);
    await dashboardWindow.webContents.executeJavaScript("document.getElementById('minimize-button').click()");
    await waitForCondition(() => dashboardWindow.isMinimized());
    record("minimize-button");

    await applyWindowMode(WINDOW_MODES.WINDOW);
    restoreDefaultSize();
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

    await dashboardWindow.webContents.executeJavaScript("document.getElementById('default-size-button').click()");
    await waitForCondition(() => {
      const bounds = dashboardWindow.getBounds();
      return Math.abs(bounds.width - DEFAULT_WINDOW_SIZE.width) <= 3
        && Math.abs(bounds.height - DEFAULT_WINDOW_SIZE.height) <= 3;
    });
    record("default-size-button", { bounds: dashboardWindow.getBounds() });

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
  ipcMain.handle("dashboard:restore-default-size", () => restoreDefaultSize());
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
  ipcMain.on("dashboard:window-action-end", () => {
    pointerSession = null;
  });
  ipcMain.handle("dashboard:set-mode", (_event, mode) => applyWindowMode(mode));
  ipcMain.handle("dashboard:open-chatgpt", () => openChatGpt());
  ipcMain.handle("dashboard:minimize", async () => {
    if (state.mode === WINDOW_MODES.DESKTOP) await hideDashboard();
    else dashboardWindow.minimize();
    return diagnostics();
  });
  ipcMain.handle("dashboard:hide", () => hideDashboard());
  ipcMain.handle("dashboard:restore-from-ball", () => applyWindowMode(WINDOW_MODES.TOP));
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
  if (desktopLayerActive) {
    try {
      await restoreNativeLayer();
    } catch {
      // The process is exiting; Windows will release the parent relationship.
    }
  }
  await refreshDesktop();
});

app.on("window-all-closed", (event) => event?.preventDefault?.());
