/**
 * 桌面APP打包配置
 * ```ps
 * npx desktop-builder build # 构建桌面应用安装包
 * npx desktop-builder help  # 查看帮助
 * ```
 * 所有路径相对于项目根目录
 */
export default {
	// 必填字段:serverPath,appUrl;
	serverPath: './server.js',           // 网站启动脚本路径
	appUrl: 'http://www.abc.com:7296',   // 网站访问地址

	appName: null,                       // 应用显示名称(默认从 package.json 读取 name)
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
		titleBarStyle: 'default',         // 标题栏样式: default/hidden/hiddenInset（仅 macOS）
		backgroundColor: '#5127ce',     // 加载时的背景色
		show: false,                      // false=等页面渲染完再显示,防白屏
		webPreferences: {
			// 注意：nodeIntegration、contextIsolation、sandbox 将被强制覆盖.此处配置无效
			// 其他属性（如 plugins, webSecurity, enableWebAuthn 等）仍然生效
			nodeIntegration: false,        // 此值无效,实际强制为 true
			contextIsolation: true,        // 此值无效,实际强制为 false
			sandbox: false,                // 此值无效,实际强制为 false
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
		appId: 'com.example.app',     	   // 应用唯一标识（反向域名格式）
		outputDir: './dist',               // 安装包输出目录
		publisher: null,                   // 发布者名称（用于安装程序信息,默认从 package.json 读取 author）
		shortcutName: null,       		   // 快捷方式名称（默认使用 appName）
		// asar 打包:将应用代码归档为 app.asar,减少文件数量、加快加载(默认启用)
		// asar.unpack:指定需解包到 app.asar.unpacked 的文件(如原生模块、可执行文件等)
		// electron-builder v27 变更:ASAR 配置收拢到 asar 对象下,省略该字段即默认启用
		asar: {
			unpack: [
				// 原生模块(.node)会被自动解包,通常无需手动添加
				// 如需额外解包,填写 glob 模式,例如:
				// '**/node_modules/sharp/**/*',
				// '**/bin/**'
			]
		},
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
		// macOS 上构建 Windows 目标时需宿主机安装 Wine: brew install --cask wine-stable
		toolsets: {
			wine: 'system',
		},

		// Win 平台配置
		win: {
			icon: './build/icon.png',      // 应用图标（.png 格式）,用于快捷方式和文件图标,建议 512x512 PNG
			// 其他可选：publisherName 等
			// 应用本体签名(electron-builder v27: 统一移入 sign 对象,必须带 type 字段)
			// 签名对象:打包进安装包的应用可执行文件(与下方 inno 的签名字段职责不同)
			// 公共说明:如需签名,取消下方注释并按实际填写;certificatePassword 推荐用环境变量 CSC_KEY_PASSWORD 传入
			// sign: {
			//     type: 'signtool',                             // 必填,固定为 'signtool'(v27 判别字段)
			//     certificateFile: './build/cert.pfx',           // 证书文件路径(.pfx)
			//     certificatePassword: process.env.CSC_KEY_PASSWORD, // 证书密码(推荐用环境变量)
			//     signingHashAlgorithms: ['sha256'],             // 签名算法
			// },
		},
		// Win Inno Setup(基于7.0.2版本) 选项
		inno: {
			// 基础信息
			appName: undefined,            // 应用显示名称(默认使用 appName)
			appVersion: undefined,         // 版本号(默认从 package.json 读取 version)
			appPublisher: undefined,       // 发布者(默认使用 build.publisher)
			appId: undefined,              // 应用唯一标识(默认使用 build.appId)
			defaultDirName: null, 		   // 默认安装目录,支持变量:{autopf}, {pf}, {app}等(如'D:\\MyApp'),默认使用 appName
			defaultGroupName: undefined,   // 开始菜单文件夹名(默认使用 appName)
			outputDir: undefined,          // 输出目录(默认使用 build.outputDir)
			outputBaseFilename: undefined, // 安装包文件名(默认 <appName>Setup.exe)

			// 界面控制
			disableWelcomePage: false,      // true=跳过欢迎页
			disableDirPage: false,          // true=禁止更改安装路径
			disableProgramGroupPage: false, // true=禁止选择开始菜单文件夹
			disableFinishedPage: false,     // true=隐藏“安装完成”页面(安装后直接关闭向导)
			disableReadyPage: false,        // true=隐藏“准备安装”确认页
			disableReadyMemo: false,        // true=在准备页不显示设置摘要
			disableStartupPrompt: false,    // true=禁止启动时显示“是否安装...”的提示框
			showLanguageDialog: true,       // true=显示语言选择对话框
			flatComponentsList: false,      // true=组件列表使用扁平(无边框)样式
			showComponentSizes: false,      // true=在组件选择页面显示每个组件的大小
			showTasksTreeLines: false,      // true=在任务选择页面显示树形连线
			setupIconFile: './build/setup.ico',         	 	 // 安装程序图标(.ico)
			uninstallDisplayIcon: './build/uninstallerIcon.ico', // 卸载程序图标路径(.ico)
			// 向导样式(颜色格式支持 $bbggrr/#bbggrr/颜色名->英文)
			WizardStyle: 'dynamic',          // 向导样式:modern/classic/dynamic/dark/light/hidebevels等等,可组合
			WizardImageFile: './build/wizard.bmp',      	 	   // 左侧大图(164×314 BMP)
			WizardSmallImageFile: './build/wizardSmall.bmp', 	   // 右上小图(55×58 BMP)
			// WizardBackImageFile: './build/background.png', 	   // 背景图片路径(PNG格式)
			WizardImageFileDynamicDark: './build/wizard.bmp',	   // 向导样式为'dynamic'时深色模式下的左侧大图
			WizardSmallImageFileDynamicDark: './build/wizardSmall.bmp',// 向导样式为'dynamic'时深色模式下的右上小图
			// WizardBackImageFileDynamicDark: './build/darkBg.png',// 向导样式为'dynamic'时深色模式下的背景图片路径
			WizardImageBackColor: '#CE2751',	  	 			   // 标准模式下左侧大图的背景色
			WizardSmallImageBackColor: '#CE2751', 	 			   // 标准模式下右上小图的背景色
			WizardBackColor: '#CE2751',   		 	   		 	   // 标准模式下的背景色
			WizardImageBackColorDynamicDark: '#228866',	  	   // 向导样式为'dynamic'时深色模式下的左侧大图的背景色
			WizardSmallImageBackColorDynamicDark: '#228866', 	   // 向导样式为'dynamic'时深色模式下的右上小图的背景色
			WizardBackColorDynamicDark: '#228866', 	   		   // 向导样式为'dynamic'时深色模式下的背景色
			// WizardImageOpacity: 200,           					// 图标不透明度(0-255)
			// WizardBackImageOpacity: 200,						    // 背景图片的不透明度(0-255)
			WizardImageStretch: true,         					    // 向导图片是否始终填充整个区域(默认true, false=保持原始大小且居中)

			// 权限
			privilegesRequired: 'lowest',   		 			 // 所需权限:admin / lowest / poweruser
			privilegesRequiredOverridesAllowed: 'dialog',        // 通过对话框选择提升权限,commandline(通过命令行)

			// 许可和说明文件
			// licenseFile: './LICENSE.txt',  		// 许可协议文件
			// infoBeforeFile: './info_before.txt', // 安装前显示的文件
			// infoAfterFile: './info_after.txt',   // 安装后显示的文件

			// 压缩
			compression: 'lzma2',          // 压缩方式:lzma2 / zip / none
			solidCompression: true,        // 是否固实压缩(默认true)
			LZMADictionarySize: 4096,      // LZMA 字典大小(单位 KB,推荐 4096 平衡速度与体积)
			LZMANumFastBytes: 64,          // LZMA 快速字节数(默认 64,可微调)

			// 快捷方式
			createDesktopShortcut: true,   // 是否创建桌面快捷方式
			createStartMenuShortcut: true, // 是否创建开始菜单快捷方式
			shortcutName: undefined,       // 快捷方式名称(默认使用 build.shortcutName)

			// 安装后运行
			runAfterInstall: true,         // 安装完成后是否运行应用
			runDescription: '运行应用',     // 运行复选框的描述文字

			// 高级选项
			languageDetectionMethod: 'uilanguage', // 语言检测方式:uilanguage / locale / none
			allowCancelDuringInstall: true,    	   // 是否允许安装过程中取消(默认true)
			usePreviousAppDir: true,       	   	   // 是否记住上次安装目录(升级时,默认true)
			usePreviousGroup: true,        	   	   // 升级时是否记住上次的开始菜单文件夹(默认true)
			usePreviousSetupType: true,    	   	   // 升级时是否记住上次选择的安装类型(默认true)
			usePreviousTasks: true,        	   	   // 升级时是否记住上次选择的任务(如桌面快捷方式,默认true)
			usePreviousLanguage: true,     	   	   // 升级时是否记住上次选择的语言(默认true)
			updateUninstallLogAppName: false, 	   // true=更新卸载日志中的应用名称
			uninstallable: true,           	   	   // 是否可卸载
			createUninstallRegKey: true,   	   	   // 是否创建卸载注册表项
			uninstallDisplayName: '卸载(destApp)', // 在“添加/删除程序”中显示的名称
			uninstallLogMode: 'append',       	   // 卸载日志模式:new / append / overwrite
			appSupportURL: undefined,      	   	   // 支持网址
			appUpdatesURL: undefined,      	   	   // 更新网址
			appPublisherURL: '',           	   	   // 发布者网址(写入卸载注册表)
			appReadmeFile: '',             	   	   // 自述文件路径(建议 .txt 或 .rtf)
			appContact: '',                	   	   // 联系信息(如邮箱)
			appComments: '',               	   	   // 备注信息
			versionInfoVersion: undefined, 	   	   // 文件版本信息(默认使用 inno.appVersion)
			versionInfoDescription: undefined, 	   // 文件描述
			versionInfoCopyright: undefined, 	   // 版权信息
			versionInfoCompany: undefined, 		   // 公司名称(默认从 package.json 读取 author)
			// 安装程序签名（Inno Setup 自身机制）
			// 签名对象：安装程序 Setup.exe 与卸载程序 unins000.exe（与上方 win.sign 职责不同）
			// 公共说明:signingTool 与 signToolParams 需同时配置才会启用签名,缺少任一则不签名
			signedUninstaller: false,                  // 是否为卸载程序签名(true=同时对卸载程序 unins000.exe 签名)
			signingTool: undefined,                    // 签名工具(可填 'signtool.exe' 自动查找,或完整路径如 'C:\\...\\signtool.exe')
			signToolParams: undefined,                 // 签名参数(对象格式,仅需填 certificateFile/certificatePassword/algorithm 三项)
			// signToolParams: {                       // 示例:三项填好后自动拼成 signtool 命令行
			//     certificateFile: 'D:\\build\\cert.pfx', // 证书文件路径(.pfx)
			//     certificatePassword: 'your-password',   // 证书密码
			//     algorithm: 'sha256',                    // 签名算法(默认 sha256)
			// },
			// 系统要求与架构
			minVersion: '10.0.17763',              // 最低 Windows 版本(这里设为 Win10 1809+,可调整)
			onlyBelowVersion: '',          		   // 限制最高可运行的版本(如 '6.2' 表示不能运行在 Win8 及以上)
			useSetupLdr: true,                     // true=使用 SetupLdr 引导程序(处理 UAC 和系统版本检查)
			// *** 更多字段请自行根据官网添加 ***
			// 官方文档: https://jrsoftware.org/ishelp/index.php?topic=setup
			// 本人整理的中文文档:https://gitee.com/OpenFlun/inno-setup
		},

		// macOS 配置
		mac: {
			target: ['zip', 'dmg'],          // 构建目标：dmg / zip / pkg / mas 等
			// icon: './build/icon.icns',       // 应用图标(.icns,需自备,建议 512x512)
			// 代码签名与公证配置:启用后应用可通过 macOS Gatekeeper 验证
			// 公共说明:identity 与 certificateFile 二选一;certificatePassword 留空则自动读 CSC_KEY_PASSWORD;
			//           certificateFile 留空则自动读 CSC_LINK;identity 留空则自动读 CSC_NAME 环境变量
			// electron-builder v27 变更:所有 macOS 签名选项统一移入 sign 对象
			// sign: {
			//     identity: 'Developer ID Application: Your Name (TEAM123)',  // 签名证书名称(与 certificateFile 二选一)
			//     certificateFile: undefined,                                 // 证书文件路径(.p12,与 identity 二选一)
			//     certificatePassword: process.env.CSC_KEY_PASSWORD,          // 证书密码(推荐用环境变量)
			//     hardenedRuntime: true,                                      // 启用 Hardened Runtime(公证必需)
			//     entitlements: './build/entitlements.mac.plist',             // 签名 entitlements 文件(需自备)
			//     entitlementsInherit: './build/entitlements.mac.inherit.plist', // Helper 进程 entitlements(需自备)
			//     // 公证配置:如需自动公证,取消注释并填写(需 Apple Developer 账号)
			//     // notarize: {
			//     //     teamId: 'TEAM123',
			//     //     appleId: 'your@email.com',
			//     //     appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
			//     // },
			// },
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

		// ----- Linux 配置（增强）-----
		linux: {
			target: ['AppImage', 'deb'],     // 构建目标：AppImage / deb / rpm / snap / flatpak 等
			category: 'Development',         // 系统菜单分类（如 Utility, Network, Development 等）
			// Linux 图标无需显式配置，只需在 ./build 目录下提供符合尺寸和格式的默认图标 icon.png 即可（建议 512x512 PNG）
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
			// },
			// },
			// Linux 启动器说明:所有 Linux 目标通过 <executableName>-launcher 脚本启动
			// executableArgs 会被注入 launcher 脚本,生成的 .desktop Exec 指向该脚本
			// electron-builder v27 变更:syncDesktopName 已被移除,行为变为始终同步 .desktop 文件名与窗口类名
			// 代码签名:GPG 签名(deb 通过 dpkg-sig,AppImage 通过 appimagetool)
			// 公共说明:electron-builder 本身不签名 Linux 包,签名由底层工具完成;
			//           需先在宿主机安装 GPG 密钥,推荐用环境变量传入密钥与密码
			// sign: {
			//     gpgPrivateKey: process.env.GPG_PRIVATE_KEY,       // GPG 私钥(ASCII-armored 内容)
			//     gpgKeyPassphrase: process.env.GPG_KEY_PASSPHRASE, // GPG 密钥密码
			// },
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

	// 允许执行安装脚本的包名列表
	allowScripts: {
		'node': true,
		'@flun/webauthn-server': true
	},

	// 排除文件/目录（相对于项目根目录,支持 glob 模式）
	excludeFiles: [
		'.vscode/',
		'.idea/',
		'.git/',
		'.hintrc',
		'.greenlockrc',
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