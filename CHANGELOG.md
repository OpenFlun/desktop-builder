# 变更日志
## [1.0.5] - 2026-07-06 16:27
### 新增
- 在 README 中新增“配置”章节，指导用户通过 `allowScripts` 显式放行本包的安装脚本，避免因 `ignore-scripts` 全局配置导致钩子被跳过。
## [1.0.4] - 2026-07-05 17:17
### 紧急修复
- **修复依赖安装失败问题**：因 `node` 包安装脚本报错（`Cannot find module 'node-win-x64/package.json'`）导致安装中断，现通过 `--ignore-scripts` 和 `npm_config_ignore_scripts=true` 强制跳过脚本执行，确保依赖安装顺利完成。

### 优化
- **优化依赖清理逻辑**：因 Electron 已内置 Node.js 运行时，无需在应用内额外保留 `node` 包及其平台特定二进制目录（如 `node-win-x64`、`node-darwin-x64` 等）。现主动清理这些冗余目录，减小应用体积，同时避免与 Electron 内置运行时产生潜在冲突。注意：此优化不影响 `bcrypt` 等原生模块正常工作，因为所需依赖（如 `node-gyp-build`、`node-addon-api` 等）仍被保留。