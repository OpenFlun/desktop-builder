/**
 * @flun/desktop-builder 配置文件
 * 所有路径相对于项目根目录
 */
export default {
	// ===== 必填 =====
	serverPath: './server.js',           // 网站启动脚本路径
	appUrl: 'http://www.abc.com:7296',   // 网站访问地址
	appName: '我的桌面应用',              // 应用显示名称

	// ===== 窗口配置 =====
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

	// ===== 图标 =====
	branding: {
		icon: './icon.png',                 // 图标路径，建议 512x512 PNG
	},

	// ===== 打包配置 =====
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
			iconSize: 128,                // 图标大小
			window: { width: 540, height: 380 }, // DMG 窗口尺寸
		},

		// Linux 选项
		linux: {
			category: 'Utility',         // 系统菜单分类: Utility/Development/Network 等
		},
	},

	// ===== 高级选项 =====
	advanced: {
		autoStartServer: true,           // 是否自动启动后端服务
		autoKillServer: true             // 退出时是否自动关闭后端
	},
};