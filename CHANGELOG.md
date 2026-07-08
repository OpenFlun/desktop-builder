# 变更日志

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

## [1.1.1] - 2026-07-07 09:37
### 优化
- 优化了 `README.md` 文件中关于构建完全离线应用的排除文件示例。

## [1.1.0] - 2026-07-07 08:35
### 新增
- **依赖安装进度界面**：当 `node_modules` 不存在时，自动显示内嵌进度窗口，实时输出 npm 安装日志（包括 `npm install` / `npm ci` 的执行过程），消除用户等待时的"卡死"错觉。若依赖已存在，则直接加载应用，无多余界面干扰。
- **主题切换支持**：用户可在 `desktopAppConfig.js` 的 `menu` 配置中自行添加主题菜单项（浅色/深色/跟随系统），通过调用 `nativeTheme.themeSource` 实现切换。
- 加载窗口背景改为默认湖蓝色 (`#2b49a1`)。

### 优化
- **代码去冗余**：
  - 移除 `installDependenciesWithProgress` 中重复的 `node_modules` 存在性检查（主流程已判断）。
  - 精简日志记录，移除冗余的 `emergencyLog` 函数及其所有调用，统一使用 `log` 记录。
- **窗口创建错误处理**：仅保留单一日志记录，避免重复输出。