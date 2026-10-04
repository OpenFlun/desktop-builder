# 变更日志
## [5.2.0] - 2026-10-04 21:15
### 修复
- **`platformHandlers` 参数传递错误（重要）**：原代码统一按 `(configObj, userWin, userMac, userDmg)` 传参，导致 `darwin` 分支把 win 配置当 mac 配置、`dmg` 把 mac 配置当 dmg 配置、`linux` 分支把 win 配置当 linux 配置。此前仅有 Windows 构建被真正使用过，此 bug 未暴露；修复后按平台分别传参，macOS / Linux 构建不再错乱；
  - 同一错误导致 `dmg` 段混入 `notarize`、`sign` 等 mac 专属字段，触发 electron-builder v27 的 `additionalProperties: false` 校验失败（`configuration.dmg has an unknown property 'notarize'`）。
- **`resolveSignTool` 首尾空格**：`build.inno.signingTool` 的值若含首尾空格，会导致 `where` / Windows Kits 回退查找全部失败。修复后自动 `trim`，用户填工具名或路径（相对 / 绝对）均可。
- **`mac.notarize` 语义修正**：原校验条件为 `notarize !== false`，会把「不配置」也纳入检查范围，与 electron-builder 的实际行为不一致；修正为仅 `notarize: true` 时检查凭据，`false` 不处理，「不配置」原样透传给 electron-builder。

### 优化
- **macOS / Linux 非官方字段剥离**：`mac.sign.certificateFile` / `certificatePassword` / `notarize`（旧写法）、`linux.sign` 等非 electron-builder v27 官方字段，构建时自动剥离，避免 `additionalProperties: false` 校验失败；相关值已转换为对应环境变量（`CSC_LINK` / `CSC_KEY_PASSWORD` / `GPG_PRIVATE_KEY` / `GPG_KEY_PASSPHRASE`）；
- **macOS / Linux 构建前早期校验（与 Windows 对齐）**：配置问题在**复制文件之前**即报错退出，避免走到打包后期才失败；
  - `build.mac.notarize` 必须为 boolean；
  - `build.mac.notarize: true` 时，公证凭据（`APPLE_ID` / `APPLE_API_KEY` / `APPLE_KEYCHAIN` 三种方式）必须完整，只配一半会报错；
  - `build.linux.sign` 的 `gpgPrivateKey` 与 `gpgKeyPassphrase` 必须同时配置；
- **钩子路径归一化**：`build.afterPack` / `afterAllArtifactBuild` 等构建钩子支持相对路径（相对项目根目录）或绝对路径，构建时自动复制到临时目录并改写为临时目录内绝对路径，规避 electron-builder 的 `Hook module path resolves outside the workspace root` 报错。

### 文档
- **README**：
  - `build.afterBuild` 修正为 `afterAllArtifactBuild`（前者非 electron-builder 官方钩子）；
  - 删除 `toolsets` 相关说明与示例（本工具仅构建当前平台，该字段无实际作用）；
  - macOS / Linux 签名章节按 electron-builder v27 规范重写：签名选项位于 `mac.sign`、公证开关 `mac.notarize` 为 boolean；Linux 无 `sign` 字段，GPG 签名通过环境变量触发；
  - 签名章节编号引用修正（三、macOS / 四、Linux）；
  - 新增 ESM 模块说明：本包及示例 `desktopAppConfig.js` 采用 ESM 语法，CJS 项目需改为 `module.exports`；
  - `excludeDependencies` 用途描述修正：用于自定义排除依赖包（安全 / 减小体积），非专指开发依赖；
  - 快速开始示例 `appUrl` 改为 `http://localhost:7296`；
  - 补充 macOS / Linux 构建前校验说明，与 Windows 保持一致。
- **`desktopAppConfig.js` 模板**：
  - `notarize` 默认值从注释改为实际生效的 `notarize: false`（显式关闭，避免不知情触发）；
  - macOS / Linux 段按 v27 规范重写，并加校验说明注释。
## [5.1.5] - 2026-10-03 23:32
### 优化
- **README 结构重构**：按「大块 → 中块 → 小块」三层结构重写配置章节，先给出顶层字段一览（含锚点跳转），再逐块展开细节；
  - 代码签名从 `build` 子项提升为独立章节；
  - 删除与原「完整配置项」重复的「完整配置示例」章节；
  - 各块统一注明"支持扩展字段"，避免用户误以为只能配置列举的字段。
- **措辞统一**：将"后端服务 / 服务脚本"等表述统一为"Node.js 项目 / 项目入口"，避免让用户误以为只打包单个脚本。

## [5.1.4] - 2026-10-03 17:30
### 修复
- **依赖快照机制完善**：原逻辑仅在 `npm install` **成功完成后**才写入 `.deps-snapshot.json`，但若安装过程中断（Ctrl+C、关窗口、断电等），`node_modules` 可能处于半成品状态（部分包目录存在但内部文件缺失），而**旧的快照文件仍然保留且与当前依赖声明一致**，导致后续所有构建都判定"依赖未变化,跳过安装"，残缺状态被永久保留；
  - 典型症状：打包后运行应用时报 `Cannot find package 'xxx'`（如 `ip-address`），但该包在 `node_modules` 顶层目录中存在；
  - 修复方式：**安装前先删除快照文件**，仅在 `npm install` **成功完成后**才写回新快照；这样任何中断都会留下"快照缺失"的状态，下次构建自动触发完整重装；
  - 利用文件系统的原子性（`unlink` 是原子操作）与"存在即完整"的约定（快照文件存在 ⟺ 上次安装完整成功），比记录"完整安装标志位"更简洁可靠。