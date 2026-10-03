# 变更日志
## [5.1.3] - 2026-10-03 11:57
### 优化
- **签名配置早期校验(构建前)**：将 `build.win.sign` 与 `build.inno` 签名的所有配置校验提前到构建开始前(复制文件之前),任何配置错误均在 **1 秒内**报错退出,用户不再需要等几分钟打包完成才发现配置错误;
  - `build.win.sign`: 校验 `type` 必填(缺失时报 `[错误] build.win.sign.type 必填(...)`)、`certificateFile` 与 `identity` 至少配置一个(缺失时报 `[错误] 请配置 build.win.sign 中的 certificateFile 或 identity 字段`)、`certificateFile` 文件必须存在;
  - `build.inno`: 校验 `signingTool` 与 `signToolParams` 必须同时配置(只配其一时报 `[错误] build.inno 的 signingTool 与 signToolParams 必须同时配置` 并提示缺哪个)、`signingTool` 必须能解析出完整路径(找不到时报 `[错误] 找不到签名工具: <名称>`)、`signToolParams.certificateFile` 必填且文件存在;
  - 新增 `resolveCertFile()` 函数:统一处理证书路径绝对化(相对路径基于项目根目录解析)与文件存在性校验;
- **简化 `win32` 与 `inno` 分支**:校验逻辑已提前到构建开头,`win32` 分支不再重复校验,`inno` 签名规范化块仅保留命令行拼接。

## [5.1.2] - 2026-10-03 09:01
### 优化
- 优化配置模板和说明文件的配置示例

## [5.1.1] - 2026-10-02 22:51
### 紧急修复
- **默认禁用 ASAR 打包**：electron-builder v27 默认启用 asar（不传 `asar` 字段即启用），导致打包后 `resources/app` 真实目录被 `app.asar` 替代。本工具的运行架构是「Electron 主进程 + 独立 Node 后端子进程」，而外部 Node 进程无法读取 asar 内文件（`child_process.spawn` 不支持 asar 内路径，工作目录也不能指向 asar 虚拟路径），造成应用启动后立即退出（ExitCode 0）、页面 `ERR_CONNECTION_REFUSED`；现于 `build.js` 的 `configObj` 中**显式设置 `asar: false`**，恢复 `resources/app` 真实目录结构；
- **后端服务不再依赖系统 Node**：`electron-main.js` 原使用 `spawn('node', [serverPath], ...)` 启动后端服务，实际依赖用户机器上已安装 Node（与 README 中"使用 Electron 自带 Node.js"的说明不符）；现改用 `spawn(process.execPath, [serverPath], ...)` 并注入环境变量 `ELECTRON_RUN_AS_NODE: '1'`，直接使用 Electron 内置 Node 运行时，用户无需在机器上安装 Node；运行时已验证：后端进程的可执行文件为 `deskApp.exe`（而非 `node.exe`），系统中无任何 `node.exe` 被创建；
- **`node_modules` 检查方式修正**：`electron-main.js` 原使用 `fs.promises.access(nodeModulesPath, ...)` 判断依赖目录是否存在，该 API 在 Electron 主进程中对某些路径场景（如虚拟文件系统）支持不完整，会误判为"缺失"并退出；现改为同步的 `fs.existsSync`，判断更直接可靠。

### 移除
- **配置模板移除 `asar` 字段**：`desktopAppConfig.js` 中删除 `build.asar` 及其注释。ASAR 与「Electron + Node 后端子进程」的架构天然不兼容，保留该字段只会误导用户；如未来需要支持，应以独立功能形式加入，而非默认开启。

### 优化
- **README 新增「为何禁用 ASAR」说明**：在「简介」章节说明 asar 的设计用途、与 Node 后端子进程的冲突点，以及本工具选择禁用 asar 的决策依据。