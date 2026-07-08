# 变更日志
## [2.0.2] - 2026-07-08 16:42
### 优化
- 修改了build目录下的部分图标;

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