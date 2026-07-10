# 变更日志

## [2.1.0] - 2026-07-10 22:08

### 🚀 新增功能
- **服务器启动进度反馈**：`startServer` 增加 `onProgress` 回调，在端口清理、进程启动、等待就绪等关键步骤实时输出日志，便于调试和用户感知状态。
- **启动失败视觉反馈**：依赖安装分支中，若服务器启动失败，进度窗口会**停止计时、停止省略号动画**，状态栏显示红色 “🚫 服务器启动失败”，并追加错误日志，窗口保留完整日志内容，不再覆盖为错误页面。
- **依赖安装成功后计时延续**：安装依赖成功后，计时器**保持继续运行**（之前会停止），用户可看到安装和启动的完整耗时。

### 🐛 修复
- 移除 `npm install` 命令行中的 `--ignore-scripts` 参数（仅保留环境变量），确保原生模块（如 `bcrypt`、`sharp`）的编译脚本正常执行，避免后端服务因缺失编译后文件而崩溃，从而解决部分站点界面无法成功渲染的问题;
- **修复启动失败时省略号动画未停止**：在失败处理分支中显式调用 `stopEllipsisInWin`，确保动画停止。
- **修复错误信息丢失**：不再加载错误页面，而是保持进度窗口并显示错误状态和日志，用户可查看完整信息。

### 🛠️ 优化与重构
- **DNS 解析方式优化**：注释掉 `host-resolver-rules` 强制映射，改用系统 `dns.lookup` 解析域名，避免因 IP 直连导致的 WebAuthn、Cookie 安全策略问题，提升兼容性。
- **错误处理增强**：统一了依赖安装失败和服务器启动失败的处理流程，调用 `setStatusTextInWin` 设置静态状态文字，确保 UI 反馈清晰。
- **工具函数补充**：新增 `stopEllipsisInWin` 和 `setStatusTextInWin`，便于主流程控制 UI 状态。

## [2.0.1] - 2026-07-08 14:56
### 🐛 紧急修复
- **修复 `electron-main.js` 模板路径错误**：`build.js` 中加载 `electron-main.js` 的路径从 `path.join(__dirname, '..', 'electron-main.js')` 修正为 `path.join(__dirname, 'electron-main.js')`，解决了因路径错误导致构建时找不到模板文件的问题（`ENOENT` 错误）。

## [2.0.0] - 2026-07-08 14:39
### ⚠️ 破坏性变更 (Breaking Changes)

- **移除顶层 `branding` 配置**：不再支持 `branding.appIcon`、`branding.installerIcon`、`branding.uninstallerIcon`。
  - *迁移说明*：图标配置改为使用 `electron-builder` 原生方式，通过 `build.win.icon`、`build.mac.icon`、`build.linux.icon` 分别指定，或依赖默认路径 `./build/icon.png`。
- **移除 `handleIcon` 函数**：`build.js` 中的自定义图标处理逻辑已移除，图标管理回归 `electron-builder` 原生机制。
- **`configObj` 移除根级 `icon` 字段**：不再自动注入 `icon: 'app.png'`，各平台需独立配置。

### 🚀 新增功能

- **`copy-files.js` 新增复制 `build/` 目录**：`postinstall` 脚本现在会同时复制 `desktopAppConfig.js` 配置文件和 `build/` 资源目录（含默认图标、横幅、侧边栏等），极大简化项目初始化流程，用户无需手动创建资源目录。
  - 若项目根目录已存在对应文件/目录，则自动跳过，避免覆盖用户自定义内容。

- **NSIS 安装程序视觉定制**：`build.nsis` 新增以下配置字段，支持 Windows 安装程序深度品牌化：
  - `installerHeader`：安装头横幅（150×57 BMP）
  - `installerSidebar`：安装侧边栏（164×314 BMP）
  - `uninstallerSidebar`：卸载侧边栏（164×314 BMP）
  - `installerIcon`：安装程序图标（必须 `.ico`）
  - `uninstallerIcon`：卸载程序图标（必须 `.ico`）
  - 这些资源文件放置于 `./build/` 目录下即可被自动识别。

### 🛠️ 优化与重构(build.js)

- **构建流程简化**：移除 `handleIcon` 及相关常量（`DEFAULT_ICON`、`DEFAULT_INSTALLER_ICON`、`DEFAULT_UNINSTALLER_ICON`），降低代码复杂度，减少维护成本。
- **`files` 排除列表调整**：增加了排除 '!build/**/*' ;
- **NSIS 默认配置精简**：移除 `defaultNsis` 中的 `installerIcon` 和 `uninstallerIcon` 默认值（现由用户在 `build.nsis` 中按需配置）。

### 📚 文档

- 更新 `README.md`：
  - 移除 `branding` 配置章节，改为“图标配置”说明，指引用户通过 `build.xxx.icon` 指定图标或使用 `./build/icon.png` 默认路径。
  - 新增 NSIS 视觉定制配置示例（横幅、侧边栏、图标）。
  - 补充 `copy-files.js` 自动复制 `build/` 目录的说明。