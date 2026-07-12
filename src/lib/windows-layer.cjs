const { execFile } = require("node:child_process");

function nativeWindowHandle(browserWindow) {
  const handle = browserWindow.getNativeWindowHandle();
  if (handle.length >= 8) return handle.readBigUInt64LE(0).toString();
  return String(handle.readUInt32LE(0));
}

function invokeWindowsLayer(scriptPath, handle, mode, exec = execFile) {
  return new Promise((resolve, reject) => {
    exec(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-Handle",
        String(handle),
        "-Mode",
        mode,
      ],
      { windowsHide: true, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || stdout || error.message).trim()));
          return;
        }
        const line = stdout.trim().split(/\r?\n/).at(-1);
        try {
          resolve(JSON.parse(line));
        } catch {
          reject(new Error(`无法读取窗口层级结果: ${line}`));
        }
      },
    );
  });
}

module.exports = { invokeWindowsLayer, nativeWindowHandle };
