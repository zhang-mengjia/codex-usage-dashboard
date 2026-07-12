const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("dashboardApi", {
  getInitialState: () => ipcRenderer.invoke("dashboard:get-initial-state"),
  setPreferences: (patch) => ipcRenderer.invoke("dashboard:set-preferences", patch),
  refresh: () => ipcRenderer.invoke("dashboard:refresh"),
  setMode: (mode) => ipcRenderer.invoke("dashboard:set-mode", mode),
  openChatGpt: () => ipcRenderer.invoke("dashboard:open-chatgpt"),
  minimize: () => ipcRenderer.invoke("dashboard:minimize"),
  hide: () => ipcRenderer.invoke("dashboard:hide"),
  restoreFromBall: () => ipcRenderer.invoke("dashboard:restore-from-ball"),
  getDiagnostics: () => ipcRenderer.invoke("dashboard:get-diagnostics"),
  restoreDefaultSize: () => ipcRenderer.invoke("dashboard:restore-default-size"),
  refreshAll: () => ipcRenderer.invoke("dashboard:refresh-all"),
  selectThread: (threadId) => ipcRenderer.invoke("dashboard:select-thread", threadId),
  updateControl: (kind, value) => ipcRenderer.invoke("dashboard:update-control", { kind, value }),
  compactContext: () => ipcRenderer.invoke("dashboard:compact-context"),
  setGoal: (enabled, objective) => ipcRenderer.invoke("dashboard:set-goal", { enabled, objective }),
  beginWindowAction: (payload) => ipcRenderer.send("dashboard:window-action-begin", payload),
  updateWindowAction: (payload) => ipcRenderer.send("dashboard:window-action-update", payload),
  endWindowAction: () => ipcRenderer.send("dashboard:window-action-end"),
  quitForTest: () => ipcRenderer.invoke("dashboard:quit-for-test"),
  onUsage: (callback) => subscribe("dashboard:usage", callback),
  onControl: (callback) => subscribe("dashboard:control", callback),
  onStatus: (callback) => subscribe("dashboard:status", callback),
  onMode: (callback) => subscribe("dashboard:mode", callback),
  onPreferences: (callback) => subscribe("dashboard:preferences", callback),
  onHost: (callback) => subscribe("dashboard:host", callback),
});
