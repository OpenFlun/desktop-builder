# @flun/desktop-builder

> 将任意 Node.js 网站一键打包为当前桌面应用 (Windows, macOS, Linux)（基于 Electron）,支持高度自定义配置;

[![npm version](https://img.shields.io/npm/v/@flun/desktop-builder.svg)](https://www.npmjs.com/package/@flun/desktop-builder)
[![license](https://img.shields.io/npm/l/@flun/desktop-builder.svg)](https://github.com/OpenFlun/desktop-builder/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@flun/desktop-builder.svg)](https://nodejs.org)

---

## 📖 简介

`@flun/desktop-builder` 是一个 **将本地 Node.js Web 应用打包成桌面安装包** 的构建工具;你只需提供一个配置文件,即可生成 Windows（NSIS）、macOS（DMG/ZIP）或 Linux（AppImage/Deb/RPM 等）安装程序;

**核心机制**：
- 该工具会将您的 Node.js 后端服务代码（由 `serverPath` 指定）与 Electron 前端整合,打包为一个独立的桌面应用;
- **Electron 本身内置了 Node.js 运行时**,因此打包后的应用在启动时,会使用**自带的 Node.js** 在后台自动运行您的服务脚本;
- 最终用户**无需在电脑上安装 Node.js 或任何其他运行时环境**,双击桌面图标即可直接使用;

---

## ✨ 特性

- 🚀 **一键打包**：基于 `electron-builder`,快速生成当前平台的安装包;
- ⚙️ **高度可配置**：通过单一 `desktopAppConfig.js` 控制窗口、图标、菜单、安装选项、签名、压缩等;
- 🖥️ **跨平台支持**：Windows、macOS、Linux（仅构建当前运行平台,但支持输出多种格式）;
- 🔌 **自带 Node.js 运行时**：利用 Electron 内置的 Node.js 执行后端服务,用户无需额外安装;
- 📦 **灵活的安装选项**：NSIS 支持一键/向导模式,DMG 支持自定义背景、布局,Linux 支持多种包格式;
- 🎨 **品牌自定义**：应用图标、安装/卸载图标、DMG 卷宗图标、背景图片等（通过 `build` 中各平台字段配置）;
- 🧩 **菜单自定义**：完全自定义应用菜单（语言、角色、点击回调,甚至内联函数）;
- 📁 **精细排除**：可排除不需要的文件、依赖包和最终输出文件（`excludeFiles` 现在同时在复制和打包阶段生效）;
- 🔧 **可扩展**：允许直接添加 `electron-builder` 任意配置字段,并支持后处理钩子;
- 📦 **依赖预打包**：构建时自动安装生产依赖并打包进应用,用户**首次启动无需联网**,开箱即用;
- 🎨 **主题切换支持**：通过菜单配置轻松切换浅色/深色/跟随系统主题,提升用户体验;

---

## 配置

### 允许安装脚本执行

本包在安装时可能触发某些依赖包的自动脚本（如 `postinstall` 等）；如果你的 npm 全局配置或项目配置禁止了脚本执行（例如设置了 `ignore-scripts=true`）,可能会导致安装不完整或运行时异常；

推荐在项目根目录的 `package.json` 中添加 `allowScripts` 字段,显式放行本包及其依赖的脚本：

```json
{
  "allowScripts": {
    "@flun/desktop-builder": true
    // 如果依赖的其它包（如 bcrypt、electron-winstaller 等）也有脚本,请按需添加,格式相同
  }
}
```

> 如果你信任所有安装包,也可以直接在项目 `.npmrc` 中设置 `allow-scripts = false`（表示关闭脚本拦截,所有脚本均允许执行）,或删除 `allow-script` 字段；

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

在项目根目录创建或编辑 `desktopAppConfig.js`,填写必填字段(自行替换)：

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
| **`appName`**         | `string`   | **必填** | 应用显示名称（标题栏、快捷方式、安装程序等）                                    |
| `enableLogging`       | `boolean`  | `false`  | 是否启用日志文件（调试用）,日志会写入桌面 `myapp_debug.log`                     |
| `window`              | `object`   | 见下方   | 主窗口外观与行为配置（部分字段会被强制覆盖,请注意说明）                         |
| `menu`                | `array`    | 见示例   | 应用菜单模板（支持角色、分隔符、点击回调）                                      |
| `build`               | `object`   | 见下方   | 打包输出配置（可随意添加 `electron-builder` 支持的其他字段）                    |
| `advanced`            | `object`   | 见下方   | 高级运行行为                                                                    |
| `excludeFiles`        | `string[]` | `[]`     | 复制到临时目录时排除的文件/目录（支持 glob）,**同时会追加到打包阶段的排除规则** |
| `excludeDependencies` | `string[]` | `[]`     | 从最终依赖列表中移除的 npm 包名（不会打包）                                     |
| `excludeOutputs`      | `string[]` | `[]`     | 从最终输出目录中排除的安装包文件（如 `*.blockmap`、`latest.yml`）               |

> **注意**：图标配置不再使用独立的 `branding` 字段,而是直接在 `build.win.icon`、`build.mac.icon`、`build.linux.icon` 中分别指定,具体见下方 `build` 配置说明;

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
  backgroundColor: '#ffffff',     // 加载时的背景色
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

支持 Electron 标准菜单模板,可自由修改语言和结构；示例：

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
- `!node_modules/**/*.md`、`!node_modules/**/*.markdown`、`!node_modules/**/license`、`!node_modules/**/licence`、
  `!node_modules/**/LICENSE*`、`!node_modules/**/LICENCE*`、`!node_modules/**/node/**`
- 精准平台绑定目录：`node-win*/**`、`node-darwin*/**`、`node-linux*/**`、`node-freebsd*/**`、`node-sunos*/**`、`node-aix*/**`

如果您需要额外排除文件,请使用 `excludeFiles`（它会自动转换为 `files` 排除规则）;

```javascript
build: {
  appId: 'com.example.app',           // 应用唯一标识（反向域名格式）
  outputDir: './dist',                // 安装包输出目录

  // ----- Windows 配置 -----
  win: {
    target: ['nsis'],                 // 可指定 nsis/portable/zip 等
    icon: './build/icon.png',         // 应用图标（建议 512×512 PNG）
    // 其他可选：publisherName, signingHashAlgorithms 等
  },
  nsis: {
    oneClick: false,                           // true=一键安装,false=向导安装
    perMachine: false,                         // true=安装到所有用户（需管理员）,false=当前用户
    allowToChangeInstallationDirectory: true,  // 是否允许用户更改安装目录
    createDesktopShortcut: true,               // 创建桌面快捷方式
    createStartMenuShortcut: true,             // 创建开始菜单快捷方式
    shortcutName: '我的桌面应用',               // 快捷方式名称（默认为 appName）
    deleteAppDataOnUninstall: false,           // 卸载时是否删除用户数据
    installerHeader: './build/installerHeader.bmp',      // 安装头横幅 150×57
    installerSidebar: './build/installerSidebar.bmp',    // 安装侧边栏 164×314
    uninstallerSidebar: './build/uninstallerSidebar.bmp',// 卸载侧边栏 164×314
    installerIcon: './build/installerIcon.ico',          // 安装程序图标（必须 .ico）
    uninstallerIcon: './build/uninstallerIcon.ico'       // 卸载程序图标（必须 .ico）
  },

  // ----- macOS 配置 -----
  mac: {
    target: ['dmg', 'zip'],          // 同时生成 dmg 和 zip（zip 可用于自动更新）
    icon: './build/icon.png',        // 应用图标（建议 512×512 PNG）
    // 可选高级字段（代码签名、entitlements 等）
    // identity: 'Developer ID Application: Your Name (TEAM123)',
    // hardenedRuntime: true,
    // entitlements: './build/entitlements.mac.plist',
    // entitlementsInherit: './build/entitlements.mac.inherit.plist',
    // provisioningProfile: './build/profile.provisionprofile', // 仅 MAS 需要
  },
  dmg: {
    iconSize: 80,
    window: { width: 540, height: 380 },
    // 增强选项（可选）
    // background: './build/background.png',       // 背景图片
    // backgroundColor: '#5127ce',               // 无背景图时的背景色
    // icon: 'icon: build/dmg-icon.icns',          // 卷宗图标
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
    icon: './build/icon.png',        // 应用图标（建议 512×512 PNG）
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
    // syncDesktopName: true,        // 同步 .desktop 文件名与窗口类名,防止任务栏图标错乱
  },
  // 特定格式的额外配置（可选）
  // appImage: { systemIntegration: 'doNotAsk' },
  // deb: { depends: ['libgtk-3-0'] },
}
```

> **平台说明**：构建时只生成**当前运行操作系统**对应的安装包（例如 Windows 下生成 `.exe`,`.msi`...）;
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
**新增行为（v3.0.0）**：这些模式会自动转换为 `electron-builder` 的排除规则（添加 `!` 前缀）,因此也会在**打包阶段生效**;

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

- 以 `/` 结尾表示目录及其内容;
- 以 `./` 开头表示仅匹配根目录下的文件（非递归）;
- 否则匹配任意路径的该模式（`minimatch` 全局匹配）;

> **注意**：由于依赖现已在构建时预安装并打包,所有不再排除 `node_modules`**;

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
      target: ['nsis'],
      icon: './build/icon.png',
    },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: '我的应用',
      deleteAppDataOnUninstall: false,
      installerIcon: './build/installerIcon.ico',
      uninstallerIcon: './build/uninstallerIcon.ico',
    },

    mac: {
      target: ['dmg', 'zip'],
      icon: './build/icon.png',
      // 如需签名,请取消注释并填写
      // identity: 'Developer ID Application: My Company (TEAM123)',
      // hardenedRuntime: true,
    },
    dmg: {
      iconSize: 80,
      window: { width: 540, height: 380 },
      background: './build/background.png',
      backgroundColor: '#ffffff',
      icon: 'build/dmg-icon.icns',
      title: '${productName} ${version}',
      contents: [
        { x: 130, y: 220, type: 'file' },
        { x: 410, y: 220, type: 'link', path: '/Applications' }
      ]
    },

    linux: {
      target: ['AppImage', 'deb'],
      category: 'Development',
      icon: './build/icon.png',
      description: '一个功能强大的应用',
      maintainer: '我的名字 <my@email.com>',
      vendor: '我的公司',
      desktop: {
        entry: {
          Name: '我的应用',
          Comment: '一个很棒的应用',
          Categories: 'Development;Utility;',
          Keywords: 'app;tool;',
          Terminal: false,
          Type: 'Application'
        }
      },
      syncDesktopName: true,
    },
    // 额外 electron-builder 字段（示例）
    compression: 'maximum',
    extraResources: [{ from: './assets', to: './assets' }],
  },

  advanced: {
    autoStartServer: true,
    autoKillServer: true,
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

### 默认行为（v2.2.0+）：构建时打包依赖

- **构建时**会自动执行 `npm install --production`,将 `node_modules` 完整打包进应用;
- **用户首次启动无需联网**,开箱即用,启动速度显著提升;
- **安装包体积会增大,构建和安装时间会增长**（包含依赖）,但这是换取流畅用户体验的代价;

### 如何回退到运行时安装依赖（旧行为）

如果您希望减小安装包体积,减少构建和安装时间,并允许用户首次启动时联网安装依赖,请安装'v2.1.7'及以下

```javascript
excludeFiles: [
  // ... 其他规则
  'node_modules/',   // 排除依赖,用户首次启动时自动安装
]
```

### 优化建议

- 使用 `excludeDependencies` 移除不必要的包（如开发依赖）;
- 构建前执行 `npm prune --production` 精简依赖;
- 利用 `build.compression: 'maximum'` 压缩安装包;

---

## 📌 进一步定制

如果现有配置仍不能满足您的特殊需求,您可以通过以下方式进一步扩展：

### 1. 直接使用 `electron-builder` 配置字段
`build` 对象中允许添加任何 `electron-builder` 官方支持的配置（如 `compression`、`extraResources`、`publish`、`afterPack` 等）,它们会被正确合并到 `builder.json` 中;

### 2. 使用钩子脚本
通过设置 `build.afterPack` 或 `build.afterBuild` 等字段（指向项目中的脚本文件）,可以在构建过程中执行自定义操作（例如复制额外文件、重新签名、上传到服务器）;

### 3. 修改主进程模板（高级）
目前主进程由内置的 `electron-main.js` 模板生成；如需深度修改主进程逻辑,您可以使用 `patch-package` 对 `@flun/desktop-builder` 打补丁,或者 fork 项目并修改 `build.js` 以支持自定义模板路径（未来版本可能原生支持）;

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
- 正常,Electron 包含完整 Chromium 内核,且现在包含 `node_modules`;可通过 `build.compression: 'maximum'` 压缩,或使用 `excludeDependencies` 精简依赖;

### 5. 如何只生成当前平台的安装包？
- 默认行为即为只生成当前平台；如需生成其他平台,请在对应操作系统上执行构建命令;

### 6. 菜单中的 `__TOGGLE_BROWSER__` 有什么作用？
- 该特殊标记会被替换为“在系统默认浏览器中打开应用地址”的功能,方便用户测试;

### 7. 为什么我设置了 `nodeIntegration: false`,但应用仍然能访问 Node.js？
- 如上方“窗口配置”警告所述,本工具为了自动启动后端服务,**强制启用了 `nodeIntegration` 并关闭了 `contextIsolation` 和 `sandbox`**;这是设计上的必要妥协,但确实降低了安全性；**请勿在应用中加载外部网页或不可信内容**;

### 8. 构建后的应用必须联网才能使用吗？
- **默认（v3.0.0+）**：不需要,依赖已打包,可离线运行;
- 若您在 `excludeFiles` 中排除了 `node_modules`,则首次启动仍需联网安装依赖（只针对旧版本,当前版本已不支持此行为且危险,会造成无法启动应用而报错,建议保持默认）;

### 9. 首次启动时出现一个日志窗口,显示 npm 安装信息,是正常的吗？
- 仅当您排除了 `node_modules` 时才会出现（旧行为）;默认情况下（打包依赖）,不会出现该窗口,应用直接启动;

### 10. 我的 `excludeFiles` 中的规则在打包阶段也生效了,如何避免？
- 如果您希望某些规则仅复制阶段生效,请使用 `build.files` 覆盖,但需谨慎;我们建议统一使用 `excludeFiles`,因为新行为更符合直觉（排除的文件不会出现在最终产物中）;

---

## 📄 许可证

ISC © 2026, flun

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request;
项目地址：[https://github.com/OpenFlun/desktop-builder](https://github.com/OpenFlun/desktop-builder)