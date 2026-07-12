function supportsMacWindowLayers(platform = process.platform) {
  return platform === "darwin";
}

function setWorkspaceVisibility(window, visible, options = {}) {
  const platform = options.platform || process.platform;
  if (!supportsMacWindowLayers(platform) || typeof window?.setVisibleOnAllWorkspaces !== "function") return false;
  if (typeof window.isVisibleOnAllWorkspaces === "function" && window.isVisibleOnAllWorkspaces() === Boolean(visible)) {
    return true;
  }
  window.setVisibleOnAllWorkspaces(Boolean(visible), {
    visibleOnFullScreen: Boolean(visible && options.visibleOnFullScreen),
  });
  if (typeof window.setHiddenInMissionControl === "function") {
    window.setHiddenInMissionControl(Boolean(visible));
  }
  return true;
}

function applyMacDesktopLayer(window, platform = process.platform) {
  if (!setWorkspaceVisibility(window, true, { platform, visibleOnFullScreen: false })) return false;
  window.setAlwaysOnTop(false);
  window.setSkipTaskbar(true);
  return true;
}

function clearMacWindowLayer(window, platform = process.platform) {
  return setWorkspaceVisibility(window, false, { platform });
}

function setMacFloatingLayer(window, enabled, platform = process.platform) {
  return setWorkspaceVisibility(window, enabled, { platform, visibleOnFullScreen: true });
}

function isVisibleOnAllWorkspaces(window, platform = process.platform) {
  if (!supportsMacWindowLayers(platform) || typeof window?.isVisibleOnAllWorkspaces !== "function") return false;
  return window.isVisibleOnAllWorkspaces();
}

module.exports = {
  applyMacDesktopLayer,
  clearMacWindowLayer,
  isVisibleOnAllWorkspaces,
  setMacFloatingLayer,
  setWorkspaceVisibility,
  supportsMacWindowLayers,
};
