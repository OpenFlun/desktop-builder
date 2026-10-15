# 变更日志

## [6.3.0] - 2026-10-15 23:06
### 修复
- **`npmRebuild: true` 时原生编译失败（重要）**：electron-builder 重编译原生模块时，`node-gyp` 会加载编译依赖的头文件（如 `bcrypt` 依赖的 `node-addon-api/node_addon_api.gyp`）；但原「编译文件保护」只覆盖含 `binding.gyp` 的包，`node-addon-api` 这类**只提供头文件、无 `binding.gyp`** 的依赖被误删，导致 `gyp: ... not found`、构建失败；现改为 `npmRebuild: true` 时**所有编译类文件（`.gyp` / `.gypi` / `.h` / `.c` 等）一律保留**，不再限定于原生模块包；

### 优化
- **合并阶段删除安装期脚本字段**：合并 JS 后删除各包 `package.json` 的 `scripts` 字段（运行时无安装期，且 electron-builder 若开启 `npmRebuild` 会触发脚本、而脚本文件已被合并删除导致失败）；**原生模块包例外**——`npmRebuild: true` 时其 `scripts` 保留（编译必需）；
- **清理死代码**：移除不再使用的 `nativePkgs` / `inNativePkg` 逻辑；

## [6.2.1] - 2026-10-15 11:49
### 优化
- 优化了一些代码细节;

## [6.2.0] - 2026-10-14 22:34
### 新增
- **Electron 缓存复用**：构建时检查 Electron 缓存目录（`%LOCALAPPDATA%\electron\Cache` 等）——
  - 已有当前版本（版本 + 平台 + 架构）的解压产物 → 直接复用，不再每次解压；
  - 无解压产物但有 zip → 从 zip 解压到 zip 同名目录；
  - zip 也缺 → 交由 electron-builder 下载；
  - 解压产物通过 `electronDist` 传给 electron-builder，跳过其默认的重复解压；
  - macOS / Linux 下设置 `USE_HARD_LINKS=true`，electron-builder 用硬链接复制，接近零成本；
- **自动清理旧缓存**：构建时保留当前版本的 zip 与解压目录，删除其它所有版本 / 平台的 `electron-v*.zip` 及其同名解压目录，避免缓存无限累积（实测一次清理 21 项、约 2.6GB）；
- **`electronNodeFallback` 配置字段**（`package.json`）：记录 Electron 内置 Node 版本兜底值与查询地址（`https://releases.electronjs.org/schedule`），便于升级 electron 后同步更新；
- **esbuild target 兜底值升至 24**：读不到 Electron 已解压二进制时，从 v22 兜底改为 v24（对应 Electron 44 内置 Node 24.21.0）。

### 修复
- **阶段 1、2 顺序调换（重要）**：原「先合并 JS、后清空资源」——合并阶段会删除 postinstall 脚本文件，导致清空阶段读不到脚本、无法提取资源目录，报「清空 0 项」、资源目录残留；现改为**先清空资源、后合并**：
  - 清空资源时**跳过 js 文件**，留待合并阶段处理；
  - 日志如实反映：「清空 N 个文件（js 文件保留，留待合并阶段处理）」；
- **`clearItem` 单文件分支漏判 js（重要）**：目录分支已有「跳过 js」判断，单文件分支遗漏，导致资源目录中的**单个 js 文件**（如 `DnsAutoSSL.js`、`Mail.js`）被清空为 0 字节，合并阶段读到空文件、产物损坏；现补充 js 判断，js 一律保留给合并阶段；
- **合并阶段日志标题**：由「处理 JS 资源(用到则合并,未用到则提前清除)」改为「处理保留的资源 JS（被引用则合并，否则删除）」，与新流程呼应。

## [6.1.0] - 2026-10-11 21:34
### 新增
- **安装时可选加入 Windows Defender 排除项（默认勾选）**：安装向导新增「选择附加任务」页，复选框「将应用加入 Windows Defender 排除项，加快启动」默认勾选；
  - **用途**：应用每次启动时，Defender 会实时扫描安装目录下的大量文件（`node_modules` 成千上万小文件），显著拖慢冷启动；将安装目录加入排除项后不再扫描，冷启动耗时大幅下降；
  - **实现**：安装完成时通过 PowerShell `Add-MpPreference -ExclusionPath` 添加排除项（标准权限失败则自动提权执行）；用户取消勾选则不添加；
  - **卸载清理**：卸载时若用户选择「清除用户数据」，则一并移除该排除项；选择保留则保留；
  - **范围**：仅覆盖 Windows Defender；第三方杀毒软件（360 / 火绒 / 卡巴斯基等）机制各异，本功能不处理；
  - **实测**：冷启动约 **4.5s → 2.1s**（接近热启动 1.7s）。

### 修复
- **Unicode 字符场景处理漏洞（4 处）**：原正则字符类使用 ASCII-only 的 `\w` / `[a-zA-Z]` / `[A-Za-z0-9_]`，中文及国际字符场景下匹配失败、静默不处理；统一升级为 Unicode 属性类（`\p{L}` / `\p{N}` / `\p{ID_Start}` / `\p{ID_Continue}`）并加 `u` 标志；
  - **菜单 `click` 函数串判定**（`electron-main.js`）：`function 你好() {}` 等中文函数名此前不被识别为函数、不 `eval`；修复后可正常执行；
  - **`scripts` 脚本文件名提取**（`optimize-node-modules.js`）：中文/国际字符文件名的脚本（如 `node scripts/构建.js`）此前不被纳入保护名单，合并阶段可能被误删；
  - **CJS 具名导出识别**（`optimize-node-modules.js`）：`exports.你好 = ...` 等中文导出名此前不被识别、不补 `module.exports.xxx` 声明，`cjs-module-lexer` 可能识别失败；
  - **资源路径字符串提取**（`optimize-node-modules.js`）：中文目录/文件名（如 `模板/index.html`）此前不被识别，被引用的资源可能被误删；同时移除原 100 字符长度上限。

### 文档
- **`index.d.ts` 补全 `optimize-node-modules.js` 类型声明**：新增 import 与该模块的 `declare module` 块（含 `markVerified` / `optimizeNodeModules` / `clearVerified` / `SELF_HASH` 四个导出的 JSDoc 注释），顺序按「子处理文件在前、主处理文件 `build.js` 在后」排列，与源码导出一致。
- **README 与配置注释统一 `exclude` 措辞**：`optimize.exclude` 相关说明统一为「排除优化时异常或不想优化的包（默认空）」，覆盖特性列表、配置总览表、optimize 章节与调试步骤，并明确默认值为空；
