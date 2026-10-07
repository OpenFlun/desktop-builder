# @flun/desktop-builder

> 将任意 Node.js 项目一键打包为当前平台的桌面应用 (Windows, macOS, Linux)（基于 Electron）,支持高度自定义配置;

[![npm version](https://img.shields.io/npm/v/@flun/desktop-builder.svg)](https://www.npmjs.com/package/@flun/desktop-builder)
[![license](https://img.shields.io/npm/l/@flun/desktop-builder.svg)](https://github.com/OpenFlun/desktop-builder/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@flun/desktop-builder.svg)](https://nodejs.org)

---

## 📖 简介

`@flun/desktop-builder` 是一个 **将本地 Node.js 项目打包成桌面安装包** 的构建工具;您只需提供一个配置文件,即可生成 Windows（基于 Inno Setup 的安装程序）、macOS（DMG/ZIP）或 Linux（AppImage/Deb/RPM 等）安装程序;

**核心机制**：
- 该工具会将您的 **Node.js 项目**（含所有业务代码、资源文件与依赖）与 Electron 前端整合，打包为一个独立的桌面应用;
- **Electron 本身内置了 Node.js 运行时**,因此打包后的应用在启动时,会使用**自带的 Node.js** 在后台自动运行您的 Node.js 项目;
- 最终用户**无需在电脑上安装 Node.js 或任何其他运行时环境**,双击桌面图标即可直接使用;

- 本包采用 ESM 书写（`package.json` 中 `"type": "module"`），包括 `postinstall` 自动复制到你项目根目录的示例 `desktopAppConfig.js`, 如果你的项目为 CJS 请修改导出方式为 `module.exports = { ... }`;

**关于 asar 打包**：本工具**不支持也不建议启用** ASAR 打包（electron-builder 的 `asar` 配置）。原因如下：

- 本工具的运行架构是「Electron 主进程 + 独立 Node.js 子进程」：主进程通过 `child_process.spawn` 启动一个 Node 进程来运行您的 Node.js 项目;
- 外部 Node 进程**不加载 Electron 的 fs 补丁**，无法读取 asar 归档内的文件；同时 asar 虚拟路径也**不能作为子进程的工作目录**（Windows 的 `CreateProcess` 会直接报 ENOENT）；
- 因此启用 asar 后，Node.js 子进程会启动失败（表现为应用启动后立即退出、页面 `ERR_CONNECTION_REFUSED`）；
- 本工具已在 `build.js` 中显式设置 `asar: false`，确保打包后的 `resources/app` 始终是真实目录结构。

**我们的替代方案**：asar 的核心诉求是"把成千上万个小文件打成单文件，减少启动时文件系统 I/O 与杀毒软件扫描量，从而加快启动"。但 asar 用**虚拟归档**实现，牺牲了 Node.js 子进程的读取能力——**它没有真正解决问题，只是把问题从"慢"换成了"打不开"**。本工具给出**不破坏目录结构**的等价方案：

- 构建时自动执行 **node_modules 优化系统**（详见 [✨ 特性](#-特性)），把包内 JS 按入口合并成单文件（`__bundled__.mjs` / `__bundled__.cjs`），同时清理平台二进制、开发文件等非运行文件；
- 打包后的 `resources/app` 仍是**真实目录结构**，Node.js 子进程可正常读取，不触发 asar 的兼容性问题；
- 优化系统的执行结果由 `.deps-snapshot.json` 中的 **`verified`** 字段记录：仅当**依赖未变 + 平台/架构/工具版本匹配 + 上次构建全流程成功**（`verified: true`）时才跳过优化，否则自动重跑。这保证了每次构建产物一致，同时二次构建零开销；
- **一句话对比**：asar 减小了文件数但子进程打不开；本工具在保持真实目录结构的前提下，同样大幅减小文件数、加速启动。

> **⚠️ 老用户注意（曾启用过 asar 的版本）**：如果您的机器上曾用早期版本（启用了 asar）构建过，`node_modules` 可能已被 asar 打包过程残留破坏（部分包的内部文件缺失但目录结构还在）。本工具从 v5.1.4 起会在每次安装前先删除依赖快照、安装成功后再写回，因此**任何中断或异常状态都会在下次构建时自动触发完整重装**，无需手动干预。若您升级后首次构建仍遇到模块缺失，可手动删除临时目录缓存强制重装：
>
> ```powershell
> # 清理构建临时目录（Windows 示例，具体路径取决于系统）
> Remove-Item "$env:TEMP\desktop-builder-build" -Recurse -Force
> ```

---

## ✨ 特性

- 🚀 **一键打包**：基于 `electron-builder` 和 `Inno Setup` 等,快速生成当前平台的安装包;
- ⚙️ **高度可配置**：通过单一 `desktopAppConfig.js` 控制窗口、图标、菜单、安装选项、签名、压缩等;
- 🖥️ **跨平台支持**：Windows、macOS、Linux（仅构建当前运行平台,但支持输出多种格式）;
- 🔌 **自带 Node.js 运行时**：你的 Node.js 项目将由 Electron 内置的 Node.js 接管，不再依赖外部安装;
- 📦 **灵活的安装选项**：Windows 使用 Inno Setup（支持自定义向导样式、语言、快捷方式等）,macOS 支持 DMG/ZIP,Linux 支持 AppImage/Deb 等;
- 🎨 **品牌自定义**：应用图标、安装/卸载图标、DMG 卷宗图标、背景图片、向导图片等;
- 🧩 **菜单自定义**：完全自定义应用菜单（语言、角色、点击回调,甚至内联函数）;
- 📁 **精细排除**：可排除不需要的文件、依赖包和最终输出文件（`excludeFiles` 同时在复制和打包阶段生效）；`excludeDependencies` 用于自定义排除生产依赖包（如平台专用包、已确认无用的包）;
- 🔧 **可扩展**：允许直接添加 `electron-builder` 和 `Inno Setup` 任意扩展字段;
- 📦 **依赖预打包**：构建时自动判断是否安装生产依赖并打包进应用,用户**首次启动无需联网**,开箱即用;
- 🎨 **主题切换支持**：通过菜单配置轻松切换浅色/深色/跟随系统主题;
- 🚀 **node_modules 优化系统（v6.0.0 新增，默认开启）**：构建时自动执行六阶段优化——**合并 JS**（按入口 bundle，多文件合一）、**清空资源**（postinstall 复制到项目根的目录，保留空目录以通过自检）、**清平台二进制**（非当前平台的 prebuilds）、**清开发文件**（`.md` / `.map` / `.d.ts` / `.h` / `.c` 等）、**清中间产物**、**清不参与运行的文件**（对齐 electron-builder `files` 排除规则）；用户无需配置，即可大幅减少打包文件数与体积、加速冷启动；
- 🧩 **优化的逃生舱口**：若遇异常，可在 `desktopAppConfig.js` 中 `optimize: false` 整体关闭，或 `optimize: { exclude: ["包名"] }` 精确排除；

---

## 📁 包结构

包结构如下（也可参考项目根目录被自动复制出的文件）：

```
@flun/desktop-builder/
├── build/                    # 默认资源（图标、安装向导图）
│   ├── icon.png              # 应用图标（512×512 PNG，跨平台默认）
│   ├── setup.ico             # Windows 安装程序图标
│   ├── uninstallerIcon.ico   # Windows 卸载程序图标
│   ├── wizard.bmp            # Inno Setup 左侧大图（164×314 BMP）
│   └── wizardSmall.bmp       # Inno Setup 右上小图（55×58 BMP）
├── build.js                  # 构建主逻辑（复制文件、安装依赖、调用优化系统、electron-builder、Inno Setup 打包）
├── optimize-node-modules.js  # node_modules 优化系统（6 阶段：合并 JS / 清空资源 / 清平台二进制 / 清开发文件 / 清中间产物 / 清不参与运行的文件）
├── copy-files.js             # postinstall 脚本：复制配置模板与 build/ 到项目根目录
├── desktopAppConfig.js       # 配置文件模板（安装时复制到项目根目录）
├── electron-main.js          # Electron 主进程模板（构建时替换占位符生成 main.mjs）
├── index.js                  # CLI 入口（desktop-builder build / help）
├── index.d.ts                # TypeScript 类型声明
├── LICENSE
├── CHANGELOG.md
└── README.md
```

---

## 安装前准备

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

### 下载依赖(Windows)
  - 官网:https://jrsoftware.org/isdl.php
  - 中国 https://gitee.com/OpenFlun/inno-setup/releases

1. 大部分情况下无需手动下载,构建时自动下载安装;
2. 安装版手动安装时一定要选择默认安装路径,不然会因为找不到文件而构建失败;
3. 如果你是在中国下载的便携版压缩文件,请解压到 "C:\Users\你的用户名\.electron-builder-cache" 下(Windows);

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
  serverPath: './server.js',          // Node.js 项目入口路径
  appUrl: 'http://localhost:7296',  // 启动后访问的地址
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

## ⚙️ 配置文件

所有配置集中在项目根目录的 `desktopAppConfig.js` 中，本工具会在构建时读取该文件。配置对象按功能划分为以下几个顶层字段，各字段的作用如下表；每个字段的详细配置见后续对应章节。

> **说明**：本工具的所有配置对象（`window` / `menu` / `build` 及其子对象）**均支持扩展**——除了本章节列出的常用字段，你还可以直接添加 `electron-builder`、`Inno Setup` 等官方支持的其他字段。工具会原样合并到最终的 `builder.json` / `.iss` 脚本中。

### 配置总览

| 顶层字段              | 类型       | 作用                                                         | 详细说明                                        |
| --------------------- | ---------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `serverPath`          | `string`   | **必填**，Node.js 项目入口文件路径（相对于项目根目录）       | [1. 基础字段](#1-基础字段)                      |
| `appUrl`              | `string`   | **必填**，应用启动后访问的地址（如 `http://localhost:7296`） | [1. 基础字段](#1-基础字段)                      |
| `appName`             | `string`   | 应用显示名称（标题栏、快捷方式、安装程序等）                 | [1. 基础字段](#1-基础字段)                      |
| `enableLogging`       | `boolean`  | 是否启用日志文件（调试用）                                   | [1. 基础字段](#1-基础字段)                      |
| `window`              | `object`   | 主窗口外观与行为                                             | [2. 窗口配置](#2-窗口配置-window)               |
| `menu`                | `array`    | 应用菜单模板（语言、角色、点击回调）                         | [3. 菜单配置](#3-菜单配置-menu)                 |
| `build`               | `object`   | 打包配置（应用标识、输出目录、图标、安装选项、签名等）       | [4. 打包配置](#4-打包配置-build)                |
| `advanced`            | `object`   | Node.js 子进程启停行为                                       | [5. 高级选项](#5-高级选项-advanced)             |
| `allowScripts`        | `object`   | 构建阶段放行安装脚本的包名列表                               | [6. 允许安装脚本](#6-允许安装脚本-allowscripts) |
| `excludeFiles`        | `string[]` | 复制项目文件时排除的文件/目录                                | [7. 排除规则](#7-排除规则)                      |
| `excludeDependencies` | `string[]` | 从最终依赖列表中移除的 npm 包                                | [7. 排除规则](#7-排除规则)                      |
| `excludeOutputs`      | `string[]` | 从最终输出目录中排除的文件                                   | [7. 排除规则](#7-排除规则)                      |
| `optimize`            | `boolean`  | 优化开关（默认开启，可传对象排除特定包）                     | [8. optimize](#8-node_modules-优化-optimize)    |

`build` 子字段概览：

| 子字段                                                                       | 作用                        | 详细说明                                               |
| ---------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------ |
| `build.appId` / `outputDir` / `publisher` / `shortcutName` / `nativeModules` | 通用打包配置                | [4.1 通用字段](#41-通用字段)                           |
| `build.win`                                                                  | Windows 平台配置            | [4.2 Windows](#42-windows-buildwin)                    |
| `build.inno`                                                                 | Windows Inno Setup 安装程序 | [4.3 Inno Setup](#43-inno-setup-buildinno)             |
| `build.mac` / `build.dmg`                                                    | macOS 应用与 DMG 卷宗       | [4.4 macOS 与 DMG](#44-macos-与-dmg-buildmac-builddmg) |
| `build.linux`                                                                | Linux 应用与包格式          | [4.5 Linux](#45-linux-buildlinux)                      |

签名相关的操作（证书生成、信任配置、各平台签名细节）统一在 [🔏 代码签名](#-代码签名) 章节说明。

---

### 1. 基础字段

**作用**：定义应用的基本信息和启动入口。

```javascript
export default {
  serverPath: './server.js',           // 项目入口（相对项目根目录）
  appUrl: 'http://localhost:7296',     // 应用访问地址
  appName: '我的应用',                  // 应用显示名称（不填则从 package.json 的 name 读取）
  enableLogging: false,                // 是否启用日志（写入桌面 myapp_debug.log）
};
```

- **`serverPath`**（必填）：Node.js 项目的入口文件路径；
- **`appUrl`**（必填）：Electron 主窗口加载的地址，也就是你 Node.js 项目的访问地址。若使用 HTTPS，需填写 `https://...`。
- **`appName`**：应用显示名称，用于窗口标题、快捷方式、安装程序等。不填时默认从 `package.json` 的 `name` 读取；若 `name` 也没有，则回退为 `deskApp`。
- **`enableLogging`**：调试开关。设为 `true` 时，主进程和子服务的运行日志会写入桌面的 `myapp_debug.log`，便于排查启动问题。默认 `false`。

---

### 2. 窗口配置 (`window`)

**作用**：控制 Electron 主窗口的外观、尺寸、行为以及内部渲染进程的 `webPreferences`。

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

- **基础尺寸**（`width` / `height` / `minWidth` / `minHeight` / `maxWidth` / `maxHeight`）：窗口的初始尺寸与缩放范围。`maxWidth` / `maxHeight` 留空表示不限制。
- **行为控制**（`resizable` / `fullscreenable` / `alwaysOnTop` / `frame`）：是否可缩放、是否允许全屏、是否置顶、是否显示系统标题栏。
- **`titleBarStyle`**：仅 macOS 生效。`'default'` 显示标准标题栏；`'hidden'` / `'hiddenInset'` 隐藏标题栏（常用于自定义无边框 UI）。
- **`backgroundColor`**：窗口内容加载完成前显示的背景色，与 `show: false` 配合使用可避免白屏。
- **`show`**：是否立即显示窗口。设为 `false` 时，Electron 会等页面渲染完成后再显示（推荐，防白屏）。

#### webPreferences（重点）

`webPreferences` 中，**以下三项会被本工具在创建窗口时强制覆盖**，无论你在配置里怎么写：

| 配置项             | 你的配置 | 实际运行值  | 原因                                             |
| ------------------ | -------- | ----------- | ------------------------------------------------ |
| `nodeIntegration`  | 任意     | **`true`**  | 渲染进程需使用 Node.js API 以管理 Node.js 子进程 |
| `contextIsolation` | 任意     | **`false`** | 渲染进程需直接访问 Electron 模块                 |
| `sandbox`          | 任意     | **`false`** | 保证 Node.js 子进程能够正常启动                  |

> ⚠️ **安全提示**：以上三项强制覆盖意味着**渲染进程拥有完整的 Node.js 能力**，请确保你的应用**只加载受信任的本地内容**，不要加载任何外部网页，否则存在严重安全风险。

**除上述三项外，其余 `webPreferences` 选项均正常生效**，可自由配置，例如 `plugins`、`webSecurity`、`allowRunningInsecureContent`、`enableWebAuthn` 等。

> **扩展说明**：`window` 对象支持直接添加 `electron-builder` / Electron 官方支持的其他窗口字段（如 `modal`、`parent`、`opacity` 等），工具会原样传递给 Electron。

---

### 3. 菜单配置 (`menu`)

**作用**：定义应用顶部菜单栏的结构、语言与交互。采用 Electron 标准菜单模板，支持角色（`role`）、分隔符（`type: 'separator'`）和自定义点击回调（`click`）。

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
  {
    label: '编辑',
    submenu: [
      { role: 'undo', label: '撤销' },
      { role: 'redo', label: '重做' },
      { type: 'separator' },
      { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
      { role: 'selectAll', label: '全选' }
    ]
  },
  // ... 更多菜单
]
```

- **`role`**：使用 Electron 标准角色（如 `undo`、`redo`、`cut`、`copy`、`paste`、`reload`、`toggleDevTools` 等），行为与快捷键自动绑定；
- **`label`**：菜单项的显示文本，可自由改为任意语言；
- **`type: 'separator'`**：分隔线；
- **`click`**：自定义回调，可写函数字符串（如 `` `() => { ... }` ``），工具会 `eval` 执行；
- **特殊标记 `'__TOGGLE_BROWSER__'`**：出现在 `click` 位置时，会被替换为"在系统默认浏览器中打开 `appUrl`"的功能。

菜单内容完全自由，你可以增删菜单、改变语言、调整结构——它只是一个数组，交给 Electron 的 `Menu.buildFromTemplate` 使用。

---

### 4. 打包配置 (`build`)

**作用**：定义应用的打包输出、应用标识、图标、安装程序、签名等所有与最终产物相关的配置。`build` 对象会与 `electron-builder` 的原生配置合并，**你可以直接添加任何 `electron-builder` 官方支持的字段**（如 `extraResources`、`publish`、`afterPack` 等）。

**构建时自动优化 `node_modules`（v6.0.0 起）**：本工具在 `npm install` 完成后、`electron-builder` 打包前，自动执行 **6 阶段优化**。相比早期版本依赖 `files` 数组声明式排除（**文件仍在磁盘，只是不打进 app**），优化系统在**物理层面**清理，构建产物更小、启动更快。

**6 阶段优化流程**：

1. **合并 JS**：按包入口 bundle，多个 JS 文件合并为单文件（`__bundled__.mjs` / `__bundled__.cjs`）；CJS 保持 CJS、ESM 保持 ESM；被 `package.json` `scripts` 引用的文件（如 `copy-files.js`）保留不合并；
2. **清空复制到项目根的资源**：扫描各包 `postinstall` 引用的目录/文件（如 `templates/` / `static/` / `customize/`），**保留目录结构、清空内容**（让包内 `existsSync` 自检通过）；被 import/require 的文件保留不删；
3. **清平台二进制**：删除非当前平台的 `prebuilds/` / `prebuilt/` 子目录，以及 `@scope/平台纯二进制包`；
4. **清开发文件**：删除 `.md` / `.map` / `.d.ts` / `.ts` / `.cts` / `.mts` / `.h` / `.c` / `.gyp` / `tsconfig.json` / `.nycrc` / `.editorconfig` / `package-lock.json` 等非运行文件；
5. **清中间产物**：删除 `package.json.orig` 等合并过程中的临时文件；
6. **清不参与运行的文件**：等价于早期版本的 `files` 排除规则，物理删除以下文件：
   - `builder.json`
   - `**/*.map`、`**/*.ts`、`**/*.cts`、`**/*.mts`
   - `node_modules/**/*.md`、`node_modules/**/*.markdown`
   - `node_modules/**/license*`、`node_modules/**/licence*`、`node_modules/**/LICENSE*`、`node_modules/**/LICENCE*`
   - `node_modules/node/**`
   - `node_modules/node-win*/**`、`node_modules/node-darwin*/**`、`node_modules/node-linux*/**`、`node_modules/node-freebsd*/**`、`node_modules/node-sunos*/**`、`node_modules/node-aix*/**`

**优化的开关与逃生舱口**：

- `optimize: false`：整体关闭优化；
- `optimize: { exclude: ['包名'] }`：精确排除特定包；
- 若需额外排除项目文件，仍使用 `excludeFiles`（作用于复制阶段，与优化系统独立）。

> **`electron-builder` 的 `files` 数组仍作为兜底保留**（防止 `optimize: false` 时残留文件打进 app），但**默认情况下实际打包的文件已经过优化系统清理**，`files` 数组主要起保险作用。

> **关于 asar**：本工具**默认禁用** asar 打包。原因详见 [简介中的说明](#-简介)。因此 `resources/app` 始终是真实目录结构，Node.js 子进程能正常读取文件。

#### 4.1 通用字段

**作用**：与平台无关的打包基础配置。

```javascript
build: {
  appId: 'com.example.app',           // 应用唯一标识（反向域名格式）
  outputDir: './dist',                // 安装包输出目录
  publisher: null,                    // 发布者名称（默认从 package.json 读取 author）
  shortcutName: null,                 // 快捷方式名称（默认使用 appName）
  nativeModules: {
    npmRebuild: false,                // 不重编译原生模块,减少构建时间
  },
  // ... 其他 electron-builder 字段可自由添加
}
```

- **`appId`**：应用唯一标识，采用反向域名格式（如 `com.mycompany.myapp`），用于注册表、应用识别、升级判断。
- **`outputDir`**：最终安装包的输出目录，默认为 `./dist`。
- **`publisher`**：发布者名称，用于安装程序信息；不填则从 `package.json` 的 `author` 读取。
- **`shortcutName`**：快捷方式显示名称；不填则使用 `appName`。
- **`nativeModules.npmRebuild`**：是否重编译原生模块。设为 `false` 可跳过重编译，减少构建时间（默认 `false`）。
- **`toolsets`**：electron-builder 的官方字段，会被原样写入 `builder.json`。但本工具**只构建当前运行平台**，`toolsets` 不会改变构建结果——它只在与 electron-builder 的跨平台构建能力配合时才有意义。本工具不提供跨平台构建入口，因此**不建议配置此字段**；若你仍写入，构建不会被阻断，但也不会有任何效果。

#### 4.2 Windows (`build.win`)

**作用**：Windows 平台的应用配置。

```javascript
build: {
  win: {
    icon: './build/icon.png',         // 应用图标（建议 512×512 PNG）
    // sign: { ... }                  // 应用本体签名 → 详见「🔏 代码签名」章节
    // ... 其他 electron-builder 的 win 字段可自由添加
  },
}
```

- **`icon`**：应用图标，建议 512×512 PNG，用于快捷方式和可执行文件图标。
- **`sign`**：应用本体签名配置，作用于打包后的应用可执行文件（如 `deskApp.exe`）及所有附带 `.exe` 程序。**详细配置与操作请见 [🔏 代码签名 → 一、Windows 应用本体签名](#一windows-应用本体签名-buildwinsign)**。

> **扩展说明**：`build.win` 支持直接添加任何 `electron-builder` 官方支持的 Windows 字段（如 `publisherName`、`requestedExecutionLevel`、`target` 等）。

#### 4.3 Inno Setup (`build.inno`)

**作用**：配置 Windows 安装程序（基于 Inno Setup）。涵盖安装界面、图标图片、权限、压缩、快捷方式、安装后运行等。**用户只需配置常用字段，工具会自动生成符合 Inno Setup 7.x 规范的 `.iss` 脚本**。

**通用字段**（常用）：

```javascript
build: {
  inno: {
    // ---- 基础信息 ----
    appName: undefined,               // 应用显示名称（默认使用 appName）
    appVersion: undefined,            // 版本号（默认从 package.json 读取 version）
    appPublisher: undefined,          // 发布者（默认使用 build.publisher 或 package.json author）
    appId: undefined,                 // 应用唯一标识（默认使用 build.appId）
    defaultDirName: null,             // 默认安装目录（如 '{autopf}\\MyApp'）
    defaultGroupName: undefined,      // 开始菜单文件夹名（默认 appName）
    outputDir: undefined,             // 输出目录（默认使用 build.outputDir）
    outputBaseFilename: undefined,    // 安装包文件名（默认 `${appName}Setup`）

    // ---- 界面控制 ----
    disableWelcomePage: false,        // 跳过欢迎页
    disableDirPage: false,            // 禁止更改安装路径
    disableProgramGroupPage: false,   // 禁止选择开始菜单文件夹
    disableFinishedPage: false,       // 隐藏"安装完成"页面
    disableReadyPage: false,          // 隐藏"准备安装"确认页
    disableReadyMemo: false,          // 准备页不显示设置摘要
    disableStartupPrompt: false,      // 禁止启动时显示"是否安装..."提示
    showLanguageDialog: true,         // 显示语言选择对话框
    flatComponentsList: false,        // 组件列表使用扁平样式
    showComponentSizes: false,        // 显示每个组件大小
    showTasksTreeLines: false,        // 任务页显示树形连线

    // ---- 图标与图片 ----
    setupIconFile: './build/setup.ico',                       // 安装程序图标（.ico）
    uninstallDisplayIcon: './build/uninstallerIcon.ico',      // 卸载程序图标（.ico）
    WizardImageFile: './build/wizard.bmp',                    // 左侧大图（164×314 BMP）
    WizardSmallImageFile: './build/wizardSmall.bmp',          // 右上小图（55×58 BMP）
    WizardImageFileDynamicDark: './build/wizard.bmp',         // 深色模式左侧大图
    WizardSmallImageFileDynamicDark: './build/wizardSmall.bmp',// 深色模式右上小图

    // ---- 向导样式与颜色 ----
    WizardStyle: 'dynamic',           // modern / classic / dynamic / dark / light...
    WizardImageBackColor: '#CE2751',  // 标准模式左侧大图背景色
    WizardSmallImageBackColor: '#CE2751', // 标准模式右上小图背景色
    WizardBackColor: '#CE2751',       // 标准模式背景色
    WizardImageBackColorDynamicDark: '#228866',      // 深色模式左侧大图背景色
    WizardSmallImageBackColorDynamicDark: '#228866', // 深色模式右上小图背景色
    WizardBackColorDynamicDark: '#228866',           // 深色模式背景色
    WizardImageStretch: true,         // 向导图片是否填充整个区域

    // ---- 权限 ----
    privilegesRequired: 'lowest',     // admin / lowest / poweruser
    privilegesRequiredOverridesAllowed: 'dialog', // 允许通过对话框提升权限

    // ---- 压缩 ----
    compression: 'lzma2',             // lzma2 / zip / none
    solidCompression: true,           // 固实压缩
    LZMADictionarySize: 4096,         // LZMA 字典大小（KB）
    LZMANumFastBytes: 64,             // LZMA 快速字节数

    // ---- 快捷方式 ----
    createDesktopShortcut: true,      // 创建桌面快捷方式
    createStartMenuShortcut: true,    // 创建开始菜单快捷方式
    shortcutName: undefined,          // 快捷方式名称（默认使用 build.shortcutName）

    // ---- 安装后运行 ----
    runAfterInstall: true,            // 安装完成后是否运行应用
    runDescription: '运行应用',        // 运行复选框的描述文字

    // ---- 高级选项 ----
    languageDetectionMethod: 'uilanguage', // uilanguage / locale / none
    allowCancelDuringInstall: true,   // 允许安装过程中取消
    usePreviousAppDir: true,          // 升级时记住上次安装目录
    usePreviousGroup: true,           // 升级时记住开始菜单文件夹
    usePreviousSetupType: true,       // 升级时记住安装类型
    usePreviousTasks: true,           // 升级时记住任务选择
    usePreviousLanguage: true,        // 升级时记住语言选择
    uninstallable: true,              // 是否可卸载
    createUninstallRegKey: true,      // 创建卸载注册表项
    uninstallDisplayName: '卸载(应用名)', // "添加/删除程序"中显示的名称
    uninstallLogMode: 'append',       // 卸载日志模式：new / append / overwrite

    // ---- 版本信息 ----
    versionInfoVersion: undefined,    // 文件版本（默认使用 inno.appVersion）
    versionInfoDescription: undefined,// 文件描述
    versionInfoCopyright: undefined,  // 版权信息
    versionInfoCompany: undefined,    // 公司名称（默认从 package.json 读取 author）

    // ---- 系统要求 ----
    minVersion: '10.0.17763',         // 最低 Windows 版本（默认 Win10 1809+）
    onlyBelowVersion: '',             // 限制最高可运行版本
    useSetupLdr: true,                // 使用 SetupLdr 引导程序（处理 UAC 和系统版本检查）

    // ---- 签名 ----
    // signedUninstaller: false,      // 是否为卸载程序签名
    // signingTool: undefined,        // 签名工具 → 详见「🔏 代码签名」
    // signToolParams: undefined,     // 签名参数（对象格式） → 详见「🔏 代码签名」

    // ... 其他 Inno Setup [Setup] 节指令可直接添加
  },
}
```

- **基础信息**：`appName` / `appVersion` / `appPublisher` / `appId` 均会自动从其他配置继承，通常无需手动填写；
- **界面控制**：通过 `disable*` 系列字段控制向导页的显示与否，你可以按需精简安装流程；
- **图标与图片**：所有图片资源均为可选，不配置则使用默认或省略。所有硬编码路径（如 `./build/xxx`）都会在项目根目录下解析；
- **向导样式**：`WizardStyle: 'dynamic'` 支持自动切换深浅色，与系统主题同步；
- **权限**：`privilegesRequired: 'lowest'` 表示最低权限（无需管理员），`'admin'` 表示需要管理员；
- **压缩**：`lzma2` 压缩率最高，`zip` 兼容性最好，`none` 不压缩；
- **签名**：`signingTool` 与 `signToolParams` 必须**同时配置**才会启用签名，且需符合对象格式；详细配置见 [🔏 代码签名](#二windows-安装程序与卸载程序签名-buildinno)。

> **扩展说明**：`build.inno` 支持直接添加任何 Inno Setup 官方支持的 `[Setup]` 节指令（按 Inno Setup 规范书写即可）。完整指令列表参考 [Inno Setup 官方文档](https://jrsoftware.org/ishelp/index.php?topic=setup)。

#### 4.4 macOS 与 DMG (`build.mac` / `build.dmg`)

**作用**：`build.mac` 配置 macOS 应用的打包目标与签名；`build.dmg` 配置 DMG 卷宗的外观与布局。**仅在 macOS 上构建时生效**。

```javascript
build: {
  mac: {
    target: ['zip', 'dmg'],          // 构建目标：dmg / zip / pkg / mas 等
    // icon: './build/icon.icns',    // 应用图标（.icns，需自备）
    // sign: { ... }                 // 签名配置（公证开关在 mac.notarize）→ 详见「🔏 代码签名」章节
    // ... 其他 electron-builder 的 mac 字段可自由添加
  },
  dmg: {
    iconSize: 80,                            // 图标大小
    window: { width: 540, height: 380 },     // DMG 窗口尺寸
    // background: './build/background.png', // 背景图片（建议 PNG，540×380）
    // backgroundColor: '#5127ce',           // 无背景图时的背景色
    // icon: './build/icon.icns',            // DMG 卷宗图标
    // title: '${productName} ${version}',   // 挂载后显示的卷宗名称
    // format: 'UDZO',                       // 压缩格式（UDZO/ULFO/UDBZ 等）
    // contents: [                           // 自定义图标布局
    //   { x: 130, y: 220, type: 'file' },
    //   { x: 410, y: 220, type: 'link', path: '/Applications' }
    // ]
  },
}
```

- **`mac.target`**：构建目标格式。`dmg` 为磁盘映像，`zip` 常用于自动更新，`pkg` 为安装包，`mas` 为 Mac App Store 专用。
- **`mac.icon`**：`.icns` 格式图标，需自备（工具包内仅提供跨平台 PNG，不含 `.icns`）。
- **`mac.sign`**：macOS 签名配置；公证开关在 `mac.notarize`（boolean）。**详细配置与操作请见 [🔏 代码签名 → 三、macOS 签名与公证 (mac.notarize)](#三macos-签名与公证-macnotarize)**。
- **`dmg.*`**：DMG 卷宗外观，全部为可选增强项，不配置则使用默认样式。

> **扩展说明**：`build.mac` 与 `build.dmg` 支持直接添加 `electron-builder` 官方支持的任何 macOS / DMG 字段。

#### 4.5 Linux (`build.linux`)

**作用**：配置 Linux 平台的应用打包目标与元信息。**仅在 Linux 上构建时生效**。

```javascript
build: {
  linux: {
    target: ['AppImage', 'deb'],     // 构建目标：AppImage / deb / rpm / snap / flatpak 等
    category: 'Development',         // 系统菜单分类
    // description: '完整的应用描述',
    // synopsis: '简短描述',
    // maintainer: '你的名字 <email@example.com>',
    // vendor: '我的公司',
    // executableArgs: ['--enable-features=...'],
    // desktop: { entry: { Name: '我的应用', Comment: '...', ... } }, // 自定义 .desktop 文件
    // sign: { ... }                 // GPG 签名（本工具便利字段，构建时剥离并转环境变量）→ 详见「🔏 代码签名」章节
    // ... 其他 electron-builder 的 linux 字段可自由添加
  },
}
```

- **`linux.target`**：可同时指定多种格式，构建时会生成多个安装包。
- **`category`**：系统菜单中的分类，如 `Utility` / `Network` / `Development`。
- **Linux 图标**：无需显式配置，只需在 `./build` 目录下提供 `icon.png`（建议 512×512 PNG），工具会自动识别。
- **`linux.sign`**：本工具提供的**便利字段**（非 electron-builder 官方字段），用于配置 Linux 包的 GPG 签名，构建时会自动剥离并转换为环境变量。**详细配置与操作请见 [🔏 代码签名 → 四、Linux 包签名](#四linux-包签名)**。

> **扩展说明**：`build.linux` 支持直接添加 `electron-builder` 官方支持的任何 Linux 字段。

---

### 5. 高级选项 (`advanced`)

**作用**：控制应用与 Node.js 子进程的启停关系。

```javascript
advanced: {
  autoStartServer: true,   // 应用启动时自动运行 Node.js 子进程
  autoKillServer: true,    // 应用退出时自动关闭 Node.js 子进程
}
```

- **`autoStartServer`**：设为 `true` 时，Electron 主窗口加载前会自动启动 `serverPath` 指定的 Node.js 子进程，等待其就绪后再显示窗口。默认 `true`。
- **`autoKillServer`**：设为 `true` 时，应用退出时会自动关闭 Node.js 子进程，避免残留。默认 `true`。

---

### 6. 允许安装脚本 (`allowScripts`)

**作用**：构建阶段安装生产依赖时，放行指定包名的 npm 安装脚本（如 `postinstall`）。用于解决 npm 全局配置中 `ignore-scripts=true` 导致某些包安装不完整的问题。

```javascript
allowScripts: {
  'node': true,
  '@flun/webauthn-server': true,
}
```

- 键为 npm 包名，值为 `true` 表示允许执行该包的安装脚本；
- **未配置或配置错误时**，工具会警告并使用默认值 `{ node: true }`；
- 仅在**构建阶段** `npm install --production` 时生效，与 `package.json` 中的 `allowScripts`（npm 安装本项目时使用）场景不同。

> **说明**：如果你在项目 `.npmrc` 中设置了 `ignore-scripts=true`，则应在此配置里显式放行必需的包。

---

### 7. 排除规则

#### 7.1 `excludeFiles`

**作用**：复制项目文件到临时构建目录时，排除指定的文件/目录（支持 glob 模式）。这些模式会**自动转换为 `electron-builder` 的排除规则**（前缀 `!`），因此也会在打包阶段生效。

```javascript
excludeFiles: [
  '.vscode/',
  '.git/',
  'dist/',
  '*.log',
  './yarn.lock',
]
```

**匹配规则**：
- 以 `/` 结尾：匹配该目录及其全部内容（如 `'.git/'`）；
- 以 `./` 开头：仅匹配项目**根目录**下的文件（非递归，如 `'./yarn.lock'`）；
- 其他：按 `minimatch` 全局匹配（如 `'*.log'` 匹配任意路径下所有 `.log` 文件）。

> **注意**：依赖已被工具主动处理（构建时安装），因此**不建议**排除 `node_modules`。

#### 7.2 `excludeDependencies`

**作用**：从最终安装的依赖列表中移除指定的 npm 包（这些包不会被打包到应用中）。

```javascript
excludeDependencies: [
  '@flun/desktop-builder',   // 构建工具自身
  '@flun/windows',            // 用不到的平台专用包
]
```

- 常用于排除构建工具自身的依赖或已确认无用的包；
- 排除后的包不会出现在最终的 `node_modules` 中。

#### 7.3 `excludeOutputs`

**作用**：将构建好的安装包从临时目录复制到最终输出目录时，排除特定文件。

```javascript
excludeOutputs: [
  '*.blockmap',
  'latest.yml',
]
```

- 常用于排除自动更新相关文件（如 `*.blockmap`、`latest.yml`）——若你不需要自动更新，可去掉它们；
- **仅影响复制到输出目录的阶段**，不影响 `electron-builder` 的构建过程。


---

### 8. node_modules 优化 (`optimize`)

**作用**：控制构建时的 `node_modules` 优化系统（v6.0.0 新增，**默认开启**）。六阶段流程详见 [4. 打包配置](#4-打包配置-build)。

```javascript
export default {
  // 默认开启，无需配置

  // ===== 关闭优化（构建或运行异常时使用）=====
  // optimize: false,

  // ===== 精确排除特定包（某个包合并后运行异常时使用）=====
  // optimize: { exclude: ['包名'] },   // 不优化有异常的特定包（如某个包合并后运行异常）
};
```

- **不配置**：优化系统默认开启。构建时自动执行六阶段优化，大幅减少打包文件数和体积、加速冷启动；
- **`optimize: false`**：整体关闭优化。用于排查"是否优化系统引起的异常"——若关闭后问题消失，说明是优化系统的某些清理动作引起的；
- **`optimize: { exclude: ['包名'] }`**：精确排除特定包。用于某个包合并后运行异常时——只跳过该包的优化，其余包继续享受优化。包名写 `package.json` 中的 `name` 字段值（如 `qrcode`、`@flun/html-template`）；
- **调试三步曲**：
  1. 遇到异常，先 `optimize: false` 快速判断是否为优化引起；
  2. 确认后，用 `optimize: { exclude: ['问题包名'] }` 逐个定位并排除；
  3. 若需完全重来，删除临时目录 `%TEMP%\desktop-builder-build`（Windows）后重新构建。

> **提示**：优化系统只处理 `node_modules`，不触碰你的项目源码和资源文件。若需排除项目里的文件/目录，请使用 [`excludeFiles`](#71-excludefiles)。

## 🔏 代码签名

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
   - 若填的是工具路径（相对或绝对均可） → 直接验证存在性；
   - 否则调用 `where signtool.exe` 查 `PATH`；
   - 再依次扫描 `%ProgramFiles(x86)%\Windows Kits\10\bin\<版本>\<arch>\signtool.exe`（`x64` / `x86` / `arm64`，版本从高到低）。
   - 全部失败时给出中文提示并终止，**不会静默使用错误的工具**。
2. **`signToolParams` 对象自动拼接**：`build.js` 会自动拼成 `sign /f "证书" /p "密码" /fd 算法 $f`，并自动完成 Inno Setup 所需的 `$q` 引号转义，用户**无需关心任何转义字符**。
3. **合法性校验**：
   - `certificateFile` 必填，且文件必须存在；
   - `signingTool` 只需填写工具名（如 `signtool.exe`，自动查找）或工具路径（相对或绝对均可），首尾空格会被自动忽略。
4. **`SignTool` 指令生成**：脚本自动将工具名写入 `.iss` 的 `[Setup]` 段，并通过 `/S<name>=...` 命令行参数向 ISCC 传入完整命令，符合 Inno Setup 官方规范。

**配置严格校验（构建前）**：

与 `win.sign` 一样，`inno` 签名配置也在**构建开始前**完成校验，任何问题 **1 秒内**报错退出：

- `signingTool` 与 `signToolParams` **必须同时配置**：只配其一时报 `[错误] build.inno 的 signingTool 与 signToolParams 必须同时配置`，并提示缺哪个；
- `signingTool` 解析失败时报 `[错误] 找不到签名工具: <名称>`；
- `signToolParams.certificateFile` 必填，缺失时报 `[错误] signToolParams.certificateFile 必填`；
- `certificateFile` 指向的文件必须存在，否则报 `[错误] 证书文件不存在: <绝对路径>`。

#### 三、macOS 签名与公证 (mac.notarize)

按照 electron-builder v27 官方规范：签名选项位于 `mac.sign` 下，公证开关位于 `mac.notarize` 下（**boolean 类型**，不是对象）。

```js
build: {
  mac: {
    notarize: false,                         // boolean；false 显式关闭；true 时本工具构建前检查凭据；不配置则透传给 electron-builder
    sign: {
      identity: 'Developer ID Application: Your Name (TEAM123)',  // 签名身份（名称或 SHA-1）
      hardenedRuntime: true,                 // 公证必需（darwin 构建默认 true）
      entitlements: './build/entitlements.mac.plist',
      entitlementsInherit: './build/entitlements.mac.inherit.plist',
      // ... 其他 ElectronSignOptions 字段（timestamp、requirements 等）
    },
  },
}
```

**公证凭据必须通过环境变量传入**（不能写在配置里），以下三种方式任选其一：

| 方式               | 环境变量                                                   |
| ------------------ | ---------------------------------------------------------- |
| Apple ID           | `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID` |
| API Key（CI 推荐） | `APPLE_API_KEY`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER`    |
| Keychain Profile   | `APPLE_KEYCHAIN`、`APPLE_KEYCHAIN_PROFILE`                 |

**证书文件与密码也必须通过环境变量传入**（`mac.sign` 无 `certificateFile` / `certificatePassword` 字段）：

| 环境变量           | 说明                               |
| ------------------ | ---------------------------------- |
| `CSC_LINK`         | 证书文件路径（.p12）或 base64 内容 |
| `CSC_KEY_PASSWORD` | 证书密码                           |

> **兼容说明**：本工具额外接受以下旧写法作为便利字段，构建时会**自动剥离这些非官方字段**，不会触发 electron-builder 的 `additionalProperties: false` 校验：
>
> - `sign.certificateFile` / `sign.certificatePassword` → 转换为 `CSC_LINK` / `CSC_KEY_PASSWORD` 环境变量；
> - `sign.notarize`（旧的对象写法）→ **直接丢弃**。如需启用公证，请设置 `mac.notarize: true`，并通过环境变量提供凭据（见上表）。
>
> 仍推荐按上述 v27 官方规范书写。

**配置严格校验（构建前）**：

与 Windows 一致，以下情形会在**构建开始前**报错退出（复制文件之前），不进入打包流程：

- `notarize` 必须为 boolean（`true` / `false`），写成对象会报错；
- `notarize: true` 时，本工具会在构建前检查公证凭据（环境变量）是否完整；若只配置部分（例如只设了 `APPLE_ID`，缺 `APPLE_APP_SPECIFIC_PASSWORD` 或 `APPLE_TEAM_ID`），会报错并提示缺哪些；

**关于不配置 `notarize`**：本工具只在你显式设置 `notarize: true` 时检查凭据；`false` 时不做任何处理。若**完全不配置**该字段，行为完全交由 electron-builder 决定，请以其官方文档为准。如不需要公证，建议显式设置 `notarize: false`。

#### 四、Linux 包签名

`electron-builder` **本身不签名 Linux 包**，实际签名依赖底层工具：`deb` 通过 `dpkg-sig`、AppImage 通过 `appimagetool --sign`，均基于 GPG 密钥。

v27 的 `linux` 配置下**没有 `sign` 字段**；GPG 签名通过环境变量触发：

```
GPG_PRIVATE_KEY=<ASCII-armored 私钥内容>
GPG_KEY_PASSPHRASE=<密钥密码>
```

设置上述环境变量后，构建 Linux 包时会自动签名。使用前请确保宿主机已安装 `dpkg-sig`、`appimagetool` 及对应的 GPG 密钥。

> **兼容说明**：本工具额外接受 `build.linux.sign.gpgPrivateKey` / `build.linux.sign.gpgKeyPassphrase`（旧写法）作为便利字段，构建时会**自动剥离 `sign` 字段**并转换为上述环境变量，不会触发 electron-builder 的 `additionalProperties: false` 校验。仍推荐直接使用环境变量。

**配置严格校验（构建前）**：

与 Windows 一致，`linux.sign` 的 `gpgPrivateKey` 与 `gpgKeyPassphrase` **必须同时配置**，只配其一会在**构建开始前**报错退出（复制文件之前），并提示缺哪个，避免走到打包后期才失败。

---

#### 五、生成并信任自签名测试证书

**（一）生成证书**

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
- **自签名证书默认不被系统信任**：`signtool verify` 时会提示 `A certificate chain processed, but terminated in a root`。可按下方（二）把证书公钥导入**目标机器**的受信任根；导入后该机器即完全信任，不再报警。

**（二）让目标机器信任证书**
自签名证书要生效，需将其**公钥部分**（不含私钥）导入系统的「受信任根证书颁发机构」。**切勿将带私钥的 `.pfx` 导入受信任根**——那等同于公开签名权。

**第一步：导出公钥（`.cer` 文件，不含私钥）**

```powershell
$pfx = "证书文件路径"
$cer = "公钥输出路径"

$cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($pfx, "证书密码")
$pubBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
[System.IO.File]::WriteAllBytes($cer, $pubBytes)
```

**第二步：把 `.cer` 导入受信任根**——三种方式任选：

**方式一：双击导入（图形界面，最简单）**

- Windows：双击 `.cer` → 「安装证书」→ 选择「本地计算机」（需管理员）或「当前用户」→ 「将所有的证书都放入下列存储」→ 选择「**受信任的根证书颁发机构**」→ 完成。若弹出安全警告，点「是」。
- macOS：双击 `.cer` → 自动打开「钥匙串访问」→ 将证书拖入「系统」或「登录」钥匙串 → 双击该证书 → 展开「信任」→ 将「使用此证书时」设为「**始终信任**」→ 关闭窗口时输入系统密码保存。
- Linux（桌面发行版）：将 `.cer` 复制到 `/usr/local/share/ca-certificates/`（文件后缀改为 `.crt`），然后执行 `sudo update-ca-certificates`。

**方式二：命令行导入（可脚本化）**

- Windows（管理员 PowerShell / CMD）：
  ```
  certutil -addstore Root "证书公钥.cer"
  ```
  （加 `-user` 参数则导入「当前用户」而非「本地计算机」）

- macOS：
  ```
  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "证书公钥.cer"
  ```

- Linux（Debian / Ubuntu）：
  ```
  sudo cp "证书公钥.cer" /usr/local/share/ca-certificates/自定名.crt
  sudo update-ca-certificates
  ```
  （CentOS / RHEL 使用 `sudo cp ... /etc/pki/ca-trust/source/anchors/` 后执行 `sudo update-ca-trust`）

**方式三：企业内网批量分发**

- Windows 域环境：通过组策略（GPO）推送证书到所有域机器的「受信任根证书颁发机构」；
- macOS：通过 MDM（如 Jamf、Munki）或配置描述文件下发；
- Linux：通过 Ansible、Puppet 等自动化工具批量部署。

**适用场景**（以下均可让目标机器信任自签名证书）：

- **个人多台设备**：自己开发者的 PC、笔记本、虚拟机等，每台各导入一次；
- **团队协作**：团队成员把公钥导入各自电脑，团队成员间共享可信任的安装包；
- **公司内网**：IT 部门通过组策略 / MDM / 自动化工具，把公钥分发到内网所有机器；
- **CI/CD 构建机**：构建服务器导入公钥后，产出的安装包在部署环境（若也导入了同一公钥）里不再报警；
- **测试环境**：QA、预发布机器导入后，测试安装流程无需手动跳过警告；
- **虚拟机模板 / 镜像**：把公钥打进系统镜像，新开的虚拟机天然信任。

**不适用场景**（以下必须使用受信任 CA 签发的证书）：

- **公开发布给陌生用户**：下载方未导入你的公钥，仍会提示「未知发布者」，Windows SmartScreen 也会拦截；
- **上架应用商店**：各商店要求使用受信任 CA 或平台专属证书；
- **企业对外分发**：客户/合作伙伴无法接受"手动导入你的公钥"这种前置步骤。

公开分发请购买受信任 CA 签发的代码签名证书（OV 或 EV）。

---

## 🌐 关于网络依赖与构建性能

### 默认行为（v3.0.0+）：构建时打包依赖

- **构建时**会自动执行 `npm install --production`,将 `node_modules` 完整打包进应用;
- **用户首次启动无需联网**,开箱即用;
- **安装包体积会增大,构建和安装时间会增长**（包含依赖）,但这是换取流畅用户体验的代价;
- **构建完成后**（v6.0.0 新增）自动执行 `node_modules` 优化系统（详见 [8. node_modules 优化](#8_node_modules-优化-optimize)），按入口合并 JS、清理平台二进制与开发文件，进一步减小体积、加速冷启动;用户无需任何操作;
### 如何回退到运行时安装依赖（旧行为）

若希望减小安装包体积、缩短构建时间,并允许用户首次启动时联网安装依赖,可安装 `v2.1.7` 及以下版本（不推荐）;

> **注意**：工具默认行为始终为「构建时打包依赖」；强行排除 `node_modules` 会导致应用无法启动，因为 Electron 需要依赖来运行 Node.js 项目；请保持默认行为;

### 优化建议

- **无需任何操作**：`node_modules` 优化系统默认开启，自动完成 JS 合并、平台二进制清理、开发文件清理等，是本工具内置的最强优化手段;
- 使用 `excludeDependencies` 自定义排除不需要打包进应用的依赖包（出于安全或减小体积等考虑）;
- 利用 `build.compression: 'maximum'` 压缩安装包（仅对 electron-builder 产物有效,Inno Setup 有自己的压缩设置）;

---

## 📌 进一步定制

如果现有配置仍不能满足您的特殊需求,您可以通过以下方式进一步扩展：

### 1. 直接使用 `electron-builder` 配置字段
`build` 对象中允许添加任何 `electron-builder` 官方支持的配置（如 `compression`、`extraResources`、`publish`、`afterPack` 等）,它们会被正确合并到 `builder.json` 中;

### 2. 使用钩子脚本
通过设置 `build.afterPack` 或 `build.afterAllArtifactBuild` 等字段（指向项目中的脚本文件），可以在构建过程中执行自定义操作（例如复制额外文件、重新签名、上传到服务器）。

**钩子路径说明**：路径可填**相对路径**（相对项目根目录）或**绝对路径**，两种写法均受支持。构建时，本工具会自动将钩子文件复制到临时构建目录，并将其路径改写为临时目录内的绝对路径——这是因为底层 `electron-builder` 要求钩子模块必须位于其 `--project` 指定的工作区（即本工具的临时目录）内，直接填写项目根目录下的路径会被 `electron-builder` 拒绝（报 `Hook module path ... resolves outside the workspace root`）。用户无需关心这一细节，按正常相对/绝对路径填写即可。

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
- 可尝试设置镜像环境变量（构建脚本已自动配置中国镜像,如 `ELECTRON_MIRROR`）;

### 3. 应用版本号如何设置？
- 版本号取自项目根目录下 `package.json` 的 `version` 字段,请直接修改该文件;

### 4. 生成的安装包很大（约 100MB+）
- 正常,Electron 包含完整 Chromium 内核,且包含 `node_modules`;`node_modules` 部分已经过**优化系统**自动合并与清理，仍可通过 `build.compression: 'maximum'` 压缩，或使用 `excludeDependencies` 精简依赖;Windows 安装程序还可调整 Inno Setup 的压缩设置;

### 5. 如何只生成当前平台的安装包？
- 默认行为即为只生成当前平台；如需生成其他平台,请在对应操作系统上执行构建命令;

### 6. 菜单中的 `__TOGGLE_BROWSER__` 有什么作用？
- 该特殊标记会被替换为“在系统默认浏览器中打开应用地址”的功能,方便用户测试;

### 7. 为什么我设置了 `nodeIntegration: false`,但应用仍然能访问 Node.js？
- 如上方“窗口配置”警告所述,本工具为了自动启动 Node.js 子进程,**强制启用了 `nodeIntegration` 并关闭了 `contextIsolation` 和 `sandbox`**;这是设计上的必要妥协,但确实降低了安全性；**请勿在应用中加载外部网页或不可信内容**;

### 8. 构建后的应用必须联网才能使用吗？
- **默认（v3.0.0+）**：不需要,依赖已打包,可离线运行;（v3.0.0 之前需在应用启动时安装依赖，需联网）

### 9. 首次启动时出现一个日志窗口,显示 npm 安装信息,是正常的吗？
- 仅当您排除了 `node_modules` 时才会出现（旧行为）;默认情况下（打包依赖）,不会出现该窗口,应用直接启动;

### 10. 我的 `excludeFiles` 中的规则在打包阶段也生效了,如何避免？
- 如果您希望某些规则仅复制阶段生效,请使用 `build.files` 覆盖,但需谨慎;我们建议统一使用 `excludeFiles`,因为新行为更符合直觉（排除的文件不会出现在最终产物中）;

### 11. Windows 安装程序为什么使用 Inno Setup 而不是 NSIS？
- 从 v4.0.0 起,Windows 安装程序改用 Inno Setup,因为它提供更强大的自定义能力和更现代的向导界面,并且安装速度极快;
- 如果您仍需要 NSIS,可以考虑使用旧版本（v4.0.0以下）;

### 12. 旧版 `desktopAppConfig.js` 在 `electron-builder` v27 下报错怎么办？

从本包 **v5.0.0** 起,底层依赖的 **`electron-builder`** 为 **v27**,该版本对配置格式做了破坏性调整;若你的 `desktopAppConfig.js` 是按旧版 `electron-builder`（v26）编写的,会看到类似报错：

```
Your configuration uses an option that was removed in electron-builder v27:

`npmRebuild` was replaced by `nativeModules.npmRebuild` in electron-builder v27.
```

需要按以下对照表手动迁移你的 `desktopAppConfig.js`（本包 v5.0.0 自带的模板已按新格式编写,可直接参考）：

| 旧格式（`electron-builder` v26）                       | 新格式（`electron-builder` v27）                    |
| ------------------------------------------------------ | --------------------------------------------------- |
| `npmRebuild: false`                                    | `nativeModules: { npmRebuild: false }`              |
| `mac.identity` / `hardenedRuntime` / `entitlements` 等 | 统一移入 `mac.sign`；`mac.notarize` 仍在 `mac` 下   |
| `linux.syncDesktopName`                                | 已移除,行为变为始终同步 `.desktop` 文件名与窗口类名 |

也可以执行官方迁移命令自动改写配置：

```bash
npx electron-builder migrate-schema
```

> **说明**：此处的 v27 指的是 **`electron-builder`** 的 v27,不是本包或其他依赖包的版本;本包自身版本号为 `@flun/desktop-builder` 的 version 字段;

### 13. 构建或运行异常，怀疑是优化系统引起的，怎么排查？

`node_modules` 优化系统默认开启，绝大多数项目无需干预。若怀疑与优化相关，按以下顺序定位：

1. **整体关闭**：在 `desktopAppConfig.js` 中设置 `optimize: false`，重新构建。若问题消失，说明确实与优化系统有关；
2. **精确排除**：设为 `optimize: { exclude: ['包名'] }`，只跳过该包。包名写 `package.json` 中 `name` 字段值，可写多个；
3. **彻底重来**：删除临时目录 `%TEMP%\desktop-builder-build`（Windows，具体路径取决于系统），重新构建会自动完整重装依赖并重新优化。

详细配置见 [8. node_modules 优化](#8-node_modules-优化-optimize)。

### 14. 构建速度变慢了，是正常的吗？

- **首次构建**：需要下载并运行 `esbuild`（优化系统依赖）、执行六阶段优化与启动验证，会比无优化时多花一些时间；
- **后续构建**：只要依赖未变、平台/架构/工具版本未变、且上次构建成功，优化系统会自动跳过（缓存命中），构建速度恢复；
- 优化系统对最终用户收益显著：应用启动更快、安装包更小。若不在意这些收益、只想加快构建，可设置 `optimize: false` 关闭；

> **说明**：`optimize` 状态记录在临时目录的 `.deps-snapshot.json` 中，依赖或环境变化会自动失效并重跑优化，无需手动清理。

---

## 📄 许可证

ISC © 2026, flun

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request;
项目地址：[https://github.com/OpenFlun/desktop-builder](https://github.com/OpenFlun/desktop-builder)
