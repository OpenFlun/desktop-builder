# 变更日志

## [1.1.0] - 2026-07-07 08:35
### 新增
- **依赖安装进度界面**：当 `node_modules` 不存在时，自动显示内嵌进度窗口，实时输出 npm 安装日志（包括 `npm install` / `npm ci` 的执行过程），消除用户等待时的"卡死"错觉。若依赖已存在，则直接加载应用，无多余界面干扰。
- **主题切换支持**：用户可在 `desktopAppConfig.js` 的 `menu` 配置中自行添加主题菜单项（浅色/深色/跟随系统），通过调用 `nativeTheme.themeSource` 实现切换;
- 加载窗口背景改为默认湖蓝色;

### 优化
- **代码去冗余**：
  - 移除 `installDependenciesWithProgress` 中重复的 `node_modules` 存在性检查（主流程已判断）。
  - 精简日志记录，移除冗余的 `emergencyLog` 函数及其所有调用，统一使用 `log` 记录。
- **窗口创建错误处理**：仅保留单一日志记录，避免重复输出。

## [1.0.6] - 2026-07-06 19:56
### 优化
- 升级了一些依赖包;

## [1.0.4] - 2026-07-05 17:17
### 紧急修复
- **修复依赖安装失败问题**：因 `node` 包安装脚本报错（`Cannot find module 'node-win-x64/package.json'`）导致安装中断，现通过 `--ignore-scripts` 和 `npm_config_ignore_scripts=true` 强制跳过脚本执行，确保依赖安装顺利完成。

### 优化
- **优化依赖清理逻辑**：因 Electron 已内置 Node.js 运行时，无需在应用内额外保留 `node` 包及其平台特定二进制目录（如 `node-win-x64`、`node-darwin-x64` 等）。现主动清理这些冗余目录，减小应用体积，同时避免与 Electron 内置运行时产生潜在冲突。注意：此优化不影响 `bcrypt` 等原生模块正常工作，因为所需依赖（如 `node-gyp-build`、`node-addon-api` 等）仍被保留。