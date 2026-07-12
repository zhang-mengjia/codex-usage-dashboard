# Changelog

All notable changes to this project are documented here.

## [1.1.1] - 2026-07-10

### Added

- Codex, Work, and Chat surfaces for the integrated ChatGPT desktop app.
- Chinese and English UI modes.
- Account, recent conversation, context, model, reasoning, speed, permission, Plan mode, and Goal mode controls.
- One-click context compaction, refresh, and default-size restore.
- Always-on-top, desktop, normal-window, and edge-snapped floating-ball modes.

### Fixed

- Reset-credit fallback now uses the current account's ChatGPT desktop cache and keeps unavailable values unknown instead of showing zero.
- Native title-bar dragging no longer changes the window size through DPI rounding.
- Desktop-mode shutdown restores the native window layer to prevent a black desktop region.
- Window hit testing and border rendering were corrected for transparent frameless windows.

[1.1.1]: https://github.com/zhang-mengjia/codex-usage-dashboard/releases/tag/v1.1.1
