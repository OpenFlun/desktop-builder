/**
 * @flun/desktop-builder 配置文件
 * 所有路径相对于项目根目录
 */
export default {
	// 必填字段:serverPath,appUrl,appName;
	serverPath: './server.js',           // 网站启动脚本路径
	appUrl: 'http://www.abc.com:7296',   // 网站访问地址
	appName: '我的桌面应用',              // 应用显示名称
	enableLogging: false,                // 是否启用日志文件记录,默认关闭

	// 窗口配置
	window: {
		width: 1200,                      // 默认宽度(px)
		height: 800,                      // 默认高度(px)
		minWidth: 800,                    // 最小宽度(px)
		minHeight: 600,                   // 最小高度(px)
		maxWidth: undefined,              // 最大宽度(px),不限制则留空
		maxHeight: undefined,             // 最大高度(px),不限制则留空
		resizable: true,                  // 是否可调整窗口大小
		fullscreenable: true,             // 是否允许全屏
		alwaysOnTop: false,               // 是否始终置顶
		frame: true,                      // 是否显示标题栏
		titleBarStyle: 'default',         // 标题栏样式: default/hidden/hiddenInset
		backgroundColor: '#5127ce',     // 加载时的背景色
		show: false,                      // false=等页面渲染完再显示,防白屏
		webPreferences: {
			// 注意：nodeIntegration、contextIsolation、sandbox 将被强制覆盖.此处配置无效
			// 其他属性（如 plugins, webSecurity, enableWebAuthn 等）仍然生效
			nodeIntegration: false,        // 此值无效,实际强制为 true
			contextIsolation: true,        // 此值无效,实际强制为 false
		},
	},

	// 菜单配置（可自由修改语言和结构）
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
		{
			label: '查看',
			submenu: [
				{ role: 'reload', label: '重新加载' },
				{ role: 'forceReload', label: '强制重新加载' },
				{ role: 'toggleDevTools', label: '开发者工具' },
				{ type: 'separator' },
				{ role: 'resetZoom', label: '重置缩放' },
				{ role: 'zoomIn', label: '放大' },
				{ role: 'zoomOut', label: '缩小' },
				{ type: 'separator' },
				{ role: 'togglefullscreen', label: '全屏' }
			]
		},
		{
			label: '窗口',
			submenu: [
				{
					label: '在浏览器中打开',
					click: '__TOGGLE_BROWSER__'
				},
				{ role: 'minimize', label: '最小化' },
				{ role: 'zoom', label: '缩放' },
				{ type: 'separator' },
				{ role: 'close', label: '关闭' }
			]
		},
		{
			label: '主题',
			submenu: [
				{ label: '浅色', click: '() => { require("electron").nativeTheme.themeSource = "light"; }' },
				{ label: '深色', click: '() => { require("electron").nativeTheme.themeSource = "dark"; }' },
				{ label: '跟随系统', click: '() => { require("electron").nativeTheme.themeSource = "system"; }' }
			]
		},
		{
			label: '帮助',
			submenu: [
				{
					label: '关于',
					click: `() => { require('electron').shell.openExternal('https://electronjs.org'); }`
				}
			]
		}
	],

	// 打包配置
	build: {
		appId: 'com.mycompany.myapp',    	// 应用唯一标识（反向域名格式）
		outputDir: './dist',             	// 安装包输出目录

		// ----- Windows 安装包选项 (NSIS) -----
		nsis: {
			oneClick: false,                 // true=一键安装,false=向导安装
			perMachine: false,               // true=安装到所有用户,false=仅当前用户
			allowToChangeInstallationDirectory: true, // 是否允许用户更改安装路径
			createDesktopShortcut: true,     // 是否创建桌面快捷方式
			createStartMenuShortcut: true,   // 是否创建开始菜单快捷方式
			shortcutName: '我的桌面应用',     // 快捷方式名称
			deleteAppDataOnUninstall: false, // 卸载时是否删除用户数据
			installerHeader: './build/installerHeader.bmp',      // 安装头横幅,格式为 BMP,150×57
			installerSidebar: './build/installerSidebar.bmp',    // 安装侧边栏,格式为 BMP,164×314
			uninstallerSidebar: './build/uninstallerSidebar.bmp',// 卸载侧边栏,格式为 BMP,164×314
			installerIcon: './build/installerIcon.ico',          // 安装程序图标（必须 .ico）
			uninstallerIcon: './build/uninstallerIcon.ico'       // 卸载程序图标（必须 .ico）
		},
		// Windows 平台通用配置（可覆盖或补充）
		win: {
			target: ['nsis'],                // 构建目标：nsis / portable / zip 等
			icon: './build/icon.png',        // 应用图标,建议 512x512 PNG
			// 其他可选字段：icon, publisherName, signingHashAlgorithms 等
		},

		// ----- macOS 配置（增强） -----
		mac: {
			target: ['zip', 'dmg'],          // 构建目标：dmg / zip / pkg / mas 等
			icon: './build/icon.png',        // 应用图标,建议 512x512 PNG
			// 以下为可选高级字段（如需代码签名或 Mac App Store 发布,可取消注释并填写）
			// identity: 'Developer ID Application: Your Name (TEAM123)', // 签名证书名称
			// hardenedRuntime: true,        // 启用 Hardened Runtime
			// entitlements: './build/entitlements.mac.plist', // 签名 entitlements 文件
			// entitlementsInherit: './build/entitlements.mac.inherit.plist', // Helper 进程 entitlements
			// provisioningProfile: './build/profile.provisionprofile', // 仅 MAS 需要
		},
		// macOS DMG 选项
		dmg: {
			iconSize: 80,                		 // 图标大小
			window: { width: 540, height: 380 }, // DMG 窗口尺寸
			// 以下为增强选项（可选）
			// background: './build/background.png',    // DMG 背景图片（建议 PNG） 540×380
			// backgroundColor: '#5127ce',            // 无背景图时的背景色
			// icon: './build/icon.icns',               // DMG 卷宗图标（显示在 Finder 侧边栏）
			// title: '${productName} ${version}',      // 挂载后显示的卷宗名称
			// format: 'UDZO',                          // 压缩格式（UDZO/ULFO/UDBZ 等）
			// contents: [                              // 自定义窗口内图标布局
			//   { x: 130, y: 220, type: 'file' },
			//   { x: 410, y: 220, type: 'link', path: '/Applications' }
			// ]
		},

		// ----- Linux 配置（增强） -----
		linux: {
			target: ['AppImage', 'deb'],     // 构建目标：AppImage / deb / rpm / snap / flatpak 等
			category: 'Development',         // 系统菜单分类（如 Utility, Network, Development 等）
			// Linux 图标不用显示配置只需在./build目录下有符合尺寸和格式的默认图标 icon.png即可（建议 512x512 PNG）
			// 以下为可选高级字段
			// description: '完整的应用描述',   // 长描述
			// synopsis: '简短描述',           // 短描述
			// maintainer: '你的名字 <email@example.com>', // 维护者信息
			// vendor: '我的公司',            // 供应商名称
			// executableArgs: ['--enable-features=...'], // 启动时的命令行参数
			// desktop: {                    // 自定义 .desktop 文件内容
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
		// appImage: {
		//   systemIntegration: 'doNotAsk'  // 是否询问系统集成
		// },
		// deb: {
		//   depends: ['libgtk-3-0']        // deb 包的依赖
		// },
	},

	// 高级选项
	advanced: {
		autoStartServer: true,           // 是否自动启动后端服务
		autoKillServer: true             // 退出时是否自动关闭后端
	},

	// 排除文件/目录（相对于项目根目录,支持 glob 模式）
	excludeFiles: [
		'.vscode/',
		'.idea/',
		'.git/',
		'.hintrc',
		'.greenlockrc',
		'node_modules/', // ← 默认排除,以优化构建和安装速度（避免签名和解压海量文件）
		'dist/',
		'docs/',
		'temp/',
		'tests/',
		'./yarn.lock',
		'./desktop.ini',
		'./desktopAppConfig.js',
		'./package-lock.json',
		'*.tgz',
		'*.log'
	],

	// 排除依赖包（从最终依赖列表中移除,不会安装）
	excludeDependencies: [
		'@flun/desktop-builder'
	],

	/**
	 * 排除输出文件（在最终输出目录中排除某些安装包文件）
	 * 例如 *.blockmap、latest.yml 等;
	 * 注意：此配置仅在复制最终安装包到输出目录时生效,不影响构建过程;
	 */
	excludeOutputs: [
		'*.blockmap',
		'latest.yml'
	]
};