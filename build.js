import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import chalk from 'chalk';
import { execa } from 'execa';
import { minimatch } from 'minimatch';

const __dirname = path.dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url),
    CACHE_DIR = path.join(os.homedir(), '.electron-builder-cache'),
    DEFAULT_TARGETS = { win: ['nsis'], mac: ['dmg'], linux: ['AppImage'] };

/**
 * 构建桌面应用程序
 * >查看定义:@see {@link build}
 */
const build = async () => {
    const configPath = path.join(process.cwd(), 'desktopAppConfig.js');
    if (!(await fs.pathExists(configPath)))
        console.error(chalk.red('[错误] 未找到 desktopAppConfig.js 配置文件;')), process.exit(1);
    const configModule = await import(`file://${configPath}?t=${Date.now()}`), config = configModule.default;
    if (!config.serverPath || !config.appUrl || !config.appName)
        console.error(chalk.red('[错误] 配置文件缺少必填字段: serverPath, appUrl, appName')), process.exit(1);

    const excludeFiles = config.excludeFiles || [], excludeDependencies = config.excludeDependencies || [],
        excludeOutputs = config.excludeOutputs || [], enableLogging = config.enableLogging ?? false;
    // 预处理 allowScripts
    let configAllowScripts;
    if (config.allowScripts !== undefined && config.allowScripts !== null) {
        if (typeof config.allowScripts === 'object' && !Array.isArray(config.allowScripts))
            configAllowScripts = config.allowScripts;
        else {
            console.warn(chalk.yellow('[警告] allowScripts 配置类型错误(应为对象),将使用默认值 { node: true }'));
            configAllowScripts = null;
        }
    }
    else console.log(chalk.gray('[配置] allowScripts 未配置,将使用默认值 { node: true }')), configAllowScripts = null;

    await fs.ensureDir(CACHE_DIR);
    process.env.ELECTRON_BUILDER_CACHE = CACHE_DIR, process.env.ELECTRON_CACHE = CACHE_DIR;

    const tempDir = path.join(os.tmpdir(), 'desktop-builder-build', path.basename(process.cwd()) + '-' + Date.now());
    await fs.ensureDir(tempDir), await fs.emptyDir(tempDir);

    const projectRoot = path.resolve(process.cwd());
    console.log(chalk.blue('[信息] 正在复制项目文件从 ' + projectRoot + ' 到 ' + tempDir));
    await fs.copy(projectRoot, tempDir, {
        filter: src => {
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
                    if (isRootFile && minimatch(relative, strippedPattern, { dot: true, matchBase: false }))
                        return false;
                    continue;
                }

                if (relative === pattern) return false;
                if (minimatch(relative, pattern, { dot: true, matchBase: true })) return false;
            }
            return true;
        },
        dereference: true,
    });

    const mainFilePath = path.join(__dirname, 'electron-main.js'), mainTem = await fs.readFile(mainFilePath, 'utf-8');
    let menuCode = 'null';
    if (config.menu && Array.isArray(config.menu) && config.menu.length > 0) {
        menuCode = JSON.stringify(config.menu, (key, value) => {
            if (typeof value === 'function') return value.toString();
            return value;
        });
    }
    else console.log(chalk.yellow('[警告] 未配置菜单,将使用默认英文菜单;'));

    const windowConfig = {
        width: 1200, height: 800, minWidth: 800, minHeight: 600,
        resizable: true, fullscreenable: true, frame: true,
        alwaysOnTop: false, show: false,
        backgroundColor: '#ffffff',
        webPreferences: { nodeIntegration: false, contextIsolation: true },
        ...(config.window || {}),
    },
        advanced = { autoStartServer: true, autoKillServer: true, ...(config.advanced || {}) },
        serverRelPath = path.basename(config.serverPath),
        mainJs = mainTem
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
    if (!(await fs.pathExists(origPkgPath)))
        console.warn(chalk.yellow('[错误] 请配置 package.json 文件')), process.exit(1);

    const origPkg = await fs.readJson(origPkgPath), pkgJson = { ...origPkg };
    // 排除依赖
    if (pkgJson.dependencies) {
        for (const ex of excludeDependencies) delete pkgJson.dependencies[ex];
    }
    else pkgJson.dependencies = {};
    delete pkgJson.devDependencies, pkgJson.main = 'main.mjs', pkgJson.description = config.appName;

    // 写入临时目录
    await fs.writeJson(path.join(tempDir, 'package.json'), pkgJson, { spaces: 2 });
    const depCount = Object.keys(pkgJson.dependencies || {}).length;
    console.log(chalk.blue('[信息] 生产依赖包数量（已排除用户指定的包）: ' + depCount));

    // 安装依赖
    console.log(chalk.blue('[信息] 正在安装依赖...'));
    const installArgs = ['install', '--production', '--no-audit', '--no-fund', '--no-package-lock'];
    try {
        await execa('npm', installArgs, {
            cwd: tempDir, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' }
        });
        console.log(chalk.green('[成功] 依赖安装完成'));
    } catch (err) {
        console.error(chalk.red('[错误] 依赖安装失败:'), err.message), process.exit(1);
    }

    // 替换根 package.json 的 allowScripts
    const rootPkgPath = path.join(tempDir, 'package.json');
    if (await fs.pathExists(rootPkgPath)) {
        try {
            const rootPkg = await fs.readJson(rootPkgPath), finalAllowScripts = configAllowScripts || { node: true };
            rootPkg.allowScripts = finalAllowScripts, await fs.writeJson(rootPkgPath, rootPkg, { spaces: 2 });
            console.log(chalk.gray('[配置] allowScripts字段 替换成功'));
        } catch (err) {
            console.warn(chalk.yellow('[警告] 更新根 package.json 失败: ' + err.message));
        }
    }

    // 获取 electron 版本
    let electronVersion;
    try {
        const ePkgPath = require.resolve('electron/package.json'), ePkg = await fs.readJson(ePkgPath);
        electronVersion = ePkg.version, console.log(chalk.blue('[信息] Electron 版本: ' + electronVersion));
    } catch (err) {
        console.error(chalk.red('[错误] 未找到 electron 包,请先安装;')), process.exit(1);
    }

    //将用户定义的 excludeFiles 转换为打包阶段的排除模式
    const userExcludePatterns = excludeFiles.map(pattern => {
        let p = pattern.replace(/^\.\//, '');  // 去除开头的 './'
        if (p.endsWith('/')) {
            const dir = p.slice(0, -1);
            return `!${dir}/**`;
        }
        return `!${p}`;
    }),
        // 构建配置
        platformInfo = {
            win32: { platform: 'win', arg: '--win' },
            darwin: { platform: 'mac', arg: '--mac' },
            linux: { platform: 'linux', arg: '--linux' }
        },
        info = platformInfo[process.platform] || platformInfo.win32, currentPlatform = info.platform,
        platformArg = info.arg, buildConfig = config.build || {},
        defaultNsis = {
            oneClick: false, deleteAppDataOnUninstall: false,
            perMachine: true, allowToChangeInstallationDirectory: true,
            createDesktopShortcut: true, createStartMenuShortcut: true,
            shortcutName: config.appName
        }, defaultDmg = { iconSize: 80, window: { width: 540, height: 380 } },
        configObj = {
            // 排除源码映射文件、TypeScript 文件、node_modules 文档和许可证、平台绑定目录等
            files: [
                "**/*", '!builder.json', "!**/*.map", "!**/*.ts", "!**/*.cts", "!**/*.mts",
                "!node_modules/**/*.md", "!node_modules/**/*.markdown",
                "!node_modules/**/license*", "!node_modules/**/licence*",
                "!node_modules/**/LICENSE*", "!node_modules/**/LICENCE*", "!node_modules/node/**",
                "!node_modules/node-win*/**", "!node_modules/node-darwin*/**",
                "!node_modules/node-linux*/**", "!node_modules/node-freebsd*/**", "!node_modules/node-sunos*/**",
                "!node_modules/node-aix*/**", ...userExcludePatterns
            ],
            appId: buildConfig.appId || 'com.example.app',
            productName: config.appName,
            directories: { output: buildConfig.outputDir || './dist' },
            asar: false, npmRebuild: false,
            electronVersion: electronVersion,
            nsis: { ...defaultNsis, ...(buildConfig.nsis || {}) },
            dmg: { ...defaultDmg, ...(buildConfig.dmg || {}) }
        }, userBuild = { ...buildConfig }; // 合并用户自定义的 build 配置
    delete userBuild.nsis, delete userBuild.dmg, delete userBuild.outputDir, delete userBuild.appId;
    Object.assign(configObj, userBuild);
    // 设置平台默认目标
    const platformKey = currentPlatform;
    if (!configObj[platformKey]) configObj[platformKey] = { target: DEFAULT_TARGETS[platformKey] };
    else if (!configObj[platformKey].target) configObj[platformKey].target = DEFAULT_TARGETS[platformKey];
    // 卸载处理
    if (!configObj.nsis.deleteAppDataOnUninstall ?? false) {
        const uninstallNshContent = `
            !macro customUninstall
                SetOutPath $TEMP
            !macroend`, nshPath = path.join(tempDir, 'uninstall.nsh');
        await fs.writeFile(nshPath, uninstallNshContent);
        configObj.nsis = { ...configObj.nsis, include: './uninstall.nsh' };
    }
    // 执行 electron-builder
    const configFile = path.join(tempDir, 'builder.json'),
        args = ['--no-install', 'electron-builder', '--project', tempDir, '--config', configFile, platformArg];
    await fs.writeJson(configFile, configObj, { spaces: 2 });
    console.log(chalk.blue('[信息] 正在执行构建: npx ' + args.join(' ')));

    let retries = 2, lastError = null, success = false;
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
            lastError = error, retries--;
            if (retries > 0) {
                console.warn(chalk.yellow(`[警告] 构建失败,正在重试...（剩余 ${retries} 次尝试）`));
                console.warn(chalk.yellow('      错误信息: ' + error.message));
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    if (!success) console.error(chalk.red('[错误] 构建失败,已尝试 2 次:'), lastError), process.exit(1);

    // 复制安装包到输出目录
    const outputDir = configObj.directories.output, tDir = path.join(tempDir, outputDir),
        targetDir = path.resolve(process.cwd(), outputDir);
    if (await fs.pathExists(tDir)) {
        await fs.ensureDir(targetDir);
        const files = await fs.readdir(tDir);
        let copiedCount = 0;
        for (const file of files) {
            let shouldExclude = false;
            for (const pattern of excludeOutputs) {
                if (minimatch(file, pattern, { dot: true })) {
                    shouldExclude = true, console.log(chalk.yellow(`[信息] 排除输出文件: ${file}`));
                    break;
                }
            }
            if (shouldExclude) continue;
            const INSTALLER_EXTENSIONS = ['.exe', '.msi', '.dmg', '.AppImage', '.deb', '.rpm', '.pkg', '.zip'];
            if (INSTALLER_EXTENSIONS.some(ext => file.endsWith(ext))) {
                const src = path.join(tDir, file), dest = path.join(targetDir, file);
                await fs.copy(src, dest), copiedCount++;
            }
        }
        if (copiedCount > 0) console.log(chalk.green('[成功] 构建完成！安装包位于: ' + targetDir));
        else console.warn(chalk.yellow('[警告] 未找到安装包文件;'));
    }
    else console.warn(chalk.yellow('[警告] 未找到 dist 目录;'));
};

/**
 * 运行命令行接口
 * >查看定义:@see {@link runCLI}
 */
const runCLI = async () => {
    const args = process.argv.slice(2), command = args[0];
    if (!command || command === 'help' || command === '--help' || command === '-h') {
        console.log(`用法:先配置 desktopAppConfig.js 文件,然后运行-> desktop-builder build  指令构建桌面应用程序`);
        process.exit(0);
    }
    if (command === 'build') await build();
    else {
        console.error(`未知命令: ${command}`);
        console.log('运行 "desktop-builder" 或 "desktop-builder --help" 查看用法。'), process.exit(1);
    }
};

export { runCLI, build };