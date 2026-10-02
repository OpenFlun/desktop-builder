# 变更日志

## [5.1.1] - 2026-10-02 22:51
### 紧急修复
- **默认禁用 ASAR 打包**：electron-builder v27 默认启用 asar（不传 `asar` 字段即启用），导致打包后 `resources/app` 真实目录被 `app.asar` 替代。本工具的运行架构是「Electron 主进程 + 独立 Node 后端子进程」，而外部 Node 进程无法读取 asar 内文件（`child_process.spawn` 不支持 asar 内路径，工作目录也不能指向 asar 虚拟路径），造成应用启动后立即退出（ExitCode 0）、页面 `ERR_CONNECTION_REFUSED`；现于 `build.js` 的 `configObj` 中**显式设置 `asar: false`**，恢复 `resources/app` 真实目录结构；
- **后端服务不再依赖系统 Node**：`electron-main.js` 原使用 `spawn('node', [serverPath], ...)` 启动后端服务，实际依赖用户机器上已安装 Node（与 README 中"使用 Electron 自带 Node.js"的说明不符）；现改用 `spawn(process.execPath, [serverPath], ...)` 并注入环境变量 `ELECTRON_RUN_AS_NODE: '1'`，直接使用 Electron 内置 Node 运行时，用户无需在机器上安装 Node；运行时已验证：后端进程的可执行文件为 `deskApp.exe`（而非 `node.exe`），系统中无任何 `node.exe` 被创建；
- **`node_modules` 检查方式修正**：`electron-main.js` 原使用 `fs.promises.access(nodeModulesPath, ...)` 判断依赖目录是否存在，该 API 在 Electron 主进程中对某些路径场景（如虚拟文件系统）支持不完整，会误判为"缺失"并退出；现改为同步的 `fs.existsSync`，判断更直接可靠。

### 移除
- **配置模板移除 `asar` 字段**：`desktopAppConfig.js` 中删除 `build.asar` 及其注释。ASAR 与「Electron + Node 后端子进程」的架构天然不兼容，保留该字段只会误导用户；如未来需要支持，应以独立功能形式加入，而非默认开启。

### 优化
- **README 新增「为何禁用 ASAR」说明**：在「简介」章节说明 asar 的设计用途、与 Node 后端子进程的冲突点，以及本工具选择禁用 asar 的决策依据。

## [5.1.0] - 2026-10-02 17:06
### 新增
- **Windows 代码签名完整适配**：
  - `build.win.sign` 现在会正确传递给 `electron-builder`（此前 `win32` 处理器只合并了 `icon`，其余字段被丢弃）；electron-builder v27 要求 `win.sign` 必须带 `type: 'signtool'` 判别字段，模板已补充；
  - `build.inno` 的安装程序签名改为对象格式，用户只需填 `certificateFile` / `certificatePassword` / `algorithm` 三项，`build.js` 自动拼接 `sign /f "证书" /p "密码" /fd 算法 $f` 并完成 Inno Setup 所需的 `$q` 转义；
  - 新增 `resolveSignTool()` 兜底查找签名工具路径：支持完整路径、`PATH` 查找、`Windows Kits\10\bin\<版本>\<arch>` 扫描，全部失败时给出明确中文提示并终止；
  - `SignTool` 指令生成符合 Inno Setup 官方规范（名称通过 `/S<name>=...` 命令行参数定义）；
  - 签名工具名全字符放行，仅拦截含空白或 `=` 的非法名（不静默替换为 `signtool`）。
- **macOS 签名环境变量兜底**：`darwin` 处理器会根据 `mac.sign` 自动注入 `CSC_IDENTITY_AUTO_DISCOVERY` / `CSC_LINK` / `CSC_KEY_PASSWORD` 环境变量给 `electron-builder`。
- **Linux GPG 签名环境变量传递**：`linux` 处理器会根据 `linux.sign` 自动注入 `GPG_PRIVATE_KEY` / `GPG_KEY_PASSPHRASE` 环境变量给 `electron-builder`。

### 修复
- **CLI 入口在 Windows 上可能不触发**：`index.js` 原使用 `import.meta.url === pathToFileURL(process.argv[1]).href` 判断主模块，因盘符大小写差异或 `npm install file:` 生成的 junction 导致判断失败、静默退出（ExitCode 0 但无任何输出）；改用 `fs.realpathSync` 双向归一化 + 大小写不敏感比较。

### 优化
- **配置模板签名段全面规范化**：`desktopAppConfig.js` 的 `build.win.sign` / `build.inno` / `build.mac.sign` / `build.linux.sign` 统一为注释示例风格，硬编码路径（如 `icon.icns`、`entitlements` 文件）改为注释，避免用户未自备对应文件时构建报错。
- **README 文档同步**：
  - 新增「📁 包结构」一节，说明安装后包内目录；
  - 新增「代码签名配置」一节（`build.win.sign` / `build.inno` / `build.mac.sign` / `build.linux.sign`），含自签名测试证书生成步骤；
  - 更新「完整配置示例」中的 `win` / `inno` / `mac` / `linux` 签名段为最新格式。

### 说明
- Windows 签名需要有效的代码签名证书（EKU 含 Code Signing）；普通的 SSL/TLS 证书（如 Let's Encrypt 签发的 lego 证书）**不能用于代码签名**，`signtool` 会因 EKU 过滤导致失败；
- macOS 签名需要 Apple Developer 账号；Linux 签名需要宿主机安装 GPG 密钥及 `dpkg-sig` / `appimagetool`。

## [5.0.1] - 2026-10-02 09:42
### 修复
- **紧急修复**:修正配置示例中长期存在的字段层级错误——`advanced`、`allowScripts`、`excludeFiles`、`excludeDependencies`、`excludeOutputs` 五个自定义字段被错误地放在 `build` 对象内部,现移至配置对象顶层;
  - 该错误在 electron-builder v26 下因 schema 宽松而被掩盖,升级到 electron-builder v27 后因 schema 严格校验,直接导致构建失败(报 `unknown property`);
  - 使用旧版示例配置的用户升级后,需将上述五个字段从 `build` 中移出,放到配置对象顶层;

## [5.0.0] - 2026-10-01 22:43
### 破坏性变更
- 适配 electron-builder v27,配置文件格式发生不兼容变更,旧配置在 electron-builder v27 下会直接报错:
  - `npmRebuild` 移入 `nativeModules.npmRebuild`
  - `asar: false` 改为 `asar: { unpack: [...] }`,默认启用 asar
  - macOS 签名选项移入 `mac.sign` 对象
  - `syncDesktopName` 已被 electron-builder v27 移除,行为变为始终同步
- electron-builder 依赖升级至 `^27.0.0-alpha.9`

### 新增
- 配置模板新增 electron-builder v27 迁移说明注释
- 显式锁定 `toolsets.wine: 'system'`,避免默认值静默漂移

### 优化
- ASAR 配置改用 electron-builder v27 对象格式,消除 asar 禁用警告

## [4.1.7] - 2026-10-01 20:26
### 更新
- 更新了 "electron-builder" 依赖包;
