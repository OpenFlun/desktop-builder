# 变更日志
## [6.0.0] - 2026-10-10 21:59
### 新增
- **node_modules 优化系统（默认开启）**：构建时自动执行六阶段优化，大幅减少打包文件数、加速应用冷启动。不改变用户代码、不改变项目结构、对任意 Node.js 项目通用；
  - **阶段 1 合并 JS**：按包入口 bundle，多个 JS 文件合并为单文件（`__bundled__.mjs` 或 `__bundled__.cjs`）；
    - 单入口 + 多子路径入口均支持（如 `@smithy/core` 387 文件 → 13 入口、`@aws-sdk/core` 125 → 6、`@noble/hashes` 19 → 17）；
    - CJS 包保持 CJS、ESM 包保持 ESM，不改变包类型语义；
    - CJS 包若为 `module.exports = require_xxx()`（整体赋值）形式，自动追加显式导出声明，确保 `cjs-module-lexer` 能识别命名导出（如 `import { toDataURL } from 'qrcode'`）；
    - 保留被 `package.json` `scripts` 引用的文件（如 `copy-files.js`），避免破坏安装期脚本；
    - 位于资源目录（postinstall 引用）的 JS 一并处理：被引用则合并、未引用则提前删除；
  - **阶段 2 清空复制到项目根的资源**：扫描各包 `postinstall` 引用的目录/文件（如 `templates/` / `static/` / `customize/`），**保留目录结构、清空内容**，让包内 `existsSync` 自检通过；被 import/require 的文件保留不删；
  - **阶段 3 清平台二进制（三层识别 + 平台/架构双维度）**：逐文件判定，删除非当前平台 / 架构的二进制；
    - **三层识别**：① 目录名含其他平台词；② 文件后缀为系统专有（`.exe` / `.dll` / `.dylib` / `.so`）；③ 读文件头魔数（PE `MZ` / ELF `7F454C46` / Mach-O `CFFAEDFE` 等）；
    - **平台 + 架构双维度**：仅平台相同不够，还需架构相同；从 PE 头 `Machine`、ELF 头 `e_machine`、Mach-O 头 `cputype` 解析架构（x64 / arm64 / ia32 / arm），在 win x64 上删 `win32-arm64`、在 mac arm64 上删 `darwin-x64` 等；
    - 目录名可随意改、后缀可缺失，靠文件内容判定；识别不出的（压缩包 / 空壳 / 未知格式）**保守放行**；
    - 删除 `@scope/平台纯二进制包`（如 `@esbuild/win32-x64`、`@flun/passport-desktop-win32-x64-msvc`）；
  - **阶段 4 清开发文件**：删除 `.md` / `.map` / `.d.ts` / `.ts` / `.h` / `.c` / `.gyp` / `tsconfig.json` / `.nycrc` / `.editorconfig` / `package-lock.json` 等非运行文件；**递归进入嵌套 `node_modules`**，清除多层依赖中的同类文件；
  - **阶段 5 清中间产物**：删除 `package.json.orig` 等合并过程中的临时文件；
  - **阶段 6 清不参与运行的文件和空目录**：删除 `license*` / `licence*` / `LICENSE*` / `LICENCE*`（含 `LICENSE-MIT` 等变体）/ `.ts` / `.cts` / `.mts`、顶层 `node` 假包、`node-win*` / `node-darwin*` / `node-linux*` 等平台假包，并自底向上清除空目录（如各包合并后遗留的 `dist/` / `src/`）；
- **优化缓存（内容指纹）**：`.deps-snapshot.json` 记录 `verified` / `platform` / `arch` / `optimizeHash` / `optimized` 等字段；
  - `optimizeHash` 为 `optimize-node-modules.js` 的 SHA256 前 16 位，**优化代码一改，缓存自动失效**，无需手动维护版本号；
  - 只有**整条构建流程成功**（含 electron-builder + Inno Setup）才写入 `verified = true`；构建失败保持 `false`，下次自动重跑，保证 `node_modules` 状态与构建产物一致；
- **优化判断与执行策略**：构建时按三项结果决定动作——**重装并优化** / **仅优化** / **跳过**；
  - 触发**重装**（任一）：无快照 / 依赖清单变化 / 上次构建未完成 / 运行环境（平台、架构）变化 / 缓存目录缺失 / 优化由开启转为关闭 / 优化程序已更新（且上次为优化态）；
  - **仅优化**（不重装）：依赖与环境均未变化，仅优化由关闭转为开启；
  - **跳过**：依赖与环境未变化、上次构建成功、优化状态一致；
- **构建过程提示**：三类动作均打印明确原因，如 `需要重新安装依赖(原因: 依赖清单已变化, 上次构建未完成)`、`依赖与环境未变化,仅需优化`、`依赖与环境未变化,跳过安装与优化`；
- **`--debug` 调试开关**：`npx desktop-builder build --debug` 显示详细日志——优化各阶段明细（合并入口、资源目录 JS、平台/架构删除原因）、electron-builder 完整输出；默认模式下这些噪声被隐藏，仅构建失败时打印 electron-builder 输出便于排查；
- **优化配置**（`desktopAppConfig.js`）：
  - `optimize: { enabled: false }` 关闭优化；
  - `optimize: { exclude: ['包名'] }` 精确排除特定包（如某个包合并后运行异常）；
- **安装目录记忆（`inno.usePreviousAppDir`，默认开启）**：
  - 卸载时用户选择保留数据 → 记录当前安装目录（`HKCU\Software\<appId>\InstallDir`）；
  - 下次安装时自动作为默认安装路径（`usePreviousAppDir: false` 可关闭）；
  - 用户选择清除数据 → 该记录一并删除。
- **卸载清理增强**：
  - **防火墙规则清理**：卸载时自动删除应用同名（`exeName` 去扩展名）的 Windows 防火墙规则，避免应用运行时自动生成的规则随多次安装累积、影响应用行为；
  - **安装目录无条件清理**：卸载时安装目录无论用户是否清除数据都会被清空（原逻辑将安装目录清理绑定在"清除数据"选项上）；
  - **用户数据清理顺序修正**：先终止进程（`taskkill`）再删除用户数据目录，确保文件句柄已释放、删除彻底。
- **构建健壮性**：
  - **上次构建失败 → 强制重装**：快照 `verified !== true` 时不跳过安装，避免残缺 `node_modules` 被沿用导致打包失败；
  - **装前删 `node_modules`**：优化后的树无法在其上增量安装，重装前先清空 `node_modules`，确保干净重装；
  - **失败提示**：打包失败时检查 `dependencies` 声明的包是否实际存在，缺失则精确报出包名，并提示"再次运行构建命令即可自动重装修复"。

### 修复
- **`optimize` 配置读取位置错误（重要）**：原代码读取 `build.optimize`，但配置中 `optimize` 为**顶层字段**，导致 `optimize: { enabled: false }` 完全不生效（始终按默认开启执行）；修正为读取顶层字段，关闭/排除配置恢复正常；
- **`files` 数组职责收窄**：node_modules 内的排除（`.md` / `license` / 平台假包等）**完全交由优化系统处理**，`files` 仅保留工具自身生成文件（`builder.json`）与用户 `excludeFiles`；不再越权代用户排除项目内的 `.ts` / `.map` 等文件；
- **`waitForServer` 冷启动慢（重要）**：原逻辑通过 `dns.promises.lookup(hostname)` 解析 `appUrl` 域名，返回的可能是公网 IPv6，导致每次探测本机服务都绕外网、超时后等待 2 秒重试。修复为直接使用 `127.0.0.1` + 200ms 轮询，冷启动节省数秒；同时删除无用的 `dns` import。
- **卸载静默模式默认选项错误**：原 `MsgBox` 使用 `MB_DEFBUTTON2`（默认"不清理"），静默卸载时用户数据与安装目录都不清；改为 `MB_DEFBUTTON1`（默认清理）。
- **卸载清理脚本位置错误**：原清理脚本写入 `{tmp}`（卸载器临时目录），卸载器退出后目录被清、`cmd` 尚未读取脚本，导致安装目录清理失败；改为写入系统 TEMP（`GetEnv('TEMP')`）。
- **清理脚本变量展开失效**：原 batch 脚本缺少 `setlocal enabledelayedexpansion`，`!retry!` 语法不生效、重试逻辑形同虚设；补充该语句。
- **卸载清理顺序错误**：原逻辑先删除用户数据目录、后终止进程，导致目录被占用、删除不净；改为先 `taskkill` 再删除。
- **防火墙规则名不匹配**：原代码用 `exeName`（含 `.exe`）作为规则名，但 Windows 防火墙自动生成的规则名不含扩展名，导致删除失败；改为剥离 `.exe` 后再匹配。
- **移除 `taskkill` 后的多余等待**：`Exec('taskkill', ..., ewWaitUntilTerminated, ...)` 已等待进程结束、句柄随后释放，原 `Sleep` 属误判；移除后卸载流畅无卡顿。

### 性能
- **实测（中等规模 Node.js 项目）**：
  - 应用冷启动（窗口出现）：约 **8.7s → 4.7s**；
  - 打包后 `node_modules` 文件数：约 **2542 → 590**（-77%）；
  - 打包后 `node_modules` 体积：约 **391MB → 75MB**（-81%）；
  - 首次构建因新增 `esbuild` 依赖与优化流程约增加 10~30 秒，**后续构建命中缓存后无额外开销**。

### 文档
- **README**：补充 `optimize` 配置说明（对象格式）、优化系统工作原理、`--debug` 调试开关、异常时的关闭/排除方式；
- **`desktopAppConfig.js` 模板**：`optimize` 改为对象格式注释（`enabled` 开关、`exclude` 排除）；更新 `usePreviousAppDir` 注释（说明"清除用户数据时一并清除"）。

### 升级注意事项
- **6.0.0 起 `node_modules` 优化默认开启**，用户无需做任何配置即可享受优化收益；
- **优化配置改为对象格式**：`optimize: { enabled: false }` 关闭，`optimize: { exclude: ['包名'] }` 排除；
- **升级后首次构建**会因新增依赖（`esbuild`）与优化流程而变慢，请耐心等待；后续构建命中缓存后无额外开销；
- 若**构建或运行异常**，按以下顺序排查：
  1. 在 `desktopAppConfig.js` 中设置 `optimize: { enabled: false }` 关闭优化，验证是否为优化系统引起；
  2. 若确认是某个包合并后异常，使用 `optimize: { exclude: ['包名'] }` 精确排除该包；
  3. 若需彻底重来，删除临时目录 `%TEMP%\desktop-builder-build`（Windows）后重新构建，工具会自动完整重装依赖并重新优化。
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