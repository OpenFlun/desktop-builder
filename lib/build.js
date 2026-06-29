import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import chalk from 'chalk';
import { execa } from 'execa';
import sizeOf from 'image-size';
import { minimatch } from 'minimatch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const CACHE_DIR = path.join(os.homedir(), '.electron-builder-cache');
const DEFAULT_ICON = path.join(__dirname, 'app.png');
const DEFAULT_INSTALLER_ICON = path.join(__dirname, 'setup.ico');
const DEFAULT_UNINSTALLER_ICON = path.join(__dirname, 'un.ico');

const buildApp = async () => {
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

    const excludeFiles = config.excludeFiles || [];
    const excludeDependencies = config.excludeDependencies || [];
    const excludeOutputs = config.excludeOutputs || [];

    await fs.ensureDir(CACHE_DIR);
    process.env.ELECTRON_BUILDER_CACHE = CACHE_DIR;
    process.env.ELECTRON_CACHE = CACHE_DIR;

    const tempDir = path.join(os.tmpdir(), 'desktop-builder-build', path.basename(process.cwd()) + '-' + Date.now());
    await fs.ensureDir(tempDir);
    await fs.emptyDir(tempDir);

    const projectRoot = path.resolve(process.cwd());
    console.log(chalk.blue('[信息] 正在复制项目文件从 ' + projectRoot + ' 到 ' + tempDir));

    // 复制文件，应用 excludeFiles
    await fs.copy(projectRoot, tempDir, {
        filter: (src) => {
            const relative = path.relative(projectRoot, src);
            if (relative === '') return true;

            const isRootFile = !relative.includes(path.sep);
            for (const pattern of excludeFiles) {
                if (pattern.endsWith('/')) {
                    const dirName = pattern.slice(0, -1);
                    if (relative === dirName || relative.startsWith(dirName + path.sep)) {
                        return false;
                    }
                    continue;
                }

                if (pattern.startsWith('./')) {
                    const strippedPattern = pattern.slice(2);
                    if (isRootFile && minimatch(relative, strippedPattern, { dot: true, matchBase: false })) {
                        return false;
                    }
                    continue;
                }

                if (relative === pattern) {
                    return false;
                }

                if (minimatch(relative, pattern, { dot: true, matchBase: true })) {
                    return false;
                }
            }
            return true;
        },
        dereference: true,
    });

    // 生成 main.mjs
    const mainTemplatePath = path.join(__dirname, '..', 'electron-main.js');
    const mainTemplate = await fs.readFile(mainTemplatePath, 'utf-8');

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
    // 处理 package.json
    const origPkgPath = path.join(projectRoot, 'package.json');
    let allDeps = {}, pkgJson = {};

    if (await fs.pathExists(origPkgPath)) {
        const origPkg = await fs.readJson(origPkgPath);
        allDeps = { ...origPkg.dependencies, ...origPkg.devDependencies };
        for (const ex of excludeDependencies) delete allDeps[ex];

        console.log(chalk.blue('[信息] 排除后依赖包数量: ' + Object.keys(allDeps).length));
        pkgJson = { ...origPkg };
        delete pkgJson.dependencies;
        delete pkgJson.devDependencies;
        pkgJson.main = 'main.mjs';
        pkgJson.description = config.appName;
    } else {
        console.warn(chalk.yellow('[错误] 请配置 package.json 文件'));
        process.exit(1);
    }

    await fs.writeJson(path.join(tempDir, 'package.json'), pkgJson, { spaces: 2 });
    await fs.writeJson(path.join(tempDir, 'deps.json'), allDeps, { spaces: 2 });
    console.log(chalk.blue('[信息] 已写入 deps.json，包含 ' + Object.keys(allDeps).length + ' 个依赖'));

    // 图标处理
    const handleIcon = async (userPath, defaultPath, img, label) => {
        const resolved = userPath ? path.resolve(process.cwd(), userPath) : null;
        let src = (resolved && await fs.pathExists(resolved)) ? resolved : defaultPath;
        await fs.copy(src, path.join(tempDir, img));
        if (src !== resolved) {
            console.log(chalk.yellow(`[警告] 未找到自定义${label}图标,将使用默认图标;`));
        }
        return src;
    }

    // 处理应用,安装,卸载图标
    await handleIcon(config.branding?.appIcon, DEFAULT_ICON, 'app.png', '应用');
    await handleIcon(config.branding?.installerIcon, DEFAULT_INSTALLER_ICON, 'installer.ico', '安装');
    await handleIcon(config.branding?.uninstallerIcon, DEFAULT_UNINSTALLER_ICON, 'uninstaller.ico', '卸载');

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

    // 平台映射合并
    const platformInfo = {
        win32: { platform: 'win', arg: '--win' },
        darwin: { platform: 'mac', arg: '--mac' },
        linux: { platform: 'linux', arg: '--linux' },
    };
    const info = platformInfo[process.platform] || platformInfo.win32;
    const currentPlatform = info.platform;
    const platformArg = info.arg;

    console.log(chalk.blue('[信息] 检测到系统: ' + currentPlatform));

    const buildConfig = config.build || {};

    const platformConfig = {
        win: currentPlatform === 'win' ? { target: ['nsis'] } : null,
        mac: currentPlatform === 'mac' ? { target: ['dmg'] } : null,
        linux: currentPlatform === 'linux' ? { target: ['AppImage'] } : null,
    };

    // NSIS 配置
    const nsisConfig = {
        oneClick: buildConfig.nsis?.oneClick ?? false,
        perMachine: buildConfig.nsis?.perMachine ?? true,
        allowToChangeInstallationDirectory: buildConfig.nsis?.allowToChangeInstallationDirectory ?? true,
        createDesktopShortcut: buildConfig.nsis?.createDesktopShortcut ?? true,
        createStartMenuShortcut: buildConfig.nsis?.createStartMenuShortcut ?? true,
        shortcutName: buildConfig.nsis?.shortcutName || config.appName,
        deleteAppDataOnUninstall: buildConfig.nsis?.deleteAppDataOnUninstall ?? false,
        installerIcon: 'installer.ico',
        uninstallerIcon: 'uninstaller.ico',
    };

    const configObj = {
        appId: buildConfig.appId || 'com.example.app',
        productName: config.appName,
        directories: { output: buildConfig.outputDir || './dist' },
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
        icon: 'app.png',
    };

    Object.keys(configObj).forEach(key => {
        if (configObj[key] === null) delete configObj[key];
    });

    const configFile = path.join(tempDir, 'builder.json');
    await fs.writeJson(configFile, configObj, { spaces: 2 });

    const args = [
        '--no-install',
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
                cwd: process.cwd(),
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

    // 复制最终安装包，应用 excludeOutputs
    const tempDistDir = path.join(tempDir, 'dist');
    const userOutputDir = buildConfig.outputDir || './dist';
    const targetDir = path.resolve(process.cwd(), userOutputDir);

    if (await fs.pathExists(tempDistDir)) {
        await fs.ensureDir(targetDir);
        const files = await fs.readdir(tempDistDir);
        let copiedCount = 0;
        for (const file of files) {
            let shouldExclude = false;
            for (const pattern of excludeOutputs) {
                if (minimatch(file, pattern, { dot: true })) {
                    shouldExclude = true;
                    console.log(chalk.yellow(`[信息] 排除输出文件: ${file}`));
                    break;
                }
            }
            if (shouldExclude) continue;

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
export { buildApp }