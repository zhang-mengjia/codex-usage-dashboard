# Codex Usage Dashboard

[![CI](https://github.com/zhang-mengjia/codex-usage-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/zhang-mengjia/codex-usage-dashboard/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/zhang-mengjia/codex-usage-dashboard)](https://github.com/zhang-mengjia/codex-usage-dashboard/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](README.en.md) | 简体中文

一款面向 Windows 与 macOS 的非官方开源桌面仪表盘，用于实时查看 ChatGPT/Codex 的使用额度、上下文与运行设置。

> 本项目与 OpenAI 无隶属或背书关系。Codex、ChatGPT 和 OpenAI 是其各自权利人的商标。

## 功能

- 根据官方账户接口实际返回的时间窗口动态显示实时额度、重置时间及可用重置次数；当前只有周限额时不会误标为 5 小时限额，也不会用旧会话快照冒充实时数据。
- 逐条显示每次重置机会的官方 ID 对应信息、说明、获得时间与到期时间。
- 显示当前账户、最近对话、上下文占用和缓存输入。
- 在集成版 ChatGPT 中提供 Codex / Work / Chat 三种界面语义；独立 Codex 应用中只开放适用的 Codex 控制。
- 支持中文与 English 即时切换并持久保存。
- 查看并切换模型、推理强度、速度、权限、计划模式和目标模式。
- 一键刷新和一键压缩当前对话上下文。
- 提供独立置顶图钉、独立悬浮球、最小化，以及最大化/恢复按钮；悬浮球使用平滑额度圆环显示剩余量、限额类型和重置日期，可整球拖动并在释放后吸附到屏幕边缘。
- 检测到 ChatGPT 或 Codex 启动后自动显示；关闭主窗口后驻留系统托盘或 macOS 菜单栏。
- 不包含升级套餐、购买额度或添加额度入口。

## 系统要求

### Windows

- Windows 10/11 x64
- 已登录的 ChatGPT/Codex 桌面版或 Codex CLI

### macOS

- Codex Usage Dashboard：macOS 12 或更高版本，Apple Silicon 与 Intel 通用构建
- ChatGPT 官方 macOS 客户端：按 OpenAI 当前要求，需要 macOS 14 和 Apple Silicon（M1 或更新）
- Intel Mac 可搭配官方 Codex CLI 使用；Codex CLI 提供 `x86_64-apple-darwin` 构建

## 下载与安装

在 [Releases](../../releases/latest) 页面下载：

- `Codex-Usage-Dashboard-Setup-*-x64.exe`：Windows 安装版。
- `Codex-Usage-Dashboard-Portable-*-x64.exe`：Windows 免安装版。
- `Codex-Usage-Dashboard-*-macOS-universal.dmg`：macOS 通用安装镜像。
- `Codex-Usage-Dashboard-*-macOS-universal.zip`：macOS 通用压缩包。

发布包目前没有商业代码签名：

- Windows SmartScreen 可能显示“未知发布者”。
- macOS 首次启动请在 Finder 中右键应用并选择“打开”。如果 Gatekeeper 仍阻止启动，请确认文件来自本仓库后执行：

```bash
xattr -dr com.apple.quarantine "/Applications/Codex 使用量.app"
```

请使用发布页附带的 `SHA256SUMS.txt` 核对下载文件。

## 使用说明

1. 启动并登录 ChatGPT 或 Codex 桌面版，也可以先安装 Codex CLI。
2. 启动 Codex Usage Dashboard。
3. 首次使用额度监看时点击“连接账户”，在 OpenAI 官方浏览器页面完成一次授权。该独立登录用于避免与 ChatGPT/Codex 主进程争抢刷新令牌。
4. 在集成版 ChatGPT 环境中使用顶部标签切换 Codex、Work 或 Chat 视图。
5. 图钉按钮切换置顶，圆球按钮切换悬浮球，重叠窗口按钮切换最大化/恢复；拖动悬浮球可调整位置，释放后会自动吸附并记住屏幕边缘位置。
6. 模型、推理、速度、权限、计划与目标设置会作用于所选对话；界面会标明其生效范围。

安装版会注册当前用户登录启动项，但只有检测到 ChatGPT/Codex 进程时才显示主窗口。Windows 可从系统托盘、macOS 可从菜单栏重新打开或退出。

### macOS 窗口行为

- **置顶显示**：保持在当前桌面空间的其他普通窗口上方。
- **普通窗口**：标准可移动、缩放和最小化窗口。
- **悬浮球**：显示在所有 Spaces（包括全屏空间）并吸附到屏幕边缘。

## 数据与隐私

- 额度与单次重置明细直接通过本机 ChatGPT/Codex 自带的 `app-server` 调用官方账户接口。
- 仪表盘为额度读取维护隔离的本机 OAuth 会话，凭据由 Codex 本机组件保存；应用代码不会读取、复制、显示或上传令牌。
- 实时接口或认证不可用时显示明确错误与“—”，不会回退到旧会话额度或缓存次数。
- 应用本身不包含遥测、广告或远程分析服务。

## 已知限制

- 本项目依赖 ChatGPT/Codex 的本机协议与缓存格式；官方应用更新后可能需要同步适配。
- Chat 视图仅标注与 Codex 共享的账户/额度边界，不尝试控制经典 ChatGPT 对话。
- macOS 发布包当前未经过 Apple Developer ID 签名和公证。

## 从源码运行

需要 Node.js 22 或更高版本。

```bash
git clone https://github.com/zhang-mengjia/codex-usage-dashboard.git
cd codex-usage-dashboard
npm ci
npm test
npm start
```

需要已登录的本机 ChatGPT/Codex 环境时，可额外运行 `npm run test:live`。

## 构建

在对应操作系统上执行：

```bash
npm run pack:win
npm run pack:mac
```

`pack:mac` 生成同时包含 `arm64` 与 `x86_64` 的 universal DMG 和 ZIP。构建结果输出到 `release/`。本机完整桌面自测可运行 `npm run smoke`。

## 参与贡献

提交问题或代码前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。

## 许可证

[MIT License](LICENSE) © 2026 MENGJIA ZHANG
