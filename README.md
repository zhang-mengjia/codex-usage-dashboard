# Codex Usage Dashboard

[English](README.en.md) | 简体中文

一款面向 Windows 的非官方开源桌面仪表盘，用于实时查看 ChatGPT 桌面版中的 Codex 使用额度、上下文与运行设置。

> 本项目与 OpenAI 无隶属或背书关系。Codex、ChatGPT 和 OpenAI 是其各自权利人的商标。

## 功能

- 显示 5 小时和每周使用额度、重置时间及可用重置次数。
- 显示当前账户、最近对话、上下文占用和缓存输入。
- 适配 ChatGPT 桌面版的 Codex / Work / Chat 三种界面语义。
- 支持中文与 English 即时切换并持久保存。
- 查看并切换模型、推理强度、速度、权限、计划模式和目标模式。
- 一键刷新、一键压缩当前对话上下文、一键恢复默认窗口尺寸。
- 支持置顶、固定在桌面、普通窗口和屏幕边缘悬浮球。
- 检测到 ChatGPT 或 Codex 启动后自动显示；关闭主窗口后驻留系统托盘。
- 不包含升级套餐、购买额度或添加额度入口。

## 系统要求

- Windows 10/11 x64
- 已安装并登录最新版 ChatGPT 桌面版（含 Codex）或 Codex 桌面版/CLI

目前只提供 Windows x64 构建。

## 下载与安装

在 [Releases](../../releases/latest) 页面下载：

- `Codex-Usage-Dashboard-Setup-*-x64.exe`：安装版，支持开始菜单、桌面快捷方式和当前用户登录启动。
- `Codex-Usage-Dashboard-Portable-*-x64.exe`：免安装便携版。

当前发布包尚未购买商业代码签名证书，因此 Windows SmartScreen 可能显示“未知发布者”。请只从本仓库的 Releases 下载，并使用发布页提供的 SHA-256 校验值核对文件。

## 使用说明

1. 启动并登录 ChatGPT 桌面版。
2. 启动 Codex Usage Dashboard。
3. 使用顶部模式标签切换 Codex、Work 或 Chat 视图。
4. 使用窗口层级按钮切换置顶、桌面、普通窗口或悬浮球模式。
5. 模型、推理、速度、权限、计划与目标设置会作用于所选对话；界面会标明其生效范围。

安装版会为当前 Windows 用户注册登录启动项，但只有检测到 ChatGPT/Codex 进程时才显示主窗口。可从系统托盘重新打开或退出。

## 数据与隐私

- 主要数据通过本机 ChatGPT/Codex 自带的 `app-server` 协议读取和控制。
- 实时额度接口不可用时，会从本机最近对话的 `token_count` 事件读取额度回退值。
- 重置次数会在官方接口缺失时读取当前账户对应的 ChatGPT 桌面缓存；无法可靠取得时显示 `—`，不会伪造为 0。
- 账户接口未返回资料时，只解析本机 `auth.json` 中 ID Token 的邮箱与套餐声明。
- 应用不会读取、复制、显示、保存或上传访问令牌和刷新令牌。
- 应用本身不包含遥测、广告或远程分析服务。

## 已知限制

- 本项目依赖 ChatGPT/Codex 的本机协议与缓存格式；官方应用更新后可能需要同步适配。
- Chat 视图仅标注与 Codex 共享的账户/额度边界，不尝试控制经典 ChatGPT 对话。
- 桌面固定模式位于普通应用窗口之后，这是 Windows 桌面层级的预期行为。
- 安装包当前未进行商业代码签名。

## 从源码运行

需要 Node.js 22 或更高版本。

```powershell
git clone https://github.com/zhang-mengjia/codex-usage-dashboard.git
cd codex-usage-dashboard
npm ci
npm test
npm start
```

需要已登录的 ChatGPT/Codex 本机环境时，可额外运行：

```powershell
npm run test:live
```

## 构建

```powershell
npm run pack
```

安装版、便携版和解包版本输出到 `release/`。本机构建后的完整桌面自测可运行：

```powershell
npm run smoke
```

## 参与贡献

提交问题或代码前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。

## 许可证

[MIT License](LICENSE) © 2026 MENGJIA ZHANG
