# Codex Usage Dashboard

[![CI](https://github.com/zhang-mengjia/codex-usage-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/zhang-mengjia/codex-usage-dashboard/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/zhang-mengjia/codex-usage-dashboard)](https://github.com/zhang-mengjia/codex-usage-dashboard/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

English | [简体中文](README.md)

An unofficial, open-source Windows and macOS desktop dashboard for monitoring Codex usage, context, and runtime settings from ChatGPT/Codex.

> This project is not affiliated with or endorsed by OpenAI. Codex, ChatGPT, and OpenAI are trademarks of their respective owners.

## Features

- Shows five-hour and weekly limits, reset times, and available reset credits.
- Shows the active account, recent conversations, context usage, and cached input.
- Provides Codex, Work, and Chat semantics in integrated ChatGPT; standalone Codex exposes only applicable Codex controls.
- Switches instantly between Chinese and English and remembers the choice.
- Displays and controls model, reasoning effort, speed, permissions, Plan mode, and Goal mode.
- Refreshes all data, compacts the selected conversation, and restores the default window size with one click.
- Supports always-on-top, desktop, normal-window, and edge-snapped floating-ball modes.
- Appears automatically when ChatGPT or Codex starts and remains available from the Windows tray or macOS menu bar.
- Contains no plan-upgrade, credit-purchase, or add-credit controls.

## Requirements

### Windows

- Windows 10/11 x64
- A signed-in ChatGPT/Codex desktop app or Codex CLI

### macOS

- Codex Usage Dashboard: macOS 12 or newer, universal Apple Silicon and Intel build
- The official ChatGPT macOS app currently requires macOS 14 and Apple Silicon (M1 or newer)
- Intel Macs can use the official Codex CLI, which provides an `x86_64-apple-darwin` build

## Download

Download one of the files from the [latest release](../../releases/latest):

- `Codex-Usage-Dashboard-Setup-*-x64.exe`: Windows installer.
- `Codex-Usage-Dashboard-Portable-*-x64.exe`: Windows portable executable.
- `Codex-Usage-Dashboard-*-macOS-universal.dmg`: universal macOS disk image.
- `Codex-Usage-Dashboard-*-macOS-universal.zip`: universal macOS archive.

Release binaries are not commercially code-signed:

- Windows SmartScreen may identify the publisher as unknown.
- On macOS, right-click the app in Finder and choose **Open** on first launch. If Gatekeeper still blocks it, first confirm that it came from this repository, then run:

```bash
xattr -dr com.apple.quarantine "/Applications/Codex 使用量.app"
```

Verify downloads with the release's `SHA256SUMS.txt`.

## Usage

1. Start and sign in to ChatGPT or Codex, or install and sign in with Codex CLI.
2. Start Codex Usage Dashboard.
3. In integrated ChatGPT, select the Codex, Work, or Chat surface at the top.
4. Use the window-layer menu for always-on-top, desktop, normal-window, or floating-ball behavior.
5. Runtime controls apply to the selected conversation; the UI states their scope.

The installed app registers a per-user login item but shows its main window only after a ChatGPT/Codex process is detected. Reopen or quit it from the Windows tray or macOS menu bar.

### macOS window semantics

- **Always on top**: stays above normal windows on the current Space.
- **Show on all Spaces**: follows every Space at normal window level without covering other apps.
- **Regular window**: standard movable, resizable, and minimizable window.
- **Floating ball**: follows every Space, including fullscreen Spaces, and snaps to a screen edge.

macOS has no Windows WorkerW desktop parent, so desktop mode uses the native all-Spaces equivalent described above.

## Data and privacy

- Most data and controls use the local `app-server` protocol shipped with ChatGPT/Codex.
- If the live quota endpoint is unavailable, the dashboard falls back to the latest local `token_count` event.
- If the official endpoint omits reset credits, the dashboard reads the current account's desktop cache. It shows `—` when the value cannot be determined instead of inventing zero.
- If the account endpoint omits profile data, the app only decodes the email and plan claims from the ID Token in the local `auth.json` file.
- The app does not read, copy, display, store, or upload access and refresh tokens.
- The app includes no telemetry, advertising, or remote analytics.

## Known limitations

- The project depends on local ChatGPT/Codex protocols and cache formats, which may change with official app updates.
- Chat mode only explains the account and Codex quota boundary; it does not control classic ChatGPT conversations.
- macOS binaries are not yet signed or notarized with an Apple Developer ID.

## Run from source

Node.js 22 or newer is required.

```bash
git clone https://github.com/zhang-mengjia/codex-usage-dashboard.git
cd codex-usage-dashboard
npm ci
npm test
npm start
```

With a signed-in local ChatGPT/Codex environment, also run `npm run test:live`.

## Build

Run the matching command on its native operating system:

```bash
npm run pack:win
npm run pack:mac
```

`pack:mac` creates universal DMG and ZIP artifacts containing both `arm64` and `x86_64`. Builds are written to `release/`. Run `npm run smoke` for the full desktop test on the current platform.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. Report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT License](LICENSE) © 2026 MENGJIA ZHANG
