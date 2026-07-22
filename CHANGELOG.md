# 变更日志

## [3.0.0] - 2026-07-22 20:45

### ⚠️ 破坏性变更（Breaking Changes）

- **依赖安装策略变更**：构建时现在默认执行 `npm install --production` 并将 `node_modules` 完整打包进安装包。用户首次启动**无需联网**，开箱即用。安装包体积会增大，构建和安装时间会增长,但启动速度显著提升。若您想恢复到旧行为（请安装旧版本）;
- 注意:`excludeFiles` 中不可再显式添加 `'node_modules/'`,因为当前版本已移除首次启动安装逻辑,故而会造成无法正常启动;

- **清理逻辑重构**：移除了 `cleanNodeModules` 手动清理函数，改用 `configObj.files` 硬编码排除规则。现在会精准排除平台绑定目录（仅匹配 `node-win*/**`、`node-darwin*/**` 等六个平台），不匹配 `node-addon-api` 等正常包。

- **`excludeFiles` 现在也作用于打包阶段**：您在配置中定义的排除模式会自动转换为 `electron-builder` 的 `files` 排除规则（添加 `!` 前缀），因此也会在最终打包时生效。如果您之前依赖 `excludeFiles` 仅影响复制阶段，现在它们会影响最终安装包内容。这样会得到你想要的干净桌面文件;

- **`allowScripts` 处理方式调整**：安装前保留用户根 `package.json` 中的原始 `allowScripts`（若有），确保安装脚本正常执行；安装完成后，强制替换为配置文件中的 `allowScripts`（若合法）,若无将使用默认值 `{ node: true }`。此变更保证安装过程不受限制，同时让最终产物应用您配置的白名单。

- **日志系统统一**：移除了所有 `onProgress` 回调参数，所有运行时日志统一通过 `log` 函数输出到日志文件，当 `LOGGING_ENABLED` 为 `true` 时）。

- **移除首次启动依赖安装功能**：`electron-main.js` 中删除了 `installDependenciesWithProgress` 及相关的进度窗口 HTML，不再支持首次启动时动态安装依赖;

### 新增

- 依赖预打包，用户首次启动无需联网安装依赖;
- 硬编码 `files` 排除规则（`!builder.json`、`!**/*.map`、`!**/*.ts` 等），自动排除开发和常见不参与实际执行的文件;
- 配置文件显示配置 allowScripts 字段及默认值;

### 修复

- 修复了 `minimatch` 依赖包缺失的问题;

### 优化

- 构建时排除了许多不参与实际运行的文件,从而使安装包和应用项目体积大幅优化;

---

## [2.1.7] - 2026-07-21

### 优化
- 在 `desktopAppConfig.js` 中将 `nsis.perMachine` 字段默认值改为 `false`，并且 `README.md` 同步更新。

## [2.1.6] - 2026-07-20

### 🐛 修复
- 修复了构建后安装依赖时，总打印“清理目录时出错...”的问题。