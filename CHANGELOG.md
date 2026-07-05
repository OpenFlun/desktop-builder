# 变更日志

## [1.0.4] - 2026-07-05 17:17
### 紧急修复
- **修复依赖安装失败问题**：因 `node` 包安装脚本报错（`Cannot find module 'node-win-x64/package.json'`）导致安装中断，现通过 `--ignore-scripts` 和 `npm_config_ignore_scripts=true` 强制跳过脚本执行，确保依赖安装顺利完成。

### 优化
- **优化依赖清理逻辑**：因 Electron 已内置 Node.js 运行时，无需在应用内额外保留 `node` 包及其平台特定二进制目录（如 `node-win-x64`、`node-darwin-x64` 等）。现主动清理这些冗余目录，减小应用体积，同时避免与 Electron 内置运行时产生潜在冲突。注意：此优化不影响 `bcrypt` 等原生模块正常工作，因为所需依赖（如 `node-gyp-build`、`node-addon-api` 等）仍被保留。

## [1.0.3] - 2026-07-04 21:32
### 修复
- 修复 Windows 环境下 `npx desktop-builder build` 命令无任何输出的问题（入口判断逻辑改用 `pathToFileURL` 统一路径格式）。

## [1.0.2] - 2026-07-03 10:43
### 优化
- 简化使用示例;