# @flun/desktop-builder

> 将任意 Node.js 网站一键打包为当前桌面应用 (Windows, macOS, Linux)（基于 Electron）,支持高度自定义配置;

[![npm version](https://img.shields.io/npm/v/@flun/desktop-builder.svg)](https://www.npmjs.com/package/@flun/desktop-builder)
[![license](https://img.shields.io/npm/l/@flun/desktop-builder.svg)](https://github.com/OpenFlun/desktop-builder/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@flun/desktop-builder.svg)](https://nodejs.org)

---

## 📖 简介

`@flun/desktop-builder` 是一个 **将本地 Node.js Web 应用打包成桌面安装包** 的构建工具;您只需提供一个配置文件,即可生成 Windows（基于 Inno Setup 的安装程序）、macOS（DMG/ZIP）或 Linux（AppImage/Deb/RPM 等）安装程序;

**核心机制**：
- 该工具会将您的 Node.js 后端服务代码（由 `serverPath` 指定）与 Electron 前端整合,打包为一个独立的桌面应用;
- **Electron 本身内置了 Node.js 运行时**,因此打包后的应用在启动时,会使用**自带的 Node.js** 在后台自动运行您的服务脚本;
- 最终用户**无需在电脑上安装 Node.js 或任何其他运行时环境**,双击桌面图标即可直接使用;

**关于 asar 打包**：本工具**不支持也不建议启用** ASAR 打包（electron-builder 的 `asar` 配置）。原因如下：

- 本工具的运行架构是「Electron 主进程 + 独立 Node.js 后端子进程」：主进程通过 `child_process.spawn` 启动一个外部 Node 进程来运行您的后端服务（`serverPath` 指定的脚本）；
- 外部 Node 进程**不加载 Electron 的 fs 补丁**，无法读取 asar 归档内的文件；同时 asar 虚拟路径也**不能作为子进程的工作目录**（Windows 的 `CreateProcess` 会直接报 ENOENT）；
- 因此启用 asar 后，后端服务会启动失败（表现为应用启动后立即退出、页面 `ERR_CONNECTION_REFUSED`）；
- 本工具已在 `build.js` 中显式设置 `asar: false`，确保打包后的 `resources/app` 始终是真实目录结构。

> **⚠️ 老用户注意（曾启用过 asar 的版本）**：如果您的机器上曾用早期版本（启用了 asar）构建过，`node_modules` 可能已被 asar 打包过程残留破坏（部分包的内部文件缺失但目录结构还在）。本工具从 v5.1.4 起会在每次安装前先删除依赖快照、安装成功后再写回，因此**任何中断或异常状态都会在下次构建时自动触发完整重装**，无需手动干预。若您升级后首次构建仍遇到模块缺失，可手动删除临时目录缓存强制重装：
>
> ```powershell
> # 清理构建临时目录（Windows 示例，具体路径取决于系统）
> Remove-Item "$env:TEMP\desktop-builder-build" -Recurse -Force
> ```

---

## ✨ 特性

- 🚀 **一键打包**：基于 `electron-builder` 和 Inno Setup,快速生成当前平台的安装包;
- ⚙️ **高度可配置**：通过单一 `desktopAppConfig.js` 控制窗口、图标、菜单、安装选项、签名、压缩等;
- 🖥️ **跨平台支持**：Windows、macOS、Linux（仅构建当前运行平台,但支持输出多种格式）;
- 🔌 **自带 Node.js 运行时**：利用 Electron 内置的 Node.js 执行后端服务,用户无需额外安装;
- 📦 **灵活的安装选项**：Windows 使用 Inno Setup（支持自定义向导样式、语言、快捷方式等）,macOS 支持 DMG/ZIP,Linux 支持 AppImage/Deb 等;
- 🎨 **品牌自定义**：应用图标、安装/卸载图标、DMG 卷宗图标、背景图片、向导图片等;
- 🧩 **菜单自定义**：完全自定义应用菜单（语言、角色、点击回调,甚至内联函数）;
- 📁 **精细排除**：可排除不需要的文件、依赖包和最终输出文件（`excludeFiles` 同时在复制和打包阶段生效）;
- 🔧 **可扩展**：允许直接添加 `electron-builder` 任意配置字段;
- 📦 **依赖预打包**：构建时自动判断是否安装生产依赖并打包进应用,用户**首次启动无需联网**,开箱即用;
- 🎨 **主题切换支持**：通过菜单配置轻松切换浅色/深色/跟随系统主题;

---

## 📁 包结构

安装后 `@flun/desktop-builder` 包内结构如下（也可参考项目根目录被自动复制出的文件）：

```
@flun/desktop-builder/
├── build/                    # 默认资源（图标、安装向导图）
│   ├── icon.png              # 应用图标（512×512 PNG，跨平台默认）
│   ├── setup.ico             # Windows 安装程序图标
│   ├── uninstallerIcon.ico   # Windows 卸载程序图标
│   ├── wizard.bmp            # Inno Setup 左侧大图（164×314 BMP）
│   └── wizardSmall.bmp       # Inno Setup 右上小图（55×58 BMP）
├── build.js                  # 构建主逻辑（复制文件、安装依赖、electron-builder、Inno Setup 打包）
├── copy-files.js             # postinstall 脚本：复制配置模板与 build/ 到项目根目录
├── desktopAppConfig.js       # 配置文件模板（安装时复制到项目根目录）
├── electron-main.js          # Electron 主进程模板（构建时替换占位符生成 main.mjs）
├── index.js                  # CLI 入口（desktop-builder build / help）
├── index.d.ts                # TypeScript 类型声明
├── LICENSE
├── CHANGELOG.md
└── README.md
```

> **说明**：`postinstall` 会把 `desktopAppConfig.js` 和 `build/` 复制到项目根目录（若不存在），因此项目根目录下也会出现同名文件；后续修改请以项目根目录下的副本为准。

---

## 基础配置

### 允许安装脚本执行

本包在安装时可能触发某些依赖包的自动脚本（如 `postinstall` 等）;如果你的 npm 全局配置或项目配置禁止了脚本执行（例如设置了 `ignore-scripts=true`）,可能会导致安装不完整或运行时异常;

推荐在项目根目录的 `package.json` 中添加 `allowScripts` 字段,显式放行本包及其依赖的脚本：

```json
{
  "allowScripts": {
    "@flun/desktop-builder": true
    // 如果依赖的其它包（如 bcrypt、electron-winstaller 等）也有脚本,请按需添加,格式相同
  }
}
```

> 如果你信任所有安装包,也可以直接在项目 `.npmrc` 中设置 `allow-scripts = false`（表示关闭脚本拦截,所有脚本均允许执行）,或删除 `allow-script` 字段;

> 另外，`desktopAppConfig.js` 中的顶层 `allowScripts` 用于构建阶段安装生产依赖时放行指定包名的安装脚本，与上面的 npm 安装脚本放行场景不同。

### 下载依赖(Windows)
  - 官网:https://jrsoftware.org/isdl.php
  - 国内 https://gitee.com/OpenFlun/inno-setup/releases

1. 大部分情况下无需手动下载,当前版本以植入自动下载安装;
2. 安装版手动安装时一定要选择默认安装路径,不然会因为找不到文件而构建失败;
3. 如果你是在国内下载的便捷版压缩文件,请解压到 "C:\Users\你的用户名\.electron-builder-cache" 下;

---

## 📦 安装

在你的项目目录下安装为开发依赖：

```bash
npm install -D @flun/desktop-builder
```

安装完成后,`postinstall` 脚本会自动将 `desktopAppConfig.js` 配置文件模板以及 `build/` 目录（含默认图标等资源）复制到你的项目根目录（如果不存在）;

---

## 🚀 快速开始

### 1. 配置 `desktopAppConfig.js`

在项目根目录创建或编辑 `desktopAppConfig.js`,填写必填字段（自行替换）：

```javascript
export default {
  serverPath: './server.js',          // Node.js 启动脚本路径
  appUrl: 'http://www.abc.com:7296',  // 启动后访问的地址
  appName: '我的桌面应用',             // 应用显示名称
};
```

### 2. 构建桌面应用

执行构建命令（根据当前系统生成对应安装包）：

```bash
npx desktop-builder build
```

或以编程方式构建：

```js
import { build } from '@flun/desktop-builder';
await build();
```

首次运行会下载 Electron 运行时（约 100MB）,请耐心等待;
构建完成后,安装包将输出到 `./dist` 目录（可通过 `build.outputDir` 自定义）;

---

## ⚙️ 完整配置项

所有配置均在 `desktopAppConfig.js` 中定义,字段说明如下（`*` 为必填）：

| 字段                  | 类型       | 默认值   | 说明                                                                            |
| --------------------- | ---------- | -------- | ------------------------------------------------------------------------------- |
| **`serverPath`**      | `string`   | **必填** | Node.js 启动脚本路径（相对于项目根目录）                                        |
| **`appUrl`**          | `string`   | **必填** | 应用访问地址（如 `http://localhost:7296`）                                      |
| **`appName`**         | `string`   | null     | 应用显示名称（标题栏、快捷方式、安装程序等）                                    |
| `enableLogging`       | `boolean`  | `false`  | 是否启用日志文件（调试用）,日志会写入桌面 `myapp_debug.log`                     |
| `window`              | `object`   | 见下方   | 主窗口外观与行为配置（部分字段会被强制覆盖,请注意说明）                         |
| `menu`                | `array`    | 见示例   | 应用菜单模板（支持角色、分隔符、点击回调）                                      |
| `build`               | `object`   | 见下方   | 打包输出配置（可随意添加 `electron-builder` 支持的其他字段）                    |
| `advanced`            | `object`   | 见下方   | 高级运行行为                                                                    |
| `allowScripts`        | `object`   | `{}`     | 允许执行安装脚本的包名列表（构建阶段使用）                                      |
| `excludeFiles`        | `string[]` | `[]`     | 复制到临时目录时排除的文件/目录（支持 glob）,**同时会追加到打包阶段的排除规则** |
| `excludeDependencies` | `string[]` | `[]`     | 从最终依赖列表中移除的 npm 包名（不会打包）                                     |
| `excludeOutputs`      | `string[]` | `[]`     | 从最终输出目录中排除的安装包文件（如 `*.blockmap`、`latest.yml`）               |

---

### 窗口配置 (`window`)

```javascript
window: {
  width: 1200,                    // 默认宽度 (px)
  height: 800,                    // 默认高度 (px)
  minWidth: 800,                  // 最小宽度
  minHeight: 600,                 // 最小高度
  maxWidth: undefined,            // 最大宽度（不限制则留空）
  maxHeight: undefined,           // 最大高度（不限制则留空）
  resizable: true,                // 是否可调整大小
  fullscreenable: true,           // 是否允许全屏
  alwaysOnTop: false,             // 是否始终置顶
  frame: true,                    // 是否显示窗口边框（标题栏、关闭按钮）
  titleBarStyle: 'default',       // 标题栏样式：'default' | 'hidden' | 'hiddenInset'（仅 macOS）
  backgroundColor: '#5127ce',     // 加载时的背景色
  show: false,                    // 是否立即显示窗口（false 可等页面渲染后再显示,防白屏）
  webPreferences: {
    // ⚠️ 以下三项会被强制覆盖,配置无效（实际运行值以强制为准）：
    nodeIntegration: false,       // 实际强制为 true
    contextIsolation: true,       // 实际强制为 false
    sandbox: false,               // 实际强制为 false

    // ✅ 其他 webPreferences 属性均可自由配置,例如：
    plugins: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    enableWebAuthn: true,
    // ... 更多 electron 支持选项
  },
}
```

> **⚠️ 重要安全与行为警告**
> 由于本工具需要从渲染进程启动和管理 Node.js 后端服务,`electron-main.js` 在创建窗口时会**强制覆盖** `webPreferences` 中的 `nodeIntegration`、`contextIsolation` 和 `sandbox` 三个属性：
> - `nodeIntegration: true`  （开启,渲染进程可使用 Node.js API）
> - `contextIsolation: false`（关闭,渲染进程可直接访问 Electron 模块）
> - `sandbox: false`          （关闭,以保证服务能够正常运行）
>
> **这意味着：**
> - 您在配置中设置的这三项 **不会生效**,实际运行时将以强制值为准；
> - **渲染进程拥有完整的 Node.js 能力**,因此**请确保您的应用仅加载受信任的本地内容**,不要加载任何外部网页,否则存在严重安全风险；
> - 此设计是为了保证后端服务自动启动等核心功能正常工作,**不建议用户尝试重新关闭这些选项**,否则可能导致应用无法运行；
> - 除上述三项外,其他 `webPreferences` 选项（如 `plugins`、`webSecurity`、`enableWebAuthn` 等）**均正常生效**,您可以按需配置;

---

### 菜单配置 (`menu`)

支持 Electron 标准菜单模板,可自由修改语言和结构;示例：

```javascript
menu: [
  {
    label: '文件',
    submenu: [
      { role: 'close', label: '关闭' },
      { type: 'separator' },
      { role: 'quit', label: '退出' }
    ]
  },
  // ... 更多菜单
]
```

- 支持 `role`（标准角色）、`label`、`type`、`click` 等；
- 特殊字符串 `'__TOGGLE_BROWSER__'` 会被替换为“在浏览器中打开”功能（调用系统默认浏览器打开 `appUrl`）；
- `click` 也可直接写函数字符串（需可被 `eval` 执行,例如 `"() => { ... }"`）;

---

### 打包配置 (`build`)

`build` 对象除了下面列出的常用子字段,**还支持直接写入任何 `electron-builder` 官方支持的配置项**（如 `compression`、`extraResources`、`publish` 等）,它们会被合并到最终 `builder.json` 中;

**重要说明**：工具内部硬编码了以下 `files` 排除规则（您无需手动配置）：

- `!builder.json`
- `!**/*.map`、`!**/*.ts`、`!**/*.cts`、`!**/*.mts`
- `!node_modules/**/*.md`、`!node_modules/**/*.markdown`、`!node_modules/**/license*`、`!node_modules/**/licence*`、
  `!node_modules/**/LICENSE*`、`!node_modules/**/LICENCE*`、`!node_modules/node/**`、
  `!node_modules/node-win*/**`、`!node_modules/node-darwin*/**`、`!node_modules/node-linux*/**`、
  `!node_modules/node-freebsd*/**`、`!node_modules/node-sunos*/**`、`!node_modules/node-aix*/**`

如果您需要额外排除文件,请使用 `excludeFiles`（它会自动转换为 `files` 排除规则）;

```javascript
build: {
  appId: 'com.example.app',           // 应用唯一标识（反向域名格式）
  outputDir: './dist',                // 安装包输出目录
  publisher: null,                    // 发布者名称（默认从 package.json 读取 author）
  shortcutName: null,                 // 快捷方式名称（默认使用 appName）

  // 原生模块配置
  // npmRebuild: false = 不重编译原生模块,减少构建时间
  // electron-builder v27 变更:原生模块选项统一收拢到 nativeModules 对象下
  nativeModules: {
    npmRebuild: false,
  },

  // 工具集配置:指定构建时使用的辅助工具版本
  // wine: 'system' = 使用宿主机已安装的 Wine
  // 用于在 macOS 上构建 Windows 目标,需先执行: brew install --cask wine-stable
  // electron-builder v27 变更:显式锁定 wine 版本,避免默认值静默漂移
  toolsets: {
    wine: 'system',
  },

  // ----- Windows 配置（electron-builder 部分）-----
  win: {
    // target 会自动加入 'dir',以确保生成 win-unpacked 目录供 Inno Setup 使用
    icon: './build/icon.png',         // 应用图标（建议 512×512 PNG）
    // 其他可选：publisherName 等
    // 应用本体签名（electron-builder v27: 统一移入 sign 对象,必须带 type 字段）
    // 签名对象：打包进安装包的应用可执行文件（与下方 inno 的签名字段职责不同）
    // sign: {
    //   type: 'signtool',                                     // 必填,固定为 'signtool'(v27 判别字段)
    //   certificateFile: './build/cert.pfx',                  // 证书文件路径(.pfx)
    //   certificatePassword: process.env.CSC_KEY_PASSWORD,    // 证书密码(推荐用环境变量)
    //   signingHashAlgorithms: ['sha256'],
    // },
  },

  // ----- Windows Inno Setup 配置（专用于生成安装程序）-----
  inno: {
    // 基础信息
    appName: undefined,               // 应用显示名称（默认使用 appName）
    appVersion: undefined,            // 版本号（默认从 package.json 读取 version）
    appPublisher: undefined,          // 发布者（默认使用 build.publisher 或 package.json author）
    appId: undefined,                 // 应用唯一标识（默认使用 build.appId）
    defaultDirName: null,             // 默认安装目录,支持变量（如 '{autopf}\\MyApp'）
    defaultGroupName: undefined,      // 开始菜单文件夹名（默认 appName）
    outputDir: undefined,             // 输出目录（默认使用 build.outputDir）
    outputBaseFilename: undefined,    // 安装包文件名（默认 `${appName}Setup`）

    // 界面控制
    disableWelcomePage: false,
    disableDirPage: false,
    disableProgramGroupPage: false,
    disableFinishedPage: false,
    disableReadyPage: false,
    disableReadyMemo: false,
    disableStartupPrompt: false,
    showLanguageDialog: true,
    flatComponentsList: false,
    showComponentSizes: false,
    showTasksTreeLines: false,

    // 图标与图片
    setupIconFile: './build/setup.ico',          // 安装程序图标（.ico）
    uninstallDisplayIcon: './build/uninstallerIcon.ico', // 卸载程序图标

    // 向导样式与背景
    WizardStyle: 'dynamic',             // modern/classic/dynamic/dark/light...
    WizardImageFile: './build/wizard.bmp',        // 左侧大图（164×314 BMP）
    WizardSmallImageFile: './build/wizardSmall.bmp', // 右上小图（55×58 BMP）
    WizardImageBackColor: '#CE2751',    // 标准模式下左侧大图背景色
    WizardSmallImageBackColor: '#CE2751',
    WizardBackColor: '#CE2751',
    WizardImageStretch: true,
    // 深色模式（仅当 WizardStyle='dynamic' 时生效）
    WizardImageFileDynamicDark: './build/wizard.bmp',
    WizardSmallImageFileDynamicDark: './build/wizardSmall.bmp',
    WizardImageBackColorDynamicDark: '#228866',
    WizardSmallImageBackColorDynamicDark: '#228866',
    WizardBackColorDynamicDark: '#228866',

    // 权限
    privilegesRequired: 'lowest',       // admin / lowest / poweruser
    privilegesRequiredOverridesAllowed: 'dialog',

    // 压缩
    compression: 'lzma2',               // lzma2 / zip / none
    solidCompression: true,
    LZMADictionarySize: 4096,           // KB
    LZMANumFastBytes: 64,

    // 快捷方式
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: undefined,            // 快捷方式名称（默认 appName）

    // 安装后运行
    runAfterInstall: true,
    runDescription: '运行应用',

    // 高级选项
    languageDetectionMethod: 'uilanguage',
    allowCancelDuringInstall: true,
    usePreviousAppDir: true,
    usePreviousGroup: true,
    usePreviousSetupType: true,
    usePreviousTasks: true,
    usePreviousLanguage: true,
    updateUninstallLogAppName: false,
    uninstallable: true,
    createUninstallRegKey: true,
    uninstallDisplayName: '卸载(destApp)',
    uninstallLogMode: 'append',
    appSupportURL: undefined,
    appUpdatesURL: undefined,
    appPublisherURL: '',
    appReadmeFile: '',
    appContact: '',
    appComments: '',
    versionInfoVersion: undefined,
    versionInfoDescription: undefined,
    versionInfoCopyright: undefined,
    versionInfoCompany: undefined,
    // 安装程序签名（Inno Setup 自身机制）
    // 签名对象：安装程序 Setup.exe 与卸载程序 unins000.exe（与上方 win.sign 职责不同）
    // 公共说明：signingTool 与 signToolParams 需同时配置才会启用签名，缺少任一则不签名
    signedUninstaller: false,                  // 是否为卸载程序签名
    signingTool: undefined,                    // 签名工具（短名如 'signtool.exe' 自动查找，或完整路径）
    // 签名参数（对象格式，仅需填 certificateFile/certificatePassword/algorithm 三项）
    // signToolParams: {
    //   certificateFile: './build/cert.pfx',
    //   certificatePassword: 'your-password',
    //   algorithm: 'sha256',
    // },
    minVersion: '10.0.17763',            // 最低 Windows 版本
    onlyBelowVersion: '',
    useSetupLdr: true,

    // 更多 Inno Setup 字段请参考官方文档：https://jrsoftware.org/ishelp/index.php?topic=setup
    // 或本人整理的中文文档:https://gitee.com/OpenFlun/inno-setup
  },

  // ----- macOS 配置 -----
  mac: {
    target: ['dmg', 'zip'],          // 同时生成 dmg 和 zip（zip 可用于自动更新）
    icon: './build/icon.icns',       // 应用图标,建议 512x512 .icns
    // 代码签名与公证配置（electron-builder v27: 统一移入 sign 对象）
    // 公共说明: identity 与 certificateFile 二选一; certificatePassword 留空则自动读 CSC_KEY_PASSWORD
    // sign: {
    //   identity: 'Developer ID Application: Your Name (TEAM123)',  // 与 certificateFile 二选一
    //   certificateFile: undefined,                                 // .p12 路径（与 identity 二选一）
    //   certificatePassword: process.env.CSC_KEY_PASSWORD,          // 证书密码
    //   hardenedRuntime: true,                                      // 启用 Hardened Runtime（公证必需）
    //   entitlements: './build/entitlements.mac.plist',             // 需自备
    //   entitlementsInherit: './build/entitlements.mac.inherit.plist', // 需自备
    //   // notarize: { teamId: 'TEAM123', appleId: 'your@email.com', appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD },
    // },
  },
  dmg: {
    iconSize: 80,
    window: { width: 540, height: 380 },
    // 增强选项（可选）
    // background: './build/background.png',       // 背景图片
    // backgroundColor: '#5127ce',               // 无背景图时的背景色
    // icon: 'build/dmg-icon.icns',               // 卷宗图标
    // title: '${productName} ${version}',         // 卷宗名称
    // format: 'UDZO',                             // 压缩格式
    // contents: [                                 // 自定义图标布局
    //   { x: 130, y: 220, type: 'file' },
    //   { x: 410, y: 220, type: 'link', path: '/Applications' }
    // ]
  },

  // ----- Linux 配置 -----
  linux: {
    target: ['AppImage', 'deb'],     // 可同时生成多种格式：AppImage / deb / rpm / snap / flatpak 等
    category: 'Development',         // 系统菜单分类（如 Utility, Network, Development 等）
    // Linux 图标无需显式配置，只需在 ./build 目录下提供符合尺寸和格式的 icon.png（建议 512×512 PNG）
    // 可选高级字段
    // description: '完整的应用描述',
    // synopsis: '简短描述',
    // maintainer: '你的名字 <email@example.com>',
    // vendor: '我的公司',
    // executableArgs: ['--enable-features=...'],
    // desktop: {                    // 自定义 .desktop 文件
    //   entry: {
    //     Name: '我的应用',
    //     Comment: '一个很棒的应用',
    //     Categories: 'Development;Utility;',
    //     Keywords: 'app;tool;',
    //     Terminal: false,
    //     Type: 'Application'
    //   }
    // },
    // electron-builder v27 变更: syncDesktopName 已被移除,行为变为始终同步 .desktop 文件名与窗口类名
    // electron-builder v27 变更: executableArgs 会被注入 <executableName>-launcher 脚本,生成的 .desktop Exec 指向该脚本
    // 代码签名:GPG 签名(deb 通过 dpkg-sig,AppImage 通过 appimagetool)
    // 公共说明:electron-builder 本身不签名 Linux 包,签名由底层工具完成;
    //           需先在宿主机安装 GPG 密钥,推荐用环境变量传入密钥与密码
    // sign: {
    //   gpgPrivateKey: process.env.GPG_PRIVATE_KEY,       // GPG 私钥(ASCII-armored 内容)
    //   gpgKeyPassphrase: process.env.GPG_KEY_PASSPHRASE, // GPG 密钥密码
    // },
  },
  // 特定格式的额外配置（可选）
  // appImage: { systemIntegration: 'doNotAsk' },
  // deb: { depends: ['libgtk-3-0'] },
}
```

> **平台说明**：构建时只生成**当前运行操作系统**对应的安装包（例如 Windows 下生成 `.exe` 安装程序）;

---

### 高级选项 (`advanced`)

```javascript
advanced: {
  autoStartServer: true,   // 应用启动时自动运行后端服务
  autoKillServer: true,    // 应用退出时自动关闭后端服务
}
```

---

### 排除文件 (`excludeFiles`)

在复制项目文件到临时构建目录时,排除指定的文件或目录（支持 glob 模式）;
**新行为（v3.0.0）**：这些模式会自动转换为 `electron-builder` 的排除规则（添加 `!` 前缀）,因此也会在**打包阶段生效**;

示例：

```javascript
excludeFiles: [
  '.vscode/',
  '.git/',
  'dist/',
  '*.log',
  './yarn.lock',
]
```

- 以 `/` 结尾表示目录及其内容；
- 以 `./` 开头表示仅匹配根目录下的文件（非递归）；
- 否则匹配任意路径的该模式（`minimatch` 全局匹配）;

> **注意**：依赖现在已预打包,因此不再需要排除 `node_modules`（除非您有特殊需求,但不建议）;

---

### 排除依赖包 (`excludeDependencies`)

从最终安装的依赖列表中移除指定的 npm 包（这些包不会被安装到应用内）;
常用于排除构建工具自身依赖或无用依赖（如 `@flun/desktop-builder`）;

```javascript
excludeDependencies: [
  '@flun/desktop-builder'
]
```

---

### 排除输出文件 (`excludeOutputs`)

在将构建好的安装包从临时目录复制到最终输出目录时,排除某些文件（如 `*.blockmap`、`latest.yml`）;

```javascript
excludeOutputs: [
  '*.blockmap',
  'latest.yml'
]
```

> 注意：此过滤**不影响** `electron-builder` 的构建过程,仅影响复制到输出目录的文件;

---

### 代码签名配置 (`build.win.sign` / `build.inno` / `build.mac.sign` / `build.linux.sign`)

本工具已内置跨平台签名适配，**用户只需填写最少的字段，其余转义、拼接、查找、校验均由构建脚本自动完成**。

#### 一、Windows 应用本体签名 (`build.win.sign`)

`electron-builder` v27 要求 `win.sign` 必须带 `type` 判别字段，取消模板中的注释后按实际填写：

```js
build: {
  win: {
    icon: './build/icon.png',
    sign: {
      type: 'signtool',                                     // 必填，固定为 'signtool'
      certificateFile: './build/cert.pfx',                  // 证书文件路径（.pfx）
      certificatePassword: process.env.CSC_KEY_PASSWORD,    // 证书密码（推荐用环境变量）
      signingHashAlgorithms: ['sha256'],
    },
  },
}
```

- 环境变量 `CSC_KEY_PASSWORD` 需在构建前设置；
- 该签名作用于打包后的应用可执行文件（如 `deskApp.exe`）及所有 `.exe` 附带程序（如 `lego.exe`）；
- 不填 `win.sign` 时跳过签名，构建仍正常完成。

**配置严格校验（构建前）**：

为避免用户等几分钟打包完才发现配置错误，本工具在**构建开始前**（复制文件之前）即校验 `win.sign`，任何问题都会在 **1 秒内**报错退出：

- `type` 必填，缺失时报 `[错误] build.win.sign.type 必填(...)`；
- `certificateFile` 与 `identity` 至少配置一个，缺失时报 `[错误] 请配置 build.win.sign 中的 certificateFile 或 identity 字段`；
- `certificateFile` 指向的文件必须存在，否则报 `[错误] 证书文件不存在: <绝对路径>`。

#### 二、Windows 安装程序与卸载程序签名 (`build.inno`)

`build.inno` 下三个字段只需填最基本的 3 项即可：

```js
build: {
  inno: {
    signedUninstaller: true,               // 是否同时为卸载程序 unins000.exe 签名
    signingTool: 'signtool.exe',           // 签名工具：可填短名（自动查找）或完整路径
    signToolParams: {                      // 对象格式，仅需 3 项
      certificateFile: './build/cert.pfx',
      certificatePassword: 'your-password',
      algorithm: 'sha256',                 // 默认 sha256
    },
  },
}
```

**自动兜底机制**：

1. **`signingTool` 自动查找**：填 `'signtool.exe'` 时，构建脚本会按以下顺序查找完整路径：
   - 若填的是绝对路径 → 直接验证存在性；
   - 否则调用 `where signtool.exe` 查 `PATH`；
   - 再依次扫描 `%ProgramFiles(x86)%\Windows Kits\10\bin\<版本>\<arch>\signtool.exe`（`x64` / `x86` / `arm64`，版本从高到低）。
   - 全部失败时给出中文提示并终止，**不会静默使用错误的工具**。
2. **`signToolParams` 对象自动拼接**：`build.js` 会自动拼成 `sign /f "证书" /p "密码" /fd 算法 $f`，并自动完成 Inno Setup 所需的 `$q` 引号转义，用户**无需关心任何转义字符**。
3. **合法性校验**：
   - `certificateFile` 必填，且文件必须存在；
   - `signingTool` 解析出的工具名若含空白或 `=`，则报错退出（其他字符全部放行）。
4. **`SignTool` 指令生成**：脚本自动将工具名写入 `.iss` 的 `[Setup]` 段，并通过 `/S<name>=...` 命令行参数向 ISCC 传入完整命令，符合 Inno Setup 官方规范。

**配置严格校验（构建前）**：

与 `win.sign` 一样，`inno` 签名配置也在**构建开始前**完成校验，任何问题 **1 秒内**报错退出：

- `signingTool` 与 `signToolParams` **必须同时配置**：只配其一时报 `[错误] build.inno 的 signingTool 与 signToolParams 必须同时配置`，并提示缺哪个；
- `signingTool` 解析失败时报 `[错误] 找不到签名工具: <名称>`；
- `signToolParams.certificateFile` 必填，缺失时报 `[错误] signToolParams.certificateFile 必填`；
- `certificateFile` 指向的文件必须存在，否则报 `[错误] 证书文件不存在: <绝对路径>`。

#### 三、生成自签名测试证书（仅用于本地验证）

正式发布请使用受信任 CA 签发的代码签名证书。若只是想本地验证签名流程，可用 PowerShell 生成一张自签名的代码签名证书：

```powershell
$pwd = ConvertTo-SecureString -String "证书密码" -Force -AsPlainText
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=Test Code Signing" `
  -CertStoreLocation Cert:\CurrentUser\My `
  -NotAfter (Get-Date).AddYears(1)
Export-PfxCertificate -Cert $cert -FilePath "证书文件路径" -Password $pwd
```

- `-Type CodeSigningCert` 必须带，否则证书 EKU 不含 Code Signing，`signtool` 会直接过滤掉；
- 生成的 `.pfx` 可配合 `build.win.sign` 与 `build.inno.signToolParams` 使用；
- 自签名证书**不被系统信任根**，`signtool verify` 时会提示 `A certificate chain processed, but terminated in a root`，这是预期结果。

#### 四、macOS 签名与公证 (`build.mac.sign`)

`mac.sign` 中的所有选项在 v27 已统一收拢到 `sign` 对象下，模板中已给出注释示例：

```js
build: {
  mac: {
    sign: {
      identity: 'Developer ID Application: Your Name (TEAM123)',  // 与 certificateFile 二选一
      certificateFile: undefined,                                 // .p12 路径
      certificatePassword: process.env.CSC_KEY_PASSWORD,
      hardenedRuntime: true,                                      // 公证必需
      entitlements: './build/entitlements.mac.plist',
      entitlementsInherit: './build/entitlements.mac.inherit.plist',
      notarize: {                                                 // 自动公证（需 Apple 账号）
        teamId: 'TEAM123',
        appleId: 'your@email.com',
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      },
    },
  },
}
```

**环境变量兜底**：若用户未在配置中填写，`build.js` 会自动识别并注入以下环境变量给 `electron-builder`：

| 配置字段                                  | 对应环境变量                       | 说明             |
| ----------------------------------------- | ---------------------------------- | ---------------- |
| `sign.identity` 或 `sign.certificateFile` | `CSC_IDENTITY_AUTO_DISCOVERY=true` | 显式开启证书发现 |
| `sign.certificateFile`                    | `CSC_LINK`                         | 证书文件路径     |
| `sign.certificatePassword`                | `CSC_KEY_PASSWORD`                 | 证书密码         |

#### 五、Linux 包签名 (`build.linux.sign`)

`electron-builder` **本身不签名 Linux 包**，实际签名依赖底层工具：`deb` 通过 `dpkg-sig`、AppImage 通过 `appimagetool --sign`，均基于 GPG 密钥。模板中已给出注释示例：

```js
build: {
  linux: {
    sign: {
      gpgPrivateKey: process.env.GPG_PRIVATE_KEY,       // GPG 私钥（ASCII-armored 内容）
      gpgKeyPassphrase: process.env.GPG_KEY_PASSPHRASE, // GPG 密钥密码
    },
  },
}
```

**环境变量兜底**：`build.js` 会自动把上述两项转换为 `GPG_PRIVATE_KEY` / `GPG_KEY_PASSPHRASE` 传给 `electron-builder`。使用前请确保宿主机已安装 `dpkg-sig`、`appimagetool` 及对应的 GPG 密钥。

---

## 🖥️ 完整配置示例

以下是一个包含所有常用配置的 `desktopAppConfig.js` 示例：

```javascript
export default {
  serverPath: './server.js',
  appUrl: 'http://www.abc.com:7296',
  appName: 'My Express App',
  enableLogging: false,

  window: {
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    frame: true,
    show: false,
    backgroundColor: '#f0f0f0',
    webPreferences: {
      // 以下三项强制覆盖,配置无效
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      // 其他有效配置
      plugins: true,
      webSecurity: true,
    },
  },

  menu: [
    {
      label: '文件',
      submenu: [
        { role: 'close', label: '关闭' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    // ... 其他菜单
  ],

  build: {
    appId: 'com.mycompany.myapp',
    outputDir: './release',

    win: {
      icon: './build/icon.png',
    },
    inno: {
      appName: 'My App',
      appVersion: '1.0.0',
      appPublisher: 'My Company',
      defaultDirName: '{autopf}\\My App',
      defaultGroupName: 'My App',
      outputBaseFilename: 'MyAppSetup',
      WizardStyle: 'dynamic',
      WizardImageFile: './build/wizard.bmp',
      WizardSmallImageFile: './build/wizardSmall.bmp',
      setupIconFile: './build/setup.ico',
      uninstallDisplayIcon: './build/uninstallerIcon.ico',
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      runAfterInstall: true,
      compression: 'lzma2',
    },

    mac: {
      target: ['dmg', 'zip'],
      // icon: './build/icon.icns',           // 需自备 .icns 文件
      // 代码签名与公证配置(electron-builder v27: 统一移入 sign 对象)
      // 公共说明:identity 与 certificateFile 二选一;certificatePassword 留空则自动读 CSC_KEY_PASSWORD
      // sign: {
      //   identity: 'Developer ID Application: Your Name (TEAM123)',
      //   certificateFile: undefined,
      //   certificatePassword: process.env.CSC_KEY_PASSWORD,
      //   hardenedRuntime: true,
      //   entitlements: './build/entitlements.mac.plist',
      //   entitlementsInherit: './build/entitlements.mac.inherit.plist',
      // },
    },
    dmg: {
      iconSize: 80,
      window: { width: 540, height: 380 },
      background: './build/background.png',
      backgroundColor: '#ffffff',
    },

    linux: {
      target: ['AppImage', 'deb'],
      category: 'Development',
      description: '一个功能强大的应用',
      maintainer: '我的名字 <my@email.com>',
      vendor: '我的公司',
      // 代码签名:GPG 签名(deb 通过 dpkg-sig,AppImage 通过 appimagetool)
      // 公共说明:需先在宿主机安装 GPG 密钥,推荐用环境变量传入
      // sign: {
      //   gpgPrivateKey: process.env.GPG_PRIVATE_KEY,
      //   gpgKeyPassphrase: process.env.GPG_KEY_PASSPHRASE,
      // },
    },

    // 额外 electron-builder 字段（示例）
    compression: 'maximum',
    extraResources: [{ from: './assets', to: './assets' }],
  },

  advanced: {
    autoStartServer: true,
    autoKillServer: true,
  },

  allowScripts: {
    'node': true,
    '@flun/webauthn-server': true,
  },

  excludeFiles: [
    '.vscode/',
    '.git/',
    'dist/',
    '*.log',
    './yarn.lock',
    './desktopAppConfig.js',
  ],

  excludeDependencies: [
    '@flun/desktop-builder',
  ],

  excludeOutputs: [
    '*.blockmap',
    'latest.yml'
  ],
};
```

---

## 🌐 关于网络依赖与构建性能

### 默认行为（v3.0.0+）：构建时打包依赖

- **构建时**会自动执行 `npm install --production`,将 `node_modules` 完整打包进应用;
- **用户首次启动无需联网**,开箱即用;
- **安装包体积会增大,构建和安装时间会增长**（包含依赖）,但这是换取流畅用户体验的代价;
> **如果你希望更好的体验请安装 v4.0.0 ,将带给你不一样的体验;

### 如何回退到运行时安装依赖（旧行为）

如果您希望减小安装包体积,减少构建和安装时间,并允许用户首次启动时联网安装依赖,请安装 `v2.1.7` 及以下版本（不推荐）;

> **注意**：在当前版本中,强行排除 `node_modules` 会导致应用无法启动,因为 Electron 需要依赖来运行后端服务;因此请保持默认行为;

### 优化建议

- 使用 `excludeDependencies` 移除不必要的包（如开发依赖）;
- 构建前执行 `npm prune --production` 精简依赖;
- 利用 `build.compression: 'maximum'` 压缩安装包（仅对 electron-builder 产物有效,Inno Setup 有自己的压缩设置）;

---

## 📌 进一步定制

如果现有配置仍不能满足您的特殊需求,您可以通过以下方式进一步扩展：

### 1. 直接使用 `electron-builder` 配置字段
`build` 对象中允许添加任何 `electron-builder` 官方支持的配置（如 `compression`、`extraResources`、`publish`、`afterPack` 等）,它们会被正确合并到 `builder.json` 中;

### 2. 使用钩子脚本
通过设置 `build.afterPack` 或 `build.afterBuild` 等字段（指向项目中的脚本文件）,可以在构建过程中执行自定义操作（例如复制额外文件、重新签名、上传到服务器）;

### 3. 修改主进程模板（高级）
目前主进程由内置的 `electron-main.js` 模板生成;如需深度修改主进程逻辑,您可以使用 `patch-package` 对 `@flun/desktop-builder` 打补丁,或者 fork 项目并修改 `build.js` 以支持自定义模板路径（未来版本可能原生支持）;

### 4. 自行调用 `electron-builder`
您也可以在 `package.json` 中编写自己的构建脚本,直接调用 `electron-builder` 并引用 `@flun/desktop-builder` 提供的临时构建目录,但这需要您自行管理复制、依赖安装等步骤;

**推荐路径**：优先尝试前两种（配置字段/钩子）,如果仍不够,可向项目作者提交 Issue 或 PR 提出新增配置需求;

---

## 🛠️ 常见问题

### 1. 构建时提示 `desktopAppConfig.js not found`
- 确认包已正确安装,`postinstall` 会自动复制模板；若未自动复制,可手动从 `node_modules/@flun/desktop-builder/desktopAppConfig.js` 复制到项目根目录;

### 2. 构建失败,提示 `electron-builder` 相关错误
- 确保网络畅通,首次构建需下载 Electron 运行时（约 100MB）;
- 可尝试设置镜像环境变量（构建脚本已自动配置国内镜像,如 `ELECTRON_MIRROR`）;

### 3. 应用版本号如何设置？
- 版本号取自项目根目录下 `package.json` 的 `version` 字段,请直接修改该文件;

### 4. 生成的安装包很大（约 100MB+）
- 正常,Electron 包含完整 Chromium 内核,且现在包含 `node_modules`;可通过 `build.compression: 'maximum'` 压缩,或使用 `excludeDependencies` 精简依赖;Windows 安装程序还可调整 Inno Setup 的压缩设置;

### 5. 如何只生成当前平台的安装包？
- 默认行为即为只生成当前平台；如需生成其他平台,请在对应操作系统上执行构建命令;

### 6. 菜单中的 `__TOGGLE_BROWSER__` 有什么作用？
- 该特殊标记会被替换为“在系统默认浏览器中打开应用地址”的功能,方便用户测试;

### 7. 为什么我设置了 `nodeIntegration: false`,但应用仍然能访问 Node.js？
- 如上方“窗口配置”警告所述,本工具为了自动启动后端服务,**强制启用了 `nodeIntegration` 并关闭了 `contextIsolation` 和 `sandbox`**;这是设计上的必要妥协,但确实降低了安全性；**请勿在应用中加载外部网页或不可信内容**;

### 8. 构建后的应用必须联网才能使用吗？
- **默认（v3.0.0+）**：不需要,依赖已打包,可离线运行;

### 9. 首次启动时出现一个日志窗口,显示 npm 安装信息,是正常的吗？
- 仅当您排除了 `node_modules` 时才会出现（旧行为）;默认情况下（打包依赖）,不会出现该窗口,应用直接启动;

### 10. 我的 `excludeFiles` 中的规则在打包阶段也生效了,如何避免？
- 如果您希望某些规则仅复制阶段生效,请使用 `build.files` 覆盖,但需谨慎;我们建议统一使用 `excludeFiles`,因为新行为更符合直觉（排除的文件不会出现在最终产物中）;

### 11. Windows 安装程序为什么使用 Inno Setup 而不是 NSIS？
- 从 v4.0.0 起,Windows 安装程序改用 Inno Setup,因为它提供更强大的自定义能力和更现代的向导界面,并且安装速度极快;
- 如果您仍需要 NSIS,可以考虑使用旧版本（v4.0.0以下）;

### 12. 旧版 `desktopAppConfig.js` 在 `electron-builder` v27 下报错怎么办？

从本包 **v5.0.0** 起,底层依赖的 **`electron-builder` 升级到 v27**,该版本对配置格式做了破坏性调整;如果你是从旧版本升级,或在旧项目上使用了本包,会看到类似报错：

```
Your configuration uses an option that was removed in electron-builder v27:

`npmRebuild` was replaced by `nativeModules.npmRebuild` in electron-builder v27.
```

需要按以下对照表手动迁移你的 `desktopAppConfig.js`（本包 v5.0.0 自带的模板已按新格式编写,可直接参考）：

| 旧格式（`electron-builder` v26）                               | 新格式（`electron-builder` v27）                    |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `npmRebuild: false`                                            | `nativeModules: { npmRebuild: false }`              |
| `mac.identity` / `mac.hardenedRuntime` / `mac.entitlements` 等 | 统一移入 `mac.sign: { ... }`                        |
| `linux.syncDesktopName`                                        | 已移除,行为变为始终同步 `.desktop` 文件名与窗口类名 |

也可以执行官方迁移命令自动改写配置：

```bash
npx electron-builder migrate-schema
```

> **说明**：此处的 v27 指的是 **`electron-builder`** 的 v27,不是本包或其他依赖包的版本;本包自身版本号为 `@flun/desktop-builder` 的 version 字段;
---

## 📄 许可证

ISC © 2026, flun

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request;
项目地址：[https://github.com/OpenFlun/desktop-builder](https://github.com/OpenFlun/desktop-builder)
