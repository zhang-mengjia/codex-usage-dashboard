# Codex Usage Dashboard

English | [简体中文](README.md)

An unofficial, open-source Windows desktop dashboard for monitoring Codex usage, context, and runtime settings from the ChatGPT desktop app.

> This project is not affiliated with or endorsed by OpenAI. Codex, ChatGPT, and OpenAI are trademarks of their respective owners.

## Features

- Shows five-hour and weekly limits, reset times, and available reset credits.
- Shows the active account, recent conversations, context usage, and cached input.
- Adapts its presentation to the Codex, Work, and Chat surfaces in the ChatGPT desktop app.
- Switches instantly between Chinese and English and remembers the choice.
- Displays and controls model, reasoning effort, speed, permissions, Plan mode, and Goal mode.
- Refreshes all data, compacts the selected conversation, and restores the default window size with one click.
- Supports always-on-top, pinned-to-desktop, normal-window, and edge-snapped floating-ball modes.
- Appears automatically when ChatGPT or Codex starts and remains available from the system tray.
- Contains no plan-upgrade, credit-purchase, or add-credit controls.

## Requirements

- Windows 10/11 x64
- The latest signed-in ChatGPT desktop app with Codex, or the Codex desktop app/CLI

Only Windows x64 builds are currently provided.

## Download

Download one of the files from the [latest release](../../releases/latest):

- `Codex-Usage-Dashboard-Setup-*-x64.exe`: installer with Start Menu and desktop shortcuts plus per-user login startup.
- `Codex-Usage-Dashboard-Portable-*-x64.exe`: portable executable that requires no installation.

The binaries are not currently signed with a commercial code-signing certificate, so Windows SmartScreen may identify the publisher as unknown. Download only from this repository's Releases page and verify the SHA-256 checksums supplied with the release.

## How it works

1. Start and sign in to the ChatGPT desktop app.
2. Start Codex Usage Dashboard.
3. Select the Codex, Work, or Chat surface from the top of the dashboard.
4. Use the window-layer menu for always-on-top, desktop, normal-window, or floating-ball behavior.
5. Runtime controls apply to the selected conversation; the UI states their scope.

The installed edition registers a login startup entry for the current Windows user, but the main window appears only after a ChatGPT/Codex process is detected. The tray menu can reopen or quit the app.

## Data and privacy

- Most data and controls use the local `app-server` protocol shipped with ChatGPT/Codex.
- If the live quota endpoint is unavailable, the dashboard falls back to the latest local `token_count` event.
- If the official endpoint omits reset credits, the dashboard reads the current account's ChatGPT desktop cache. It shows `—` when the value cannot be determined instead of inventing zero.
- If the account endpoint omits profile data, the app only decodes the email and plan claims from the ID Token in the local `auth.json` file.
- The app does not read, copy, display, store, or upload access and refresh tokens.
- The app includes no telemetry, advertising, or remote analytics.

## Known limitations

- The project depends on local ChatGPT/Codex protocols and cache formats, which may change with official app updates.
- Chat mode only explains the account and Codex quota boundary; it does not control classic ChatGPT conversations.
- Desktop mode intentionally sits behind normal application windows.
- Release binaries are currently unsigned.

## Run from source

Node.js 22 or newer is required.

```powershell
git clone https://github.com/zhang-mengjia/codex-usage-dashboard.git
cd codex-usage-dashboard
npm ci
npm test
npm start
```

With a signed-in local ChatGPT/Codex environment, you can also run:

```powershell
npm run test:live
```

## Build

```powershell
npm run pack
```

The installer, portable app, and unpacked app are written to `release/`. To run the full desktop smoke test after a local build:

```powershell
npm run smoke
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. Report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT License](LICENSE) © 2026 MENGJIA ZHANG
