# Codex Usage Dashboard

[![CI](https://github.com/zhang-mengjia/codex-usage-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/zhang-mengjia/codex-usage-dashboard/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/zhang-mengjia/codex-usage-dashboard)](https://github.com/zhang-mengjia/codex-usage-dashboard/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](README.en.md) | 简体中文

一款面向 Windows 与 macOS 的非官方开源桌面仪表盘，用于实时查看 ChatGPT/Codex 的使用额度、上下文与运行设置。

> 本项目与 OpenAI 无隶属或背书关系。Codex、ChatGPT 和 OpenAI 是其各自权利人的商标。

## 功能

- 显示 5 小时和每周使用额度、重置时间及可用重置次数。
- 显示当前账户、最近对话、上下文占用和缓存输入。
- 在集成版 ChatGPT 中提供 Codex / Work / Chat 三种界面语义；独立 Codex 应用中只开放适用的 Codex 控制。
- 支持中文与 English 即时切换并持久保存。
- 查看并切换模型、推理强度、速度、权限、计划模式和目标模式。
- 一键刷新、一键压缩当前对话上下文、一键恢复默认窗口尺寸。
- 支持置顶、桌面层、普通窗口和屏幕边缘悬浮球。
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

1. 启动并登录 ChatGPT 或 Codex 桌面版，也可以先安装并登录 Codex CLI。
2. 启动 Codex Usage Dashboard。
3. 在集成版 ChatGPT 环境中使用顶部标签切换 Codex、Work 或 Chat 视图。
4. 使用窗口层级按钮切换置顶、桌面、普通窗口或悬浮球模式。
5. 模型、推理、速度、权限、计划与目标设置会作用于所选对话；界面会标明其生效范围。

安装版会注册当前用户登录启动项，但只有检测到 ChatGPT/Codex 进程时才显示主窗口。Windows 可从系统托盘、macOS 可从菜单栏重新打开或退出。

### macOS 窗口模式

- **置顶显示**：保持在当前桌面空间的其他普通窗口上方。
- **固定在所有桌面**：显示在所有 Spaces，使用普通窗口层级，不遮挡其他应用。
- **普通窗口**：标准可移动、缩放和最小化窗口。
- **悬浮球**：显示在所有 Spaces（包括全屏空间）并吸附到屏幕边缘。

macOS 没有 Windows WorkerW 桌面父层，因此“固定在桌面”采用上述原生 Spaces 等价语义。

## 数据与隐私

- 主要数据通过本机 ChatGPT/Codex 自带的 `app-server` 协议读取和控制。
- 实时额度接口不可用时，会从本机最近对话的 `token_count` 事件读取额度回退值。
- 重置次数会在官方接口缺失时读取当前账户对应的桌面缓存；无法可靠取得时显示 `—`，不会伪造为 0。
- 账户接口未返回资料时，只解析本机 `auth.json` 中 ID Token 的邮箱与套餐声明。
- 应用不会读取、复制、显示、保存或上传访问令牌和刷新令牌。
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
