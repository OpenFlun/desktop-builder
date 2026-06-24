# @flun/desktop-builder

> 将自己的任意 Node.js 网站一键打包为桌面应用（基于 Electron），支持高度自定义配置。

[![npm version](https://img.shields.io/npm/v/@flun/desktop-builder.svg)](https://www.npmjs.com/package/@flun/desktop-builder)
[![license](https://img.shields.io/npm/l/@flun/desktop-builder.svg)](https://github.com/flun/desktop-builder/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@flun/desktop-builder.svg)](https://nodejs.org)

---

## 📖 简介
### 本包以 ESM 模块系统编写;只要你的 Node.js 版本大于22.12,可保留CJS `require()` 语法调用,否则请使用 `import` 语法;
`@flun/desktop-builder` 是一个用于 **将本地 Nodejs Web 应用打包成桌面应用** 的构建工具。用户只需提供一个配置文件，即可生成对应的安装包。

它通过 **自动嵌入 Nodejs 后端服务**，让最终用户无需安装 Nodejs 环境，双击图标即可运行你的网站。

---

## ✨ 特性

- 🚀 **一键打包**：基于 `electron-builder`，快速生成安装包。
- ⚙️ **高度可配置**：通过单一 `desktopAppConfig.js` 控制窗口尺寸、图标、安装选项等。
- 🖥️ **跨平台支持**：输出 Windows、macOS、Linux 三平台安装程序。
- 🔌 **自动启动服务**：应用启动时自动运行你的 Nodejs 后端。
- 📦 **静默安装选项**：支持 NSIS 安装包自定义（一键安装/向导安装）。
- 🎨 **品牌自定义**：可设置应用图标、名称、版本等。

---

## 📦 安装

在你的项目目录下安装为开发依赖：

```bash
npm i -D @flun/desktop-builder
```

安装完成后，`postinstall` 脚本会自动将 `desktopAppConfig.js` 配置文件模板复制到你的项目根目录（如果不存在）。

---

## 🚀 快速开始

### 1. 配置 `desktopAppConfig.js`

打开项目根目录下的 `desktopAppConfig.js`，填写你的网站信息：

```javascript
export default {
  serverPath: './server.js',         // 你的 Node.js 网站启动脚本
  appUrl: 'http://www.abc.com:7296', // 启动后访问的地址
  appName: 'My Desktop App',         // 应用显示名称

  // 其他可选配置...
};
```

### 2. 构建桌面应用

在终端执行：

```bash
npx desktop-builder build
```

首次构建会自动下载 Electron 运行时（约 100MB），请耐心等待。构建完成后，安装包会生成在 `./dist` 目录（可自定义输出路径）。

---

## ⚙️ 配置详解

`desktopAppConfig.js` 支持以下配置项（所有字段均为可选，除 `serverPath`、`appUrl`、`appName` 外）：

| 字段              | 类型     | 默认值                    | 说明                                                 |
| ----------------- | -------- | ------------------------- | ---------------------------------------------------- |
| **`serverPath`**  | `string` | **必填**                  | Node.js 启动脚本路径（相对项目根目录或绝对路径）     |
| **`appUrl`**      | `string` | **必填**                  | 网站启动后的访问地址（如 `http://www.abc.com:7296`） |
| **`appName`**     | `string` | **必填**                  | 应用名称（显示在标题栏、快捷方式等）                 |
| `window`          | `object` | 见下方                    | 主窗口配置                                           |
| `branding.icon`   | `string` | `'./icon.png'`            | 应用图标路径（建议 512x512 PNG）                     |
| `build.outputDir` | `string` | `'./dist'`                | 安装包输出目录                                       |
| `build.appId`     | `string` | `'com.example.app'`       | 应用唯一标识（反向域名）                             |
| `build.nsis`      | `object` | 见下方                    | Windows NSIS 安装包选项                              |
| `build.dmg`       | `object` | 见下方                    | macOS DMG 选项                                       |
| `build.linux`     | `object` | `{ category: 'Utility' }` | Linux 桌面分类                                       |
| `advanced`        | `object` | 见下方                    | 高级行为选项                                         |

### 窗口配置 (`window`)

```javascript
window: {
  width: 1200,          // 默认宽度
  height: 800,          // 默认高度
  minWidth: 800,        // 最小宽度
  minHeight: 600,       // 最小高度
  resizable: true,      // 是否可调整大小
  fullscreenable: true, // 是否允许全屏
  alwaysOnTop: false,   // 是否置顶
  frame: true,          // 是否显示窗口边框（标题栏、关闭按钮）
  backgroundColor: '#ffffff',
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
  },
}
```

### NSIS 安装选项 (`build.nsis`)

```javascript
nsis: {
  oneClick: false,                      // 一键安装（true）还是向导安装（false）
  perMachine: true,                     // 是否安装到所有用户（需管理员权限）
  allowToChangeInstallationDirectory: true, // 是否允许用户更改安装目录
  createDesktopShortcut: true,          // 创建桌面快捷方式
  createStartMenuShortcut: true,        // 创建开始菜单快捷方式
  shortcutName: 'My App',               // 快捷方式名称
  deleteAppDataOnUninstall: false,      // 卸载时是否删除用户数据
}
```

### DMG 选项 (`build.dmg`)

```javascript
dmg: {
  iconSize: 128,
  window: {
    width: 540,
    height: 380,
  },
}
```

### 高级选项 (`advanced`)

```javascript
advanced: {
  autoStartServer: true,    // 是否在应用启动时自动运行后端服务
  autoKillServer: true,     // 是否在应用退出时自动关闭后端服务
  serverStartupDelay: 3000, // 等待后端服务启动的延迟时间（毫秒）
}
```

---

## 🖥️ 示例

假设你有一个 Express 项目，目录结构如下：

```
my-express-app/
├── server.js          # 入口文件，监听 7296 端口
├── package.json
└── (其他文件)
```

安装 `@flun/desktop-builder` 后，配置 `desktopAppConfig.js`：

```javascript
export default {
  serverPath: './server.js',
  appUrl: 'http://www.abc.com:7296',
  appName: 'My Express App',
  branding: {
    icon: './static/app-icon.png',
  },
  build: {
    appId: 'com.mycompany.expressapp',
    outputDir: './release',
    nsis: {
      oneClick: true,
      perMachine: false,
    },
  },
  window: {
    width: 1280,
    height: 720,
  },
};
```

执行构建：

```bash
npx desktop-builder build
```

生成的安装包将位于 `./release` 目录。

---

## 🛠️ 常见问题

### 构建时提示 `desktopAppConfig.js not found`
- 确认包已正确安装，`postinstall` 脚本会自动复制配置文件。如未自动复制，可手动从 `node_modules/@flun/desktop-builder/desktopAppConfig.js` 复制到项目根目录。

### 构建失败，提示 `electron-builder` 相关错误
- 确保网络畅通，首次构建需要下载 Electron 依赖。
- 可尝试设置 npm 镜像或代理。

### 如何修改应用版本号？
- 目前版本号固定为 `1.0.0`，后续版本将支持从 `package.json` 读取或自定义。

### 生成的安装包很大（约 100MB）
- 这是正常现象，因为 Electron 打包了完整的 Chromium 浏览器内核。可考虑使用 `electron-builder` 的压缩选项（如 `compression: 'maximum'`）进一步缩减体积。

---

## 📄 许可证

ISC © [flun](https://github.com/flun)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。
项目地址：[https://github.com/flun/desktop-builder](https://github.com/flun/desktop-builder)