import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import chalk from 'chalk';
import { execa } from 'execa';
import { minimatch } from 'minimatch';

const __dirname = path.dirname(fileURLToPath(import.meta.url)),
    require = createRequire(import.meta.url),
    CACHE_DIR = path.join(os.homedir(), '.electron-builder-cache'),
    DEFAULT_ICON = path.join(__dirname, 'app.png'),
    DEFAULT_INSTALLER_ICON = path.join(__dirname, 'setup.ico'),
    DEFAULT_UNINSTALLER_ICON = path.join(__dirname, 'un.ico'),
    build = async () => {
        const configPath = path.join(process.cwd(), 'desktopAppConfig.js');
        if (!(await fs.pathExists(configPath))) {
            console.error(chalk.red('[错误] 未找到 desktopAppConfig.js 配置文件;'));
            process.exit(1);
        }

        const configModule = await import(`file://${configPath}?t=${Date.now()}`),
            config = configModule.default;
        if (!config.serverPath || !config.appUrl || !config.appName) {
            console.error(chalk.red('[错误] 配置文件缺少必填字段: serverPath, appUrl, appName'));
            process.exit(1);
        }

        const excludeFiles = config.excludeFiles || [],
            excludeDependencies = config.excludeDependencies || [],
            excludeOutputs = config.excludeOutputs || [],
            enableLogging = config.enableLogging ?? false;

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
                        if (relative === dirName || relative.startsWith(dirName + path.sep)) return false;
                        continue;
                    }

                    if (pattern.startsWith('./')) {
                        const strippedPattern = pattern.slice(2);
                        if (isRootFile && minimatch(relative, strippedPattern, { dot: true, matchBase: false })) return false;
                        continue;
                    }

                    if (relative === pattern) return false;
                    if (minimatch(relative, pattern, { dot: true, matchBase: true })) return false;
                }
                return true;
            },
            dereference: true,
        });

        // 生成 main.mjs
        const mainTemplatePath = path.join(__dirname, '..', 'electron-main.js'),
            mainTemplate = await fs.readFile(mainTemplatePath, 'utf-8');

        let menuCode = 'null';
        if (config.menu && Array.isArray(config.menu) && config.menu.length > 0) {
            menuCode = JSON.stringify(config.menu, (key, value) => {
                if (typeof value === 'function') return value.toString();
                return value;
            });
        } else {
            console.log(chalk.yellow('[警告] 未配置菜单，将使用默认英文菜单;'));
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
            webPreferences: { nodeIntegration: false, contextIsolation: true },
            ...(config.window || {}),
        };

        const advanced = {
            autoStartServer: true,
            autoKillServer: true,
            ...(config.advanced || {}),
        };

        const serverRelPath = path.basename(config.serverPath),
            mainJs = mainTemplate
                .replace('__APP_URL__', JSON.stringify(config.appUrl))
                .replace('__WINDOW_CONFIG__', JSON.stringify(windowConfig))
                .replace('__SERVER_PATH__', JSON.stringify(serverRelPath))
                .replace('__AUTO_START_SERVER__', JSON.stringify(advanced.autoStartServer))
                .replace('__AUTO_KILL_SERVER__', JSON.stringify(advanced.autoKillServer))
                .replace('__MENU_TEMPLATE__', menuCode)
                .replace('__LOGGING_ENABLED__', JSON.stringify(enableLogging));

        await fs.writeFile(path.join(tempDir, 'main.mjs'), mainJs);

        // 处理 package.json
        const origPkgPath = path.join(projectRoot, 'package.json');
        let allDeps = {},
            pkgJson = {};

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
        console.log(chalk.blue('[信息] 成功写入 ' + Object.keys(allDeps).length + ' 个依赖包到 deps.json'));

        // 图标处理
        const handleIcon = async (userPath, defaultPath, img, label) => {
            const resolved = userPath ? path.resolve(process.cwd(), userPath) : null;
            let src = (resolved && (await fs.pathExists(resolved))) ? resolved : defaultPath;
            await fs.copy(src, path.join(tempDir, img));
            if (src !== resolved) console.log(chalk.yellow(`[警告] 未找到自定义${label}图标，将使用默认图标;`));
            return src;
        };

        await handleIcon(config.branding?.appIcon, DEFAULT_ICON, 'app.png', '应用');
        await handleIcon(config.branding?.installerIcon, DEFAULT_INSTALLER_ICON, 'installer.ico', '安装');
        await handleIcon(config.branding?.uninstallerIcon, DEFAULT_UNINSTALLER_ICON, 'uninstaller.ico', '卸载');

        // Electron 版本
        let electronVersion;
        try {
            const electronPkgPath = require.resolve('electron/package.json'),
                electronPkg = await fs.readJson(electronPkgPath);
            electronVersion = electronPkg.version;
            console.log(chalk.blue('[信息] Electron 版本: ' + electronVersion));
        } catch (err) {
            console.error(chalk.red('[错误] 未找到 electron 包，请先安装;'));
            process.exit(1);
        }

        // 平台映射
        const platformInfo = {
            win32: { platform: 'win', arg: '--win' },
            darwin: { platform: 'mac', arg: '--mac' },
            linux: { platform: 'linux', arg: '--linux' },
        };
        const info = platformInfo[process.platform] || platformInfo.win32;
        const currentPlatform = info.platform;
        const platformArg = info.arg;
        const buildConfig = config.build || {};

        // ----- 构建 electron-builder 配置对象 -----
        // 基础默认配置
        const defaultNsis = {
            oneClick: false,
            perMachine: true,
            allowToChangeInstallationDirectory: true,
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            shortcutName: config.appName,
            deleteAppDataOnUninstall: false,
            installerIcon: 'installer.ico',
            uninstallerIcon: 'uninstaller.ico',
        };

        const defaultDmg = {
            iconSize: 128,
            window: {
                width: 540,
                height: 380,
            },
        };

        // 基础 configObj
        const configObj = {
            files: [
                '!builder.json',
                '!app.png',
                '!installer.ico',
                '!uninstaller.ico',
            ],
            appId: buildConfig.appId || 'com.example.app',
            productName: config.appName,
            directories: { output: buildConfig.outputDir || './dist' },
            asar: false,
            electronVersion: electronVersion,
            npmRebuild: false,
            nsis: { ...defaultNsis, ...(buildConfig.nsis || {}) },
            dmg: { ...defaultDmg, ...(buildConfig.dmg || {}) },
            icon: 'app.png',
        };

        // 合并用户顶层 build 字段（如 mac, linux, win, extraResources 等）
        // 但要注意不覆盖我们已经合并的 dmg 和 nsis
        const userBuild = { ...buildConfig };
        delete userBuild.nsis;
        delete userBuild.dmg;
        delete userBuild.outputDir;
        delete userBuild.appId; // 已合并
        // 合并剩余字段（包括 mac, linux, win 等）
        Object.assign(configObj, userBuild);

        // 平台特定配置：根据当前平台补充默认 target（如果用户未提供该平台配置）
        const platformKey = currentPlatform; // 'win', 'mac', 'linux'
        if (!configObj[platformKey]) {
            // 用户没有提供该平台配置，使用默认 target
            const targetMap = {
                win: ['nsis'],
                mac: ['dmg'],
                linux: ['AppImage'],
            };
            configObj[platformKey] = { target: targetMap[platformKey] };
        } else {
            // 用户提供了平台配置，但可能缺少 target，补充默认值
            const defaultTargets = {
                win: ['nsis'],
                mac: ['dmg'],
                linux: ['AppImage'],
            };
            if (!configObj[platformKey].target) {
                configObj[platformKey].target = defaultTargets[platformKey];
            }
        }

        // 对于 mac，如果用户未提供 mac 配置但需要额外 dmg 合并，已经做了
        // 对于 linux 同理

        const configFile = path.join(tempDir, 'builder.json');
        await fs.writeJson(configFile, configObj, { spaces: 2 });

        const args = [
            '--no-install',
            'electron-builder',
            '--project',
            tempDir,
            '--config',
            configFile,
            platformArg,
        ];

        console.log(chalk.blue('[信息] 正在执行构建: npx ' + args.join(' ')));
        let retries = 3,
            lastError = null,
            success = false;
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
                    console.warn(chalk.yellow(`[警告] 构建失败，正在重试...（剩余 ${retries} 次尝试）`));
                    console.warn(chalk.yellow('      错误信息: ' + error.message));
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        }

        if (!success) {
            console.error(chalk.red('[错误] 构建失败，已尝试 3 次:'), lastError);
            process.exit(1);
        }

        // 复制最终安装包，应用 excludeOutputs
        const tempDistDir = path.join(tempDir, 'dist'),
            userOutputDir = buildConfig.outputDir || './dist',
            targetDir = path.resolve(process.cwd(), userOutputDir);

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

                const isInstaller = file.endsWith('.exe') || file.endsWith('.dmg') || file.endsWith('.AppImage') || file.endsWith('.deb') || file.endsWith('.rpm') || file.endsWith('.pkg') || file.endsWith('.zip');
                if (isInstaller) {
                    const src = path.join(tempDistDir, file),
                        dest = path.join(targetDir, file);
                    await fs.copy(src, dest);
                    copiedCount++;
                }
            }
            if (copiedCount > 0) console.log(chalk.green('[成功] 构建完成！安装包位于: ' + targetDir));
            else console.warn(chalk.yellow('[警告] 未找到安装包文件;'));
        } else {
            console.warn(chalk.yellow('[警告] 未找到 dist 目录;'));
        }
    };

export { build };