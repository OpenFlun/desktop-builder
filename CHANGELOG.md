# 变更日志
## [6.3.1] - 2026-10-16 20:36
### 升级
- 同步更新依赖包;

## [6.3.0] - 2026-10-15 23:06
### 修复
- **`npmRebuild: true` 时原生编译失败（重要）**：electron-builder 重编译原生模块时，`node-gyp` 会加载编译依赖的头文件（如 `bcrypt` 依赖的 `node-addon-api/node_addon_api.gyp`）；但原「编译文件保护」只覆盖含 `binding.gyp` 的包，`node-addon-api` 这类**只提供头文件、无 `binding.gyp`** 的依赖被误删，导致 `gyp: ... not found`、构建失败；现改为 `npmRebuild: true` 时**所有编译类文件（`.gyp` / `.gypi` / `.h` / `.c` 等）一律保留**，不再限定于原生模块包；

### 优化
- **合并阶段删除安装期脚本字段**：合并 JS 后删除各包 `package.json` 的 `scripts` 字段（运行时无安装期，且 electron-builder 若开启 `npmRebuild` 会触发脚本、而脚本文件已被合并删除导致失败）；**原生模块包例外**——`npmRebuild: true` 时其 `scripts` 保留（编译必需）；
- **清理死代码**：移除不再使用的 `nativePkgs` / `inNativePkg` 逻辑；

## [6.2.1] - 2026-10-15 11:49
### 优化
- 优化了一些代码细节;