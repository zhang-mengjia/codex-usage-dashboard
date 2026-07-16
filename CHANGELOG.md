# Changelog

All notable changes to this project are documented here.

## [1.4.2] - 2026-07-16

### Fixed

- Floating-ball dragging now uses main-process system cursor coordinates so mixed-DPI and multi-display layouts cannot send the ball off-screen.
- Drag updates are constrained to the active display, and lost pointer capture or window blur now completes edge snapping safely.
- Persisted floating-ball coordinates now use the actual post-snap window position.

## [1.4.1] - 2026-07-15

### Fixed

- The anti-aliased floating-ball window now has a fully transparent root canvas, removing the opaque white square around the circular UI.
- Desktop self-tests now verify that all four compositor-surface corners are transparent.

## [1.4.0] - 2026-07-15

### Added

- A larger anti-aliased SVG floating ball with a full-circumference remaining-quota ring, limit type, reset date, and live-status indicator.
- Full-surface floating-ball dragging, click-versus-drag detection, immediate edge snapping, and persisted edge position.

### Changed

- Usage windows are identified from their actual duration instead of assuming the primary slot is five-hour and the secondary slot is weekly.
- Weekly-only account payloads now render as one weekly limit in both the dashboard and floating ball, while older dual-window payloads remain supported.
- The floating ball now uses a transparent square compositor surface instead of a pixel-stepped circular window shape, eliminating the visible jagged edge.

## [1.3.0] - 2026-07-12

### Added

- Isolated official ChatGPT OAuth session for live quota reads without refresh-token races with the ChatGPT/Codex process.
- Individual reset-credit rows with backend title, description, grant time, and expiry.
- Independent always-on-top pin and floating-ball buttons.

### Changed

- The former layer button now toggles maximize/restore.
- Live quota failures now show an explicit unavailable state instead of a conversation snapshot or cached reset count.
- The Windows floating ball uses a true circular window region with no rectangular shadow.

### Removed

- Default-size restore and desktop-pinning controls.

## [1.2.0] - 2026-07-12

### Added

- Universal macOS DMG and ZIP builds for Apple Silicon and Intel.
- Native macOS ChatGPT/Codex process and application-bundle detection.
- macOS Codex CLI discovery for app bundles, official installer, Homebrew, npm, Cargo, and `PATH` locations.
- Native macOS login item, menu-bar icon, all-Spaces desktop mode, and all-Spaces floating ball.
- Windows and macOS CI plus a multi-platform automated release pipeline.

### Changed

- Product and host labels now distinguish integrated ChatGPT from the standalone Codex app.
- Unsupported Work and Chat surfaces are disabled when only standalone Codex is available.

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

[1.4.2]: https://github.com/zhang-mengjia/codex-usage-dashboard/releases/tag/v1.4.2
[1.4.1]: https://github.com/zhang-mengjia/codex-usage-dashboard/releases/tag/v1.4.1
[1.4.0]: https://github.com/zhang-mengjia/codex-usage-dashboard/releases/tag/v1.4.0
[1.3.0]: https://github.com/zhang-mengjia/codex-usage-dashboard/releases/tag/v1.3.0
[1.2.0]: https://github.com/zhang-mengjia/codex-usage-dashboard/releases/tag/v1.2.0
[1.1.1]: https://github.com/zhang-mengjia/codex-usage-dashboard/releases/tag/v1.1.1
