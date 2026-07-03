# @flun/desktop-builder

> 将任意 Node.js 网站一键打包为当前桌面应用('win', 'mac', 'linux')（基于 Electron）,支持高度自定义配置;

[![npm version](https://img.shields.io/npm/v/@flun/desktop-builder.svg)](https://www.npmjs.com/package/@flun/desktop-builder)
[![license](https://img.shields.io/npm/l/@flun/desktop-builder.svg)](https://github.com/OpenFlun/desktop-builder/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@flun/desktop-builder.svg)](https://nodejs.org)

---

## 📖 简介

`@flun/desktop-builder` 是一个 **将本地 Node.js Web 应用打包成桌面安装包** 的构建工具;
你只需提供一个配置文件,即可生成 Windows（NSIS）、macOS（DMG/ZIP）或 Linux（AppImage/Deb/RPM 等）安装程序;

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
- 🎨 **品牌自定义**：应用图标、安装/卸载图标、DMG 卷宗图标、背景图片等;
- 🧩 **菜单自定义**：完全自定义应用菜单（语言、角色、点击回调,甚至内联函数）;
- 📁 **精细排除**：可排除不需要的文件、依赖包和最终输出文件;
- 🔧 **可扩展**：允许直接添加 `electron-builder` 任意配置字段,并支持后处理钩子;

---

## 📦 安装

在你的项目目录下安装为开发依赖：

```bash
npm install -D @flun/desktop-builder
```

安装完成后,`postinstall` 脚本会自动将 `desktopAppConfig.js` 配置文件模板复制到你的项目根目录（如果不存在）;

---

## 🚀 快速开始

### 1. 配置 `desktopAppConfig.js`

在项目根目录创建或编辑 `desktopAppConfig.js`,填写必填字段：

```javascript
export default {
  serverPath: './server.js',          // Node.js 启动脚本路径
  appUrl: 'http://www.abc.com:7296',  // 启动后访问的地址
  appName: '我的桌面应用',             // 应用显示名称
};
```

### 2. 构建桌面应用

1. 执行构建命令（根据当前系统生成对应安装包）：

```bash
npx desktop-builder build
```
2. 编程方式构建
```js
import { build } from '@flun/desktop-builder';
await build();
```
首次运行会下载 Electron 运行时（约 100MB）,请耐心等待;
构建完成后,安装包将输出到 `./dist` 目录（可通过 `build.outputDir` 自定义）;

---

## ⚙️ 完整配置项

所有配置均在 `desktopAppConfig.js` 中定义,字段说明如下（`*` 为必填）：

| 字段                  | 类型       | 默认值   | 说明                                                              |
| --------------------- | ---------- | -------- | ----------------------------------------------------------------- |
| **`serverPath`**      | `string`   | **必填** | Node.js 启动脚本路径（相对于项目根目录）                          |
| **`appUrl`**          | `string`   | **必填** | 应用访问地址（如 `http://localhost:7296`）                        |
| **`appName`**         | `string`   | **必填** | 应用显示名称（标题栏、快捷方式、安装程序等）                      |
| `enableLogging`       | `boolean`  | `false`  | 是否启用日志文件（调试用）,日志会写入桌面 `myapp_debug.log`       |
| `window`              | `object`   | 见下方   | 主窗口外观与行为配置（部分字段会被强制覆盖,请注意说明）           |
| `branding`            | `object`   | 见下方   | 图标品牌配置                                                      |
| `menu`                | `array`    | 见示例   | 应用菜单模板（支持角色、分隔符、点击回调）                        |
| `build`               | `object`   | 见下方   | 打包输出配置（可随意添加 `electron-builder` 支持的其他字段）      |
| `advanced`            | `object`   | 见下方   | 高级运行行为                                                      |
| `excludeFiles`        | `string[]` | `[]`     | 复制到临时目录时排除的文件/目录（支持 glob）                      |
| `excludeDependencies` | `string[]` | `[]`     | 从最终依赖列表中移除的 npm 包名（不会打包）                       |
| `excludeOutputs`      | `string[]` | `[]`     | 从最终输出目录中排除的安装包文件（如 `*.blockmap`、`latest.yml`） |

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
> - 您在配置中设置的这三项 **不会生效**,实际运行时将以强制值为准;
> - **渲染进程拥有完整的 Node.js 能力**,因此**请确保您的应用仅加载受信任的本地内容**,不要加载任何外部网页,否则存在严重安全风险;
> - 此设计是为了保证后端服务自动启动等核心功能正常工作,**不建议用户尝试重新关闭这些选项**,否则可能导致应用无法运行;
> - 除上述三项外,其他 `webPreferences` 选项（如 `plugins`、`webSecurity`、`enableWebAuthn` 等）**均正常生效**,您可以按需配置;

---

### 品牌图标 (`branding`)

```javascript
branding: {
  appIcon: null,          // 应用图标路径（建议 512×512 PNG）,默认使用包内置图标
  installerIcon: null,    // Windows 安装程序图标（必须 .ico）,默认使用包内置图标
  uninstallerIcon: null,  // Windows 卸载程序图标（必须 .ico）,默认使用包内置图标
}
```

- 路径相对于项目根目录;
- 若未提供或文件不存在,将使用 `@flun/desktop-builder` 内置的默认图标;

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

- 支持 `role`（标准角色）、`label`、`type`、`click` 等;
- 特殊字符串 `'__TOGGLE_BROWSER__'` 会被替换为“在浏览器中打开”功能（调用系统默认浏览器打开 `appUrl`）;
- `click` 也可直接写函数字符串（需可被 `eval` 执行,例如 `"() => { ... }"`）;

---

### 打包配置 (`build`)

`build` 对象除了下面列出的常用子字段,**还支持直接写入任何 `electron-builder` 官方支持的配置项**（如 `compression`、`extraResources`、`publish` 等）,它们会被合并到最终 `builder.json` 中;

```javascript
build: {
  appId: 'com.example.app',           // 应用唯一标识（反向域名格式）
  outputDir: './dist',                // 安装包输出目录

  // ----- Windows 配置 -----
  win: {
    target: ['nsis'],                 // 可指定 nsis/portable/zip 等
    // 其他可选：icon, publisherName, signingHashAlgorithms 等
  },
  nsis: {
    oneClick: false,                        // true=一键安装,false=向导安装
    perMachine: true,                       // true=安装到所有用户（需管理员）,false=当前用户
    allowToChangeInstallationDirectory: true, // 是否允许用户更改安装目录
    createDesktopShortcut: true,            // 创建桌面快捷方式
    createStartMenuShortcut: true,          // 创建开始菜单快捷方式
    shortcutName: '我的桌面应用',            // 快捷方式名称（默认为 appName）
    deleteAppDataOnUninstall: false,        // 卸载时是否删除用户数据
  },

  // ----- macOS 配置（增强） -----
  mac: {
    target: ['dmg', 'zip'],          // 同时生成 dmg 和 zip（zip 可用于自动更新）
    // 可选高级字段（代码签名、entitlements 等）
    // identity: 'Developer ID Application: Your Name (TEAM123)',
    // hardenedRuntime: true,
    // entitlements: './build/entitlements.mac.plist',
    // entitlementsInherit: './build/entitlements.mac.inherit.plist',
  },
  dmg: {
    iconSize: 128,
    window: {
      width: 540,
      height: 380,
    },
    // 增强选项（可选）
    // background: './build/dmg-background.png',   // 背景图片
    // backgroundColor: '#ffffff',                 // 背景色
    // icon: './build/volume-icon.icns',           // 卷宗图标
    // title: '${productName} ${version}',         // 卷宗名称
    // format: 'UDZO',                            // 压缩格式
    // contents: [                                // 自定义图标布局
    //   { x: 130, y: 220, type: 'file' },
    //   { x: 410, y: 220, type: 'link', path: '/Applications' }
    // ]
  },

  // ----- Linux 配置（增强） -----
  linux: {
    target: ['AppImage', 'deb'],     // 可同时生成多种格式
    category: 'Development',         // 系统菜单分类
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
    // syncDesktopName: true,
  },
  // 特定格式的额外配置（可选）
  // appImage: { systemIntegration: 'doNotAsk' },
  // deb: { depends: ['libgtk-3-0'] },
}
```

> **平台说明**：构建时只生成**当前运行操作系统**对应的安装包（例如 Windows 下只生成 `.exe`）;但您可以通过 `mac.target` / `linux.target` 同时生成多种格式（如 macOS 同时生成 `.dmg` 和 `.zip`）;

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
示例：

```javascript
excludeFiles: [
  '.vscode/',
  '.git/',
  'node_modules/',    // ← 默认排除,以优化构建速度和安装体验
  'dist/',
  '*.log',
  './yarn.lock',
]
```

- 以 `/` 结尾表示目录及其内容;
- 以 `./` 开头表示仅匹配根目录下的文件（非递归）;
- 否则匹配任意路径的该模式（`minimatch` 全局匹配）;

---

### 排除依赖包 (`excludeDependencies`)

从最终安装的依赖列表中移除指定的 npm 包（这些包不会被安装到应用内）;
常用于排除构建工具自身依赖（如 `@flun/desktop-builder`）;

```javascript
excludeDependencies: [
  '@flun/desktop-builder',
  '@flun/windows'
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

  branding: {
    appIcon: './assets/icon.png',
    installerIcon: './assets/setup.ico',
    uninstallerIcon: './assets/uninstall.ico',
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

    win: { target: ['nsis'] },
    nsis: {
      oneClick: false,
      perMachine: true,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: '我的应用',
      deleteAppDataOnUninstall: false,
    },

    mac: {
      target: ['dmg', 'zip'],
      // 如需签名,请取消注释并填写
      // identity: 'Developer ID Application: My Company (TEAM123)',
      // hardenedRuntime: true,
    },
    dmg: {
      iconSize: 128,
      window: { width: 540, height: 380 },
      background: './build/dmg-background.png',
      backgroundColor: '#ffffff',
      title: '${productName} ${version}',
      contents: [
        { x: 130, y: 220, type: 'file' },
        { x: 410, y: 220, type: 'link', path: '/Applications' }
      ]
    },

    linux: {
      target: ['AppImage', 'deb'],
      category: 'Development',
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
    // 'node_modules/',   // ← 如需离线,请注释掉此行
    'dist/',
    '*.log',
    './yarn.lock',
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

### 为什么默认排除 `node_modules`？

在构建过程中,`electron-builder` 会对所有打包进去的文件进行数字签名（Windows 下为 Authenticode,macOS 下为 codesign）,以确保应用未被篡改;
`node_modules` 目录通常包含成千上万个文件（尤其是大型项目）,签名每个文件会耗费大量 CPU 和 I/O 时间,导致构建速度显著下降;

**更关键的是,包含 `node_modules` 会导致安装包体积暴增**（通常从几十 MB 涨到数百 MB）,用户下载耗时、安装程序解压和复制数万个小文件的过程极其缓慢（尤其是在 Windows 上,NSIS 解压大量文件非常吃力）;
这会严重损害**用户安装体验**;

**因此,默认在 `excludeFiles` 中排除 `node_modules`,是经过深思熟虑的设计决策——优先保证构建速度和用户安装体验,让开发者能快速迭代,用户也能流畅安装;**

### 默认行为下的网络需求

- 由于安装包不包含依赖,用户首次启动应用时会自动执行 `npm install`（或 `npm ci`）安装生产依赖;
- 此过程**需要联网**,并且依赖包数量越多,耗时越长;
- 但只需这一次,依赖安装完成后,后续启动完全离线,且运行性能与本地安装无异;

### 如何实现完全离线运行？

若用户网络环境受限,或您希望交付完全离线的安装包,只需在 `excludeFiles` 中**注释掉 `'node_modules/'`**,让依赖被打包;
但请务必注意：
- **构建时间会增加**（复制、签名大量文件）;
- **安装包体积会大幅增大**,用户安装时间也会变长;
- 权衡利弊,通常仅在以下情况建议包含依赖：
  - 目标用户网络条件差;
  - 应用依赖数量较少（< 50 个包）,体积影响可控;

### 优化建议（兼顾速度与离线）

如果决定包含 `node_modules`,可以采取以下措施缓解性能问题：

1. **精简依赖**：移除不必要的包,使用 `npm prune --production` 仅保留生产依赖,可将 `node_modules` 体积缩减 30%~50%;
2. **使用 `build.asar: true`**：将 `node_modules` 打包成 ASAR 归档,减少文件数量,签名和安装时只需处理一个文件（但需测试兼容性,某些原生模块可能不兼容 ASAR）;
3. **排除无用文件**：在 `excludeFiles` 中添加模式,剔除 `node_modules` 中的测试、文档、示例等（例如 `node_modules/**/*.md`, `node_modules/**/test/` 等）,进一步缩小体积;

**示例优化后的 `excludeFiles`（保留依赖,但剔除冗余文件）：**

```javascript
excludeFiles: [
  '.vscode/',
  '.git/',
  // 保留 node_modules,但剔除无用文件
  'node_modules/**/*.md',
  'node_modules/**/test/',
  'node_modules/**/__tests__/',
  'node_modules/**/example/',
  'node_modules/**/examples/',
  // ... 其他
]
```

**最佳组合方案（推荐）：**

- 构建前执行 `npm prune --production`（移除开发依赖）;
- 保留 `node_modules`,但只包含生产依赖,体积和文件数大大减少;
- 在 `package.json` 中设置 `scripts.prebuild` 和 `postbuild` 自动管理;

```json
{
  "scripts": {
    "prebuild": "npm prune --production",
    "build": "npx desktop-builder build",
    "postbuild": "npm install"
  }
}
```

这样既实现了离线,又通过精简依赖控制了构建和安装时间;

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
- 确认包已正确安装,`postinstall` 会自动复制模板;若未自动复制,可手动从 `node_modules/@flun/desktop-builder/desktopAppConfig.js` 复制到项目根目录;

### 2. 构建失败,提示 `electron-builder` 相关错误
- 确保网络畅通,首次构建需下载 Electron 运行时（约 100MB）;
- 可尝试设置镜像环境变量（构建脚本已自动配置国内镜像,如 `ELECTRON_MIRROR`）;

### 3. 应用版本号如何设置？
- 版本号取自项目根目录下 `package.json` 的 `version` 字段,请直接修改该文件;

### 4. 生成的安装包很大（约 100MB）
- 正常,Electron 包含完整 Chromium 内核;可通过 `build.compression: 'maximum'` 或 `build.asar: true`（但包内 `asar` 默认为 `false` 以兼容某些后端）进行优化;

### 5. 如何只生成当前平台的安装包？
- 默认行为即为只生成当前平台;如需生成其他平台,请在对应操作系统上执行构建命令;

### 6. 菜单中的 `__TOGGLE_BROWSER__` 有什么作用？
- 该特殊标记会被替换为“在系统默认浏览器中打开应用地址”的功能,方便用户测试;

### 7. 为什么我设置了 `nodeIntegration: false`,但应用仍然能访问 Node.js？
- 如上方“窗口配置”警告所述,本工具为了自动启动后端服务,**强制启用了 `nodeIntegration` 并关闭了 `contextIsolation` 和 `sandbox`**;
  这是设计上的必要妥协,但确实降低了安全性;**请勿在应用中加载外部网页或不可信内容**;

### 8. 构建后的应用必须联网才能使用吗？
- **默认情况下**,首次启动需要联网安装依赖；之后可离线运行;
  若要完全离线,请在 `excludeFiles` 中保留 `node_modules`（注释掉排除规则）,并考虑使用 `npm prune --production` 精简依赖,以平衡构建速度和安装体验;

---

## 📄 许可证

ISC © [flun](https://github.com/OpenFlun)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request;
项目地址：[https://github.com/OpenFlun/desktop-builder](https://github.com/OpenFlun/desktop-builder)