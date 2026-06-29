/**
 * @flun/desktop-builder 配置文件
 * 所有路径相对于项目根目录
 */
export default {
	// 必填字段:serverPath,appUrl,appName;
	serverPath: './server.js',           // 网站启动脚本路径
	appUrl: 'http://www.abc.com:7296',   // 网站访问地址
	appName: '我的桌面应用',              // 应用显示名称

	// 窗口配置
	window: {
		width: 1200,                      // 默认宽度(px)
		height: 800,                      // 默认高度(px)
		minWidth: 800,                    // 最小宽度(px)
		minHeight: 600,                   // 最小高度(px)
		maxWidth: undefined,              // 最大宽度(px)，不限制则留空
		maxHeight: undefined,             // 最大高度(px)，不限制则留空
		resizable: true,                  // 是否可调整窗口大小
		fullscreenable: true,             // 是否允许全屏
		alwaysOnTop: false,               // 是否始终置顶
		frame: true,                      // 是否显示标题栏
		titleBarStyle: 'default',         // 标题栏样式: default/hidden/hiddenInset
		backgroundColor: '#ffffff',      // 加载时的背景色
		show: false,                       // false=等页面渲染完再显示，防白屏
		webPreferences: {
			nodeIntegration: false,        // 是否启用 Node.js（安全起见保持 false）
			contextIsolation: true,        // 是否启用上下文隔离（保持 true）
		},
	},

	// 图标
	branding: {
		appIcon: null,             		   // 应用图标路径，建议 512x512 PNG
		installerIcon: null,    		   // 安装程序图标（必须 .ico）
		uninstallerIcon: null   		   // 卸载程序图标（必须 .ico）
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
				{ role: 'minimize', label: '最小化' },
				{ role: 'zoom', label: '缩放' },
				{ type: 'separator' },
				{ role: 'close', label: '关闭' }
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

		// Windows 安装包选项 (NSIS)
		nsis: {
			oneClick: false,                 // true=一键安装，false=向导安装
			perMachine: true,                // true=安装到所有用户，false=仅当前用户
			allowToChangeInstallationDirectory: true, // 是否允许用户更改安装路径
			createDesktopShortcut: true,     // 是否创建桌面快捷方式
			createStartMenuShortcut: true,   // 是否创建开始菜单快捷方式
			shortcutName: '我的桌面应用',     // 快捷方式名称
			deleteAppDataOnUninstall: false, // 卸载时是否删除用户数据
		},

		// macOS DMG 选项
		dmg: {
			iconSize: 256,                		 // 图标大小
			window: { width: 540, height: 380 }, // DMG 窗口尺寸
		},

		// Linux 选项
		linux: {
			category: 'Utility',         // 系统菜单分类: Utility/Development/Network 等
		},
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
		'node_modules/',
		'dist/',
		'docs/',
		'temp/',
		'tests/',
		'./yarn.lock',
		'./desktop.ini',
		'./desktopAppConfig.js',
		'./sevWin.js',
		'./unSevWin.js',
		'*.tgz',
		'*.log'
	],

	// 排除依赖包（从最终依赖列表中移除,不会安装）
	excludeDependencies: [
		'@flun/desktop-builder',
		'@flun/windows'
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