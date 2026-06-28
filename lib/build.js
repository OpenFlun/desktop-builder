import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import chalk from 'chalk';
import { execa } from 'execa';
import sizeOf from 'image-size';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const CACHE_DIR = path.join(os.homedir(), '.electron-builder-cache');
const DEFAULT_ICON = path.join(__dirname, 'icon.png');
const DEFAULT_INSTALLER_ICON = path.join(__dirname, 'setup.ico');
const DEFAULT_UNINSTALLER_ICON = path.join(__dirname, 'un.ico');

export default async function buildApp() {
    const configPath = path.join(process.cwd(), 'desktopAppConfig.js');
    if (!(await fs.pathExists(configPath))) {
        console.error(chalk.red('[错误] 未找到 desktopAppConfig.js 配置文件;'));
        process.exit(1);
    }

    const configModule = await import(`file://${configPath}?t=${Date.now()}`);
    const config = configModule.default;

    if (!config.serverPath || !config.appUrl || !config.appName) {
        console.error(chalk.red('[错误] 配置文件缺少必填字段: serverPath, appUrl, appName'));
        process.exit(1);
    }

    await fs.ensureDir(CACHE_DIR);
    process.env.ELECTRON_BUILDER_CACHE = CACHE_DIR;

    const tempDir = path.join(os.tmpdir(), 'desktop-builder-build', path.basename(process.cwd()) + '-' + Date.now());
    await fs.ensureDir(tempDir);
    await fs.emptyDir(tempDir);

    const projectRoot = path.resolve(process.cwd());
    console.log(chalk.blue('[信息] 正在复制项目文件从 ' + projectRoot + ' 到 ' + tempDir));

    await fs.copy(projectRoot, tempDir, {
        filter: (src) => {
            const relative = path.relative(projectRoot, src);
            if (relative.startsWith('.desktop-builder')) return false;
            const exclude = ['dist', '.git', '.vscode', '.idea', '*.log', '*.lock', 'package-lock.json', 'yarn.lock'];
            for (const pattern of exclude) {
                if (relative.startsWith(pattern) || relative === pattern) return false;
            }
            return true;
        },
        dereference: true,
    });

    const tempNodeModules = path.join(tempDir, 'node_modules');
    const srcNodeModules = path.join(projectRoot, 'node_modules');
    if (!(await fs.pathExists(tempNodeModules))) {
        if (await fs.pathExists(srcNodeModules)) {
            console.log(chalk.yellow('[警告] 临时目录中未找到 node_modules,正在复制...'));
            await fs.copy(srcNodeModules, tempNodeModules, { dereference: true });
        } else {
            console.error(chalk.red('[错误] 项目根目录下没有 node_modules,请先运行 npm install;'));
            process.exit(1);
        }
    }

    const mainTemplatePath = path.join(__dirname, '..', 'electron-main.js');
    const mainTemplate = await fs.readFile(mainTemplatePath, 'utf-8');

    // 处理菜单:直接注入对象字面量
    let menuCode = 'null';
    if (config.menu && Array.isArray(config.menu) && config.menu.length > 0) {
        menuCode = JSON.stringify(config.menu, (key, value) => {
            if (typeof value === 'function') {
                return value.toString();
            }
            return value;
        });
    } else {
        console.log(chalk.yellow('[警告] 未配置菜单,将使用默认英文菜单;'));
    }

    const windowConfig = {
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        resizable: true,
        fullscreenable: true,
        alwaysOnTop: false,
        frame: true,
        backgroundColor: '#ffffff',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        ...(config.window || {}),
    };

    const advanced = {
        autoStartServer: true,
        autoKillServer: true,
        serverStartupDelay: 3000,
        ...(config.advanced || {}),
    };

    const serverRelPath = path.basename(config.serverPath);

    const mainJs = mainTemplate
        .replace('__APP_URL__', JSON.stringify(config.appUrl))
        .replace('__WINDOW_CONFIG__', JSON.stringify(windowConfig))
        .replace('__SERVER_PATH__', JSON.stringify(serverRelPath))
        .replace('__AUTO_START_SERVER__', JSON.stringify(advanced.autoStartServer))
        .replace('__AUTO_KILL_SERVER__', JSON.stringify(advanced.autoKillServer))
        .replace('__SERVER_STARTUP_DELAY__', JSON.stringify(advanced.serverStartupDelay))
        .replace('__MENU_TEMPLATE__', menuCode);

    await fs.writeFile(path.join(tempDir, 'main.mjs'), mainJs);

    const pkgJson = {
        name: 'desktop',
        version: '1.0.0',
        main: 'main.mjs',
        description: config.appName,
        author: 'flun',
    };
    await fs.writeJson(path.join(tempDir, 'package.json'), pkgJson, { spaces: 2 });

    // ========== 图标处理 ==========
    const resolveIconPath = iconPath => iconPath ? path.resolve(process.cwd(), iconPath) : null;
    const userIcon = resolveIconPath(config.branding?.icon);
    const userInstallerIcon = resolveIconPath(config.branding?.installerIcon);
    const userUninstallerIcon = resolveIconPath(config.branding?.uninstallerIcon);

    let appIconSrc = (userIcon && await fs.pathExists(userIcon)) ? userIcon : DEFAULT_ICON;
    await fs.copy(appIconSrc, path.join(tempDir, 'icon.png'));

    if (appIconSrc === userIcon) {
        try {
            const buffer = await fs.readFile(userIcon);
            const dimensions = sizeOf(buffer);
            if (dimensions) {
                const { width, height } = dimensions;
                if (width < 256 && height < 256)
                    console.warn(chalk.yellow(`[警告] 应用图标尺寸 ${width}x${height} 小于 256x256,可能显示模糊;`));
            }
        } catch (err) {
            console.warn(chalk.yellow('[警告] 无法读取应用图标尺寸: ' + err.message));
        }
    }
    else console.log(chalk.yellow('[警告] 未找到自定义应用图标,将使用默认应用图标;'));


    let installerIconDefined = false;
    let installerSrc = null;
    if (userInstallerIcon && await fs.pathExists(userInstallerIcon)) {
        installerSrc = userInstallerIcon;
        installerIconDefined = true;
    } else if (await fs.pathExists(DEFAULT_INSTALLER_ICON)) {
        installerSrc = DEFAULT_INSTALLER_ICON;
        installerIconDefined = true;
        console.log(chalk.yellow('[警告] 未找到自定义安装图标,将使用默认图标;'));
    }
    if (installerIconDefined && installerSrc) {
        await fs.copy(installerSrc, path.join(tempDir, 'installer-icon.ico'));
    }

    let uninstallerIconDefined = false;
    let uninstallerSrc = null;
    if (userUninstallerIcon && await fs.pathExists(userUninstallerIcon)) {
        uninstallerSrc = userUninstallerIcon;
        uninstallerIconDefined = true;
    } else if (await fs.pathExists(DEFAULT_UNINSTALLER_ICON)) {
        uninstallerSrc = DEFAULT_UNINSTALLER_ICON;
        uninstallerIconDefined = true;
        console.log(chalk.yellow('[警告] 未找到自定义卸载程序图标,将使用默认图标;'));
    }
    if (uninstallerIconDefined && uninstallerSrc) {
        await fs.copy(uninstallerSrc, path.join(tempDir, 'uninstaller-icon.ico'));
    }

    // Electron 版本
    let electronVersion;
    try {
        const electronPkgPath = require.resolve('electron/package.json');
        const electronPkg = await fs.readJson(electronPkgPath);
        electronVersion = electronPkg.version;
        console.log(chalk.blue('[信息] Electron 版本: ' + electronVersion));
    } catch (err) {
        console.error(chalk.red('[错误] 未找到 electron 包,请先安装;'));
        process.exit(1);
    }

    const platformMap = { win32: 'win', darwin: 'mac', linux: 'linux' };
    const currentPlatform = platformMap[process.platform] || 'win';
    console.log(chalk.blue('[信息] 检测到平台: ' + currentPlatform));

    const buildConfig = config.build || {};

    const platformConfig = {
        win: currentPlatform === 'win' ? { target: ['nsis'] } : null,
        mac: currentPlatform === 'mac' ? { target: ['dmg'] } : null,
        linux: currentPlatform === 'linux' ? { target: ['AppImage'] } : null,
    };

    const nsisConfig = {
        oneClick: buildConfig.nsis?.oneClick ?? false,
        perMachine: buildConfig.nsis?.perMachine ?? true,
        allowToChangeInstallationDirectory: buildConfig.nsis?.allowToChangeInstallationDirectory ?? true,
        createDesktopShortcut: buildConfig.nsis?.createDesktopShortcut ?? true,
        createStartMenuShortcut: buildConfig.nsis?.createStartMenuShortcut ?? true,
        shortcutName: buildConfig.nsis?.shortcutName || config.appName,
        deleteAppDataOnUninstall: buildConfig.nsis?.deleteAppDataOnUninstall ?? false,
    };

    if (installerIconDefined) nsisConfig.installerIcon = 'installer-icon.ico';
    if (uninstallerIconDefined) nsisConfig.uninstallerIcon = 'uninstaller-icon.ico';

    const configObj = {
        appId: buildConfig.appId || 'com.example.app',
        productName: config.appName,
        directories: { output: buildConfig.outputDir || './dist' },
        extraResources: [
            {
                from: path.join(tempDir, 'node_modules'),
                to: 'app/node_modules',
                filter: ['**/*']
            }
        ],
        asar: false,
        win: platformConfig.win,
        mac: platformConfig.mac,
        linux: platformConfig.linux,
        electronVersion: electronVersion,
        npmRebuild: false,
        nsis: nsisConfig,
        dmg: {
            iconSize: buildConfig.dmg?.iconSize || 128,
            window: {
                width: buildConfig.dmg?.window?.width || 540,
                height: buildConfig.dmg?.window?.height || 380,
            },
        },
    };

    Object.keys(configObj).forEach(key => {
        if (configObj[key] === null) delete configObj[key];
    });

    const configFile = path.join(tempDir, 'builder.json');
    await fs.writeJson(configFile, configObj, { spaces: 2 });

    const platformArgMap = { win: '--win', mac: '--mac', linux: '--linux' };
    const platformArg = platformArgMap[currentPlatform];

    const args = [
        'electron-builder',
        '--project', tempDir,
        '--config', configFile,
        platformArg,
    ];

    console.log(chalk.blue('[信息] 正在执行构建: npx ' + args.join(' ')));

    let retries = 3, lastError = null, success = false;
    while (retries > 0) {
        try {
            await execa('npx', args, {
                cwd: tempDir,
                stdio: 'inherit',
                env: {
                    ...process.env,
                    ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/',
                    NSIS_MIRROR: 'https://npmmirror.com/mirrors/nsis/',
                    ELECTRON_BUILDER_BINARIES_MIRROR: 'https://mirrors.huaweicloud.com/electron-builder-binaries/',
                    ELECTRON_BUILDER_CACHE: CACHE_DIR,
                    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
                },
            });
            success = true;
            break;
        } catch (error) {
            lastError = error;
            retries--;
            if (retries > 0) {
                console.warn(chalk.yellow(`[警告] 构建失败,正在重试...（剩余 ${retries} 次尝试）`));
                console.warn(chalk.yellow('      错误信息: ' + error.message));
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    if (!success) {
        console.error(chalk.red('[错误] 构建失败,已尝试 3 次:'), lastError);
        process.exit(1);
    }

    const tempDistDir = path.join(tempDir, 'dist');
    const userOutputDir = buildConfig.outputDir || './dist';
    const targetDir = path.resolve(process.cwd(), userOutputDir);

    if (await fs.pathExists(tempDistDir)) {
        await fs.ensureDir(targetDir);
        const files = await fs.readdir(tempDistDir);
        let copiedCount = 0;
        for (const file of files) {
            const isInstaller = file.endsWith('.exe') || file.endsWith('.dmg') || file.endsWith('.AppImage');
            if (isInstaller) {
                const src = path.join(tempDistDir, file);
                const dest = path.join(targetDir, file);
                await fs.copy(src, dest);
                copiedCount++;
            }
        }
        if (copiedCount > 0) {
            console.log(chalk.green('[成功] 构建完成！安装包位于: ' + targetDir));
        } else {
            console.warn(chalk.yellow('[警告] 未找到安装包文件;'));
        }
    } else {
        console.warn(chalk.yellow('[警告] 未找到 dist 目录;'));
    }
}