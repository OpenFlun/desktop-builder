# 变更日志
## [6.4.0] - 2026-10-19 11:44
### 修复
- **消除编译文件保护的白名单依赖**:`npmRebuild: true` 时原通过 `SKIP_PKGS` 白名单(`node-addon-api`,`node-gyp-build` 等)保护无 `binding.gyp` 的编译辅助包,白名单无法穷举同类包(如 `nan`),存在误删风险;现改为编译前移,优化阶段不再依赖包名判断;

### 优化
- **原生模块编译前移至优化之前**:`npmRebuild: true` 时在依赖安装后,`node_modules` 优化前执行 `electron-rebuild`,编译完成后再优化;优化阶段可无条件清理编译源文件与 node-gyp 中间产物,仅保留 `.node`;electron-builder 强制 `npmRebuild: false`,不再重复编译;实测产物无编译残留,`bcrypt` 的 `build/` 仅剩 `bcrypt_lib.node`;
- **阶段 4/5 职责归位**:node-gyp 编译中间产物(`.vcxproj`,`.tlog`,`.iobj`,`.ipdb`,`.exp`,`.lib`,`.obj`,`.recipe`,`.lastbuildstate`,`.pdb`,`.nativecodeanalysis.xml`)由阶段 5 `pruneIntermediates` 统一清理,与 `.orig` 共用一次遍历;阶段 4 恢复为只清理开发文件与编译源文件,名称与实际内容一致;已核实这些扩展名不出现在发布包中,无误删面;
- **缓存指纹纳入 `npmRebuild`**:快照记录该值;`false → true` 触发重装(上次优化已删编译源文件,需还原),`true → false` 仅重优化(编译文件由阶段 4/5 清理,无需重装);旧快照无该字段时视为变化,自动触发一次重装建立干净基线;
- **合并阶段恢复单 JS 文件包跳过**:`countJS(pkgDir) <= 1` 时不再经 esbuild 包装,保留原文件;实测 `node_modules` 体积 76.05 MB → 74.32 MB,`bundled` 目录 113 个,文件数不变;
- **阶段 4 不再清理 `.d.ts`**:`.d.ts` 已由阶段 6 的 `TS_RE` 覆盖,移除阶段 4 的重复清理,清理职责不重叠;
- **提示配色区分状态**:`依赖安装完成` 改为绿色,与其他完成类提示一致;`Electron 版本` 改为暗金色 `#B8860B`,与进行中(青色),完成(绿色),警告(黄色)区分;
- **提示如实反映动作**:`重新安装依赖` 按优化开关显示为 `重新安装依赖+优化` 或 `重新安装依赖`;`仅需优化`,`跳过安装与优化` 按实际判断点补充括注;

## [6.3.2] - 2026-10-17 16:54
### 修复
- **启动探测动态适配用户监听地址(重要)**:`waitForServer` 探测主机由固定 `127.0.0.1` 改为从 `CONFIG.APP_URL` 取 hostname(IPv6 字面量去方括号,`http.get` 的 `hostname` 不接受带括号形式),固定地址与动态地址均兼容;覆盖 `APP_URL` 指向域名(仅解析公网 IPv6),特定绑定主机等非回环场景--原固定探回环时服务器已监听,`127.0.0.1` 无人监听,持续 `ECONNREFUSED` 致三次重试后启动失败;

### 升级
- 同步更新依赖包;

## [6.3.1] - 2026-10-16 20:36
### 升级
- 同步更新依赖包;

## [6.3.0] - 2026-10-15 23:06
### 修复
- **`npmRebuild: true` 时原生编译失败(重要)**:electron-builder 重编译原生模块时,`node-gyp` 会加载编译依赖的头文件(如 `bcrypt` 依赖的 `node-addon-api/node_addon_api.gyp`);但原"编译文件保护"只覆盖含 `binding.gyp` 的包,`node-addon-api` 这类**只提供头文件,无 `binding.gyp`** 的依赖被误删,导致 `gyp: ... not found`,构建失败;现改为 `npmRebuild: true` 时**所有编译类文件(`.gyp` / `.gypi` / `.h` / `.c` 等)一律保留**,不再限定于原生模块包;

### 优化
- **合并阶段删除安装期脚本字段**:合并 JS 后删除各包 `package.json` 的 `scripts` 字段(运行时无安装期,且 electron-builder 若开启 `npmRebuild` 会触发脚本,而脚本文件已被合并删除导致失败);**原生模块包例外**--`npmRebuild: true` 时其 `scripts` 保留(编译必需);
- **清理死代码**:移除不再使用的 `nativePkgs` / `inNativePkg` 逻辑;
