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

process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
process.env.NSIS_MIRROR = 'https://npmmirror.com/mirrors/nsis/';
const CACHE_DIR = path.join(process.cwd(), '.electron-cache');
process.env.ELECTRON_BUILDER_CACHE = CACHE_DIR;

export default async function buildApp() {
    const configPath = path.join(process.cwd(), 'desktopAppConfig.js');
    if (!(await fs.pathExists(configPath))) {
        console.error(chalk.red('[ERROR] desktopAppConfig.js not found.'));
        console.error(chalk.yellow('[HINT] Please run "npx desktop-builder init" to create it.'));
        process.exit(1);
    }

    const configModule = await import(`file://${configPath}?t=${Date.now()}`);
    const config = configModule.default;

    if (!config.serverPath || !config.appUrl || !config.appName) {
        console.error(chalk.red('[ERROR] Missing required fields: serverPath, appUrl, appName'));
        process.exit(1);
    }

    const tempDir = path.join(os.tmpdir(), 'desktop-builder-build', path.basename(process.cwd()) + '-' + Date.now());
    await fs.ensureDir(tempDir);
    await fs.emptyDir(tempDir);

    // 复制项目文件
    const projectRoot = path.resolve(process.cwd());
    console.log(chalk.blue('[INFO] Copying project files from ' + projectRoot + ' to ' + tempDir));

    await fs.copy(projectRoot, tempDir, {
        filter: (src) => {
            const relative = path.relative(projectRoot, src);
            if (relative.startsWith('.desktop-builder')) return false;
            const exclude = ['dist', '.git', '.vscode', '.idea', '*.log', '*.lock', 'package-lock.json', 'yarn.lock'];
            for (const pattern of exclude) {
                if (relative.startsWith(pattern) || relative === pattern) return false;
            }
            return true;
        }
    });

    // 生成主进程
    const mainTemplatePath = path.join(__dirname, '..', 'electron-main.js');
    const mainTemplate = await fs.readFile(mainTemplatePath, 'utf-8');

    const iconAbsPath = config.branding?.icon
        ? path.resolve(process.cwd(), config.branding.icon)
        : null;

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
        .replace('__SERVER_STARTUP_DELAY__', JSON.stringify(advanced.serverStartupDelay));

    await fs.writeFile(path.join(tempDir, 'main.js'), mainJs);

    // package.json
    const pkgJson = {
        name: 'desktop',
        version: '1.0.0',
        main: 'main.js',
        type: 'module',
        description: config.appName,
        author: 'flun',
    };
    await fs.writeJson(path.join(tempDir, 'package.json'), pkgJson, { spaces: 2 });

    // 图标
    let iconValid = false;
    if (iconAbsPath && (await fs.pathExists(iconAbsPath))) {
        try {
            const dimensions = sizeOf(iconAbsPath);
            const { width, height } = dimensions;
            if (width >= 256 && height >= 256) {
                iconValid = true;
                await fs.copy(iconAbsPath, path.join(tempDir, 'icon.png'));
                console.log(chalk.green('[OK] Icon OK (' + width + 'x' + height + ')'));
            } else {
                console.warn(chalk.yellow('[WARN] Icon size ' + width + 'x' + height + ' < 256x256, using default.'));
            }
        } catch (err) {
            console.warn(chalk.yellow('[WARN] Cannot read icon: ' + err.message + ', using default.'));
        }
    } else {
        console.warn(chalk.yellow('[WARN] Icon not found, using default.'));
    }

    // Electron 版本
    let electronVersion;
    try {
        const electronPkgPath = require.resolve('electron/package.json');
        const electronPkg = await fs.readJson(electronPkgPath);
        electronVersion = electronPkg.version;
        console.log(chalk.blue('[INFO] Electron version: ' + electronVersion));
    } catch (err) {
        console.error(chalk.red('[ERROR] Cannot find electron package. Please install it: npm install electron'));
        process.exit(1);
    }

    // 平台
    const platformMap = { win32: 'win', darwin: 'mac', linux: 'linux' };
    const currentPlatform = platformMap[process.platform] || 'win';
    console.log(chalk.blue('[INFO] Detected platform: ' + currentPlatform));

    const buildConfig = config.build || {};
    const platformConfig = {
        win: currentPlatform === 'win' ? { target: ['nsis'] } : null,
        mac: currentPlatform === 'mac' ? { target: ['dmg'] } : null,
        linux: currentPlatform === 'linux' ? { target: ['AppImage'] } : null,
    };

    // ================================================================
    // 最终方案：使用 extraResources 强制包含 node_modules
    // ================================================================
    const configObj = {
        appId: buildConfig.appId || 'com.example.app',
        productName: config.appName,
        directories: {
            output: buildConfig.outputDir || './dist',
        },
        // 不设置 files，让 electron-builder 使用默认（只包含必要文件）
        // 但我们要额外添加资源
        extraResources: [
            {
                from: path.join(tempDir, 'node_modules'),
                to: 'node_modules',
                filter: ['**/*']
            }
        ],
        asar: false,
        win: platformConfig.win,
        mac: platformConfig.mac,
        linux: platformConfig.linux,
        electronVersion: electronVersion,
        npmRebuild: false,
        nsis: {
            oneClick: buildConfig.nsis?.oneClick ?? false,
            perMachine: buildConfig.nsis?.perMachine ?? true,
            allowToChangeInstallationDirectory: buildConfig.nsis?.allowToChangeInstallationDirectory ?? true,
            createDesktopShortcut: buildConfig.nsis?.createDesktopShortcut ?? true,
            createStartMenuShortcut: buildConfig.nsis?.createStartMenuShortcut ?? true,
            shortcutName: buildConfig.nsis?.shortcutName || config.appName,
            deleteAppDataOnUninstall: buildConfig.nsis?.deleteAppDataOnUninstall ?? false,
        },
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

    console.log(chalk.green('[OK] Build files generated.'));

    // 构建
    const platformArgMap = { win: '--win', mac: '--mac', linux: '--linux' };
    const platformArg = platformArgMap[currentPlatform];

    const args = [
        'electron-builder',
        '--project', tempDir,
        '--config', configFile,
        platformArg,
    ];

    console.log(chalk.blue('[INFO] Building with: npx ' + args.join(' ')));

    let retries = 3;
    let lastError = null;
    let success = false;

    while (retries > 0) {
        try {
            await execa('npx', args, {
                cwd: process.cwd(),
                stdio: 'inherit',
                env: {
                    ...process.env,
                    ELECTRON_MIRROR: process.env.ELECTRON_MIRROR,
                    NSIS_MIRROR: process.env.NSIS_MIRROR,
                    ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE,
                    NODE_PATH: path.join(process.cwd(), 'node_modules'),
                },
            });
            success = true;
            break;
        } catch (error) {
            lastError = error;
            retries--;
            if (retries > 0) {
                console.warn(chalk.yellow('[WARN] Build failed, retrying... (' + retries + ' attempts left)'));
                console.warn(chalk.yellow('      Error: ' + error.message));
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    if (!success) {
        console.error(chalk.red('[ERROR] Build failed after 3 attempts:'), lastError);
        process.exit(1);
    }

    // 复制产物
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
                console.log(chalk.green('[OK] Copied ' + file + ' to ' + dest));
                copiedCount++;
            }
        }
        if (copiedCount > 0) {
            console.log(chalk.green('[OK] Build complete! Installers are in: ' + targetDir));
        } else {
            console.warn(chalk.yellow('[WARN] No installer found in temp build directory.'));
        }
    } else {
        console.warn(chalk.yellow('[WARN] No dist folder found in temp build directory.'));
    }
}