import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import chalk from 'chalk';
import { execa } from 'execa';
import { minimatch } from 'minimatch';

const __dirname = path.dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url),
    CACHE_DIR = path.join(os.homedir(), '.electron-builder-cache');
/**
 * 构建桌面应用程序(跨平台)
 * >查看定义:@see {@link build}
 */
const build = async () => {
    // 公共初始化
    const origPkgPath = path.join(process.cwd(), 'package.json');
    if (!(await fs.pathExists(origPkgPath)))
        console.warn(chalk.yellow('[错误] 请配置 package.json 文件')), process.exit(1);
    const configPath = path.join(process.cwd(), 'desktopAppConfig.js');
    if (!(await fs.pathExists(configPath)))
        console.error(chalk.red('[错误] desktopAppConfig.js 文件缺失')), process.exit(1);
    const configModule = await import(`file://${configPath}?t=${Date.now()}`),
        {
            serverPath, appUrl, appName: userAppName, excludeFiles = [], excludeDependencies = [],
            excludeOutputs = [], enableLogging = false, allowScripts, menu, window: windowConfig = {},
            advanced: userAdvanced = {}, build: buildConfig = {}
        } = configModule.default;
    if (!serverPath || !appUrl)
        console.error(chalk.red('[错误] 配置文件缺少必填字段: serverPath, appUrl')), process.exit(1);

    const origPkg = await fs.readJson(origPkgPath), { name: pkgName, version: pkgVersion, author: pkgAuthor } = origPkg,
        appName = userAppName || pkgName || 'deskApp',
        configAllowScripts = (allowScripts && typeof allowScripts === 'object' && !Array.isArray(allowScripts))
            ? allowScripts : (() => {
                console.warn(chalk.yellow('[警告] allowScripts 配置错误或未配置,将使用默认值 { node: true }'));
                return { node: true };
            })(); // allowScripts 预处理

    await fs.ensureDir(CACHE_DIR);
    process.env.ELECTRON_BUILDER_CACHE = CACHE_DIR, process.env.ELECTRON_CACHE = CACHE_DIR;

    const tempDir = path.join(os.tmpdir(), 'desktop-builder-build', path.basename(process.cwd()));
    await fs.ensureDir(tempDir);

    // 清理临时目录,保留 node_modules 和依赖快照
    const snapshotFile = '.deps-snapshot.json', items = await fs.readdir(tempDir).catch(() => []);
    for (const item of items) {
        if (item === 'node_modules' || item === snapshotFile) continue;
        await fs.remove(path.join(tempDir, item));
    }

    const projectRoot = path.resolve(process.cwd()), isInDirectory = (relative, dir) => {
        return relative === dir || relative.startsWith(dir + path.sep);
    }, shouldExclude = (relative, patterns) => {
        return patterns.some(pattern => {
            if (pattern.endsWith('/')) {
                const dir = pattern.slice(0, -1);
                return isInDirectory(relative, dir);
            }
            if (pattern.startsWith('./')) {
                const stripped = pattern.slice(2);
                return minimatch(relative, stripped, { dot: true, matchBase: false });
            }
            return relative === pattern || minimatch(relative, pattern, { dot: true, matchBase: true });
        });
    };
    console.log(chalk.blue(`[信息] 正在复制项目文件从 ${projectRoot} 到 ${tempDir}`));
    await fs.copy(projectRoot, tempDir, {
        filter: src => {
            const relative = path.relative(projectRoot, src);
            if (relative === '') return true;
            if (isInDirectory(relative, 'node_modules')) return false;
            return !shouldExclude(relative, excludeFiles);
        }, dereference: true
    });

    // 生成 main.mjs
    const mainFilePath = path.join(__dirname, 'electron-main.js'), mainTem = await fs.readFile(mainFilePath, 'utf-8');
    let menuCode = 'null';
    if (menu && Array.isArray(menu) && menu.length > 0) {
        menuCode = JSON.stringify(menu, (key, value) => {
            if (typeof value === 'function') return value.toString();
            return value;
        });
    }
    const { autoStartServer = true, autoKillServer = true } = userAdvanced, rootPkgPath = path.join(tempDir, 'package.json'),
        serverRelPath = path.basename(serverPath), mainJs = mainTem.replace('__APP_URL__', JSON.stringify(appUrl))
            .replace('__WINDOW_CONFIG__', JSON.stringify(windowConfig))
            .replace('__SERVER_PATH__', JSON.stringify(serverRelPath))
            .replace('__AUTO_START_SERVER__', JSON.stringify(autoStartServer))
            .replace('__AUTO_KILL_SERVER__', JSON.stringify(autoKillServer))
            .replace('__MENU_TEMPLATE__', menuCode)
            .replace('__LOGGING_ENABLED__', JSON.stringify(enableLogging)), pkgJson = { ...origPkg };
    if (pkgJson.dependencies) for (const ex of excludeDependencies) delete pkgJson.dependencies[ex];
    else pkgJson.dependencies = {};
    delete pkgJson.devDependencies, pkgJson.main = 'main.mjs', pkgJson.description = appName;
    await Promise.all([fs.writeFile(path.join(tempDir, 'main.mjs'), mainJs), fs.writeJson(rootPkgPath, pkgJson, { spaces: 2 })]);

    const deps = pkgJson.dependencies || {}, sortedDeps = Object.keys(deps).sort().reduce((acc, key) => {
        acc[key] = deps[key];
        return acc;
    }, {}), extraFields = ['engines', 'overrides', 'resolutions'].reduce((acc, key) => {
        if (pkgJson[key]) acc[key] = pkgJson[key];
        return acc;
    }, {}), snapshotData = { deps: sortedDeps, extra: extraFields }, snapshotPath = path.join(tempDir, snapshotFile);

    let shouldInstall = true;
    if (await fs.pathExists(snapshotPath)) {
        const oldSnapshot = await fs.readJson(snapshotPath);
        if (JSON.stringify(oldSnapshot) === JSON.stringify(snapshotData)) {
            const nodeModulesPath = path.join(tempDir, 'node_modules');
            if (await fs.pathExists(nodeModulesPath)) shouldInstall = false, console.log(chalk.gray('[信息] 依赖未变化,跳过安装'));
        }
    }
    if (shouldInstall) {
        console.log(chalk.blue('[信息] 正在安装依赖...'));
        await execa('npm', ['install', '--production', '--no-audit', '--no-fund', '--no-package-lock'], {
            cwd: tempDir, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' }
        });
        await fs.writeJson(snapshotPath, snapshotData, { spaces: 2 });
    }

    // 更新 allowScripts
    if (await fs.pathExists(rootPkgPath)) {
        try {
            const rootPkg = await fs.readJson(rootPkgPath);
            rootPkg.allowScripts = configAllowScripts, await fs.writeJson(rootPkgPath, rootPkg, { spaces: 2 });
        } catch (err) {
            console.warn(chalk.yellow('[警告] 更新 allowScripts 失败: ' + err.message));
        }
    }
    // 获取 electron 版本
    let electronVersion;
    try {
        const ePkg = await fs.readJson(require.resolve('electron/package.json'));
        electronVersion = ePkg.version, console.log(chalk.blue('[信息] Electron 版本: ' + electronVersion));
    } catch (err) {
        console.error(chalk.red('[错误] 未找到 electron 包,请先安装;')), process.exit(1);
    }
    // 构建 configObj
    const {
        outputDir = './dist', inno: innoConfig = {}, appId = 'com.example.app', publisher: userPublisher,
        shortcutName: userShortcutName, win: userWin, mac: userMac, linux: userLinux, dmg: userDmg, ...restBuild
    } = buildConfig, userExcludePatterns = excludeFiles.map(p => {
        let pattern = p.replace(/^\.\//, '');
        if (pattern.endsWith('/')) return `!${pattern.slice(0, -1)}/**`;
        return `!${pattern}`;
    }),
        files = [
            "**/*", '!builder.json', "!**/*.map", "!**/*.ts", "!**/*.cts", "!**/*.mts",
            "!node_modules/**/*.md", "!node_modules/**/*.markdown", "!node_modules/**/license*",
            "!node_modules/**/licence*", "!node_modules/**/LICENSE*", "!node_modules/**/LICENCE*",
            "!node_modules/node/**", "!node_modules/node-win*/**", "!node_modules/node-darwin*/**",
            "!node_modules/node-linux*/**", "!node_modules/node-freebsd*/**", "!node_modules/node-sunos*/**",
            "!node_modules/node-aix*/**", ...userExcludePatterns
        ], output = path.join(tempDir, 'app'),
        configObj = { files, asar: false, npmRebuild: false, electronVersion, appId, productName: appName, ...restBuild };
    configObj.directories = { ...(configObj.directories || {}), output };

    // 平台特定配置（映射处理）
    const platform = process.platform,
        platformHandlers = {
            win32: (cfg, userWinCfg) => {
                cfg.win ??= {};
                let targets = cfg.win.target;
                if (!targets) cfg.win.target = ['dir'];
                else {
                    if (!Array.isArray(targets)) targets = [targets];
                    if (!targets.includes('dir')) targets.push('dir');
                    cfg.win.target = targets;
                }
                if (!cfg.win.icon && userWinCfg?.icon) cfg.win.icon = userWinCfg.icon;
                return { args: ['--dir', '--win'], subDir: 'win-unpacked' };
            },
            darwin: (cfg, userMacCfg, userDmgCfg) => {
                cfg.mac ??= {};
                if (!cfg.mac.target) cfg.mac.target = ['dmg', 'zip'];
                Object.assign(cfg.mac, userMacCfg || {});
                cfg.dmg = { iconSize: 80, window: { width: 540, height: 380 }, ...cfg.dmg, ...userDmgCfg };
                return { args: ['--mac'], subDir: '' };
            },
            linux: (cfg, userLinuxCfg) => {
                cfg.linux ??= {};
                if (!cfg.linux.target) cfg.linux.target = ['AppImage', 'deb'];
                if (!cfg.linux.category) cfg.linux.category = 'Utility';
                Object.assign(cfg.linux, userLinuxCfg || {});
                if (!cfg.linux.icon && userLinuxCfg?.icon) cfg.linux.icon = userLinuxCfg.icon;
                return { args: ['--linux'], subDir: '' };
            }
        };
    if (!platformHandlers[platform]) console.error(chalk.red(`[错误] 不支持的操作系统: ${platform}`)), process.exit(1);

    const handlerResult = platformHandlers[platform](configObj, userWin, userMac, userDmg), platformArgs = handlerResult.args,
        subDir = handlerResult.subDir, configFile = path.join(tempDir, 'builder.json');
    await fs.writeJson(configFile, configObj, { spaces: 2 });

    // 构建可执行文件（electron-builder）
    let retries = 2, lastError = null, success = false;
    while (retries > 0) {
        try {
            await execa(
                'npx',
                ['--no-install', 'electron-builder', '--project', tempDir, '--config', configFile, ...platformArgs],
                {
                    cwd: process.cwd(),
                    stdio: 'inherit',
                    env: {
                        ...process.env,
                        ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/',
                        ELECTRON_BUILDER_BINARIES_MIRROR: 'https://registry.npmmirror.com/-/binary/electron-builder-binaries/',
                        ELECTRON_BUILDER_CACHE: CACHE_DIR,
                        CSC_IDENTITY_AUTO_DISCOVERY: 'false'
                    }
                }
            ), success = true;
            break;
        } catch (error) {
            lastError = error, retries--;
            if (retries > 0) {
                console.warn(chalk.yellow(`[警告] 生成可执行文件失败,剩余 ${retries} 次尝试`));
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    if (!success) console.error(chalk.red('[错误] 生成可执行文件失败:'), lastError), process.exit(1);

    const copyArtifacts = async (srcDir, targetDir, patterns, excludePatterns) => {
        if (!await fs.pathExists(srcDir)) return false;
        await fs.ensureDir(targetDir);
        const files = await fs.readdir(srcDir),
            filtered = files.filter(file => !excludePatterns.some(p => minimatch(file, p, { dot: true })));
        let copied = 0;
        for (const file of filtered) {
            if (patterns.some(p => file.endsWith(p)))
                await fs.copy(path.join(srcDir, file), path.join(targetDir, file)), copied++;
        }
        return copied > 0;
    },
        // 生成 Inno Setup 脚本
        generateIssScript = async ({
            appName, appVersion, appId, publisher, appDir, outputDir, exeName, shortcutName, installDirName, outputBase,
            groupName, isccDir, inno = {}
        }) => {
            const { createStartMenuShortcut, createDesktopShortcut, runAfterInstall, runDescription, ...remaining } = inno,
                excludeKeys = ['AppId', 'AppName', 'AppPublisher', 'AppVersion', 'defaultDirName', 'defaultGroupName',
                    'OutputDir', 'outputBaseFilename'];
            for (const key of excludeKeys) delete remaining[key]; // 排除已在外部特殊处理的字段

            // 构建 [Setup] 节
            const setupLines = [], addLine = (key, value) => {
                if (value === undefined || value === null || value === '') return;
                let strValue;
                if (typeof value === 'boolean') strValue = value ? 'yes' : 'no';
                else if (typeof value === 'string') strValue = /\s|\\|\//.test(value) ? `"${value}"` : value;
                else if (typeof value === 'number') strValue = String(value);
                else return;
                setupLines.push(`${key}=${strValue}`);
            };
            // 显式处理必要字段
            addLine('AppId', appId);
            addLine('AppName', appName);
            addLine('AppPublisher', publisher);
            addLine('AppVersion', appVersion);
            addLine('DefaultDirName', installDirName);
            addLine('DefaultGroupName', groupName);
            addLine('OutputDir', outputDir);
            addLine('OutputBaseFilename', outputBase);
            // 自动处理剩余字段
            for (const [key, value] of Object.entries(remaining)) addLine(key, value);
            // 语言文件
            const langDir = path.join(isccDir, 'Languages');
            let langEntries = ['Name: "en"; MessagesFile: "compiler:Default.isl"'];
            if (await fs.pathExists(langDir)) {
                try {
                    const files = await fs.readdir(langDir);
                    const langFiles = files.filter(f => f.endsWith('.isl') && f !== 'Default.isl');
                    if (langFiles.length > 0) {
                        const otherEntries = langFiles.map(f => {
                            const name = f.replace(/\.isl$/, '');
                            return `Name: "${name}"; MessagesFile: "compiler:Languages\\${f}"`;
                        });
                        langEntries = langEntries.concat(otherEntries);
                    }
                    else console.warn(chalk.yellow('[警告] 未找到任何语言文件,仅使用英文;'));
                } catch (err) {
                    console.warn(chalk.yellow(`[警告] 扫描语言目录失败: ${err.message},仅使用英文;`));
                }
            }
            else console.warn(chalk.yellow(`[警告] 语言目录不存在 (${langDir}),仅使用英文;`));

            const langSection = `\n[Languages]\n${langEntries.join('\n')}`,
                fileAndDir = `Filename: "{app}\\${exeName}"; WorkingDir: "{app}"`, sections = [], shortcutLocations = [];
            sections.push(`[Setup]\n${setupLines.join('\n')}`), sections.push(langSection);
            sections.push(`[Files]\nSource: "${appDir}\\*"; DestDir: "{app}"; Flags: recursesubdirs`);

            if (createStartMenuShortcut !== false) shortcutLocations.push('{group}');
            if (createDesktopShortcut !== false) shortcutLocations.push('{autodesktop}');
            if (shortcutLocations.length > 0) {
                const iconEntries = shortcutLocations.map(loc => `Name: "${loc}\\${shortcutName}"; ${fileAndDir}`).join('\n');
                sections.push(`[Icons]\n${iconEntries}`);
            }
            if (runAfterInstall !== false) {
                const runEntry = `${fileAndDir}; Description: "${runDescription || `运行 ${appName}`}"; ` +
                    `Flags: postinstall nowait skipifsilent`;
                sections.push(`[Run]\n${runEntry}`);
            }
            // 卸载时用户数据处理
            sections.push(`[Code]
                procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
                var
                  mres: Integer;
                  userDataDir, BatchFile, AppDir: string;
                  ResultCode: Integer;
                begin
                  if CurUninstallStep = usPostUninstall then
                  begin
                    mres := MsgBox('是否删除用户数据？', mbConfirmation, MB_YESNO or MB_DEFBUTTON2);
                    if mres = IDYES then
                    begin
                      userDataDir := ExpandConstant('{userappdata}') + '\\' + '${appName}';
                      if DirExists(userDataDir) then DelTree(userDataDir, True, True, True);
                      Exec('taskkill', '/f /im ' + '${exeName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
                      BatchFile := ExpandConstant('{tmp}') + '\\cleanup.bat';
                      AppDir := ExpandConstant('{app}');
                      if not FileExists(BatchFile) then
                      begin
                        if not SaveStringToFile(BatchFile,
                          '@echo off' + #13#10 +
                          'set /a retry=0' + #13#10 +
                          ':retry' + #13#10 +
                          'rmdir /s /q "' + AppDir + '" 2>nul' + #13#10 +
                          'if not exist "' + AppDir + '" (del /q "' + BatchFile + '" 2>nul & exit /b)' + #13#10 +
                          'set /a retry+=1' + #13#10 +
                          'if !retry! geq 15 exit /b' + #13#10 +
                          'timeout /t 2 /nobreak >nul' + #13#10 +
                          'goto retry', False) then Exit;
                      end;
                      ShellExec('runas', ExpandConstant('{cmd}'), '/c "' + BatchFile + '"', '', SW_HIDE, ewNoWait, ResultCode);
                    end;
                  end;
                end;`);
            return sections.join('\n\n');
        };
    // 平台打包
    const targetDir = path.resolve(process.cwd(), outputDir), appDir = path.join(output, subDir);
    if (platform === 'win32') {
        console.log(chalk.gray('正在执行 Inno Setup 编译(时间可能2~5分钟,请稍作休息)...'));
        if (!(await fs.pathExists(appDir))) console.error(chalk.red('[错误] 未找到 win-unpacked 目录;')), process.exit(1);
        const exeFiles = await fs.readdir(appDir), exeName = exeFiles.find(f => f.endsWith('.exe'));
        if (!exeName) console.error(chalk.red('[错误] 未找到可执行文件;')), process.exit(1);

        const appExe = path.join(appDir, exeName), isccPath = await (async () => {
            try {
                const { stdout } = await execa('where', ['iscc']);
                if (stdout.trim()) return stdout.trim().split('\n')[0];
            } catch (_) { }
            const { ProgramFiles = 'C:\\Program Files', 'ProgramFiles(x86)': ProgramFilesX86 = 'C:\\Program Files (x86)'
            } = process.env, programFiles = [ProgramFiles, ProgramFilesX86];
            for (const pf of programFiles) {
                try {
                    const dirs = await fs.readdir(pf);
                    for (const dir of dirs) {
                        if (dir.startsWith('Inno Setup')) {
                            const exe = path.join(pf, dir, 'ISCC.exe');
                            if (await fs.pathExists(exe)) return exe;
                        }
                    }
                } catch (_) { }
            }
            return null;
        })();
        if (!isccPath) {
            console.error(chalk.red('[错误] 未找到 Inno Setup 编译器!'));
            console.error(chalk.yellow('[提示] 请从官网 https://jrsoftware.org/isdl.php 或 ' +
                '国内 https://gitee.com/OpenFlun/inno-setup/releases 下载,安装时务必选择默认目录;')), process.exit(1);
        }

        const {
            appName: innoAppName, appVersion: innoVersion, appId: innoAppId, appPublisher, defaultDirName, defaultGroupName,
            shortcutName: innoShortcut, outputDir: innoOutputDir, outputBaseFilename
        } = innoConfig, sourceDir = innoOutputDir || path.join(tempDir, 'Output'),
            issContent = await generateIssScript({
                appName: innoAppName || appName,
                appVersion: innoVersion || pkgVersion || '1.0.0',
                appId: innoAppId || appId,
                publisher: appPublisher || userPublisher || pkgAuthor || appName,
                appDir, outputDir: sourceDir,
                exeName: path.basename(appExe),
                installDirName: defaultDirName || `{localappdata}\\Programs\\${appName}`,
                groupName: defaultGroupName || appName,
                outputBase: outputBaseFilename || `${appName}Setup`,
                shortcutName: innoShortcut || userShortcutName || appName,
                isccDir: path.dirname(isccPath), inno: innoConfig
            }), issPath = path.join(tempDir, 'installer.iss');
        await fs.writeFile(issPath, issContent);
        try {
            await execa(isccPath, ['/Q', issPath], { cwd: tempDir, stdio: 'inherit', env: process.env });
        } catch (error) {
            console.error(chalk.red('[错误] Inno Setup 打包失败:'), error), process.exit(1);
        }

        await copyArtifacts(sourceDir, targetDir, ['.exe'], excludeOutputs);
        console.log(chalk.green('[成功] 构建完成！安装包位于: ' + targetDir));
    } else {
        // macOS / Linux
        let patterns = [];
        if (platform === 'darwin') {
            const targets = configObj.mac.target;
            patterns = targets.map(t => (t.startsWith('.') ? t : `.${t}`));
        } else if (platform === 'linux') {
            const targets = configObj.linux.target;
            patterns = targets.map(t => (t.startsWith('.') ? t : `.${t}`));
        }
        const copied = await copyArtifacts(appDir, targetDir, patterns, excludeOutputs);
        if (copied) console.log(chalk.green('[成功] 构建完成！安装包位于: ' + targetDir));
        else console.warn(chalk.yellow('[警告] 未找到构建产物;'));
    }
};

/**
 * 运行命令行接口
 * >查看定义:@see {@link runCLI}
 */
const runCLI = async () => {
    const command = process.argv[2];
    if (!command || command === 'help' || command === '--help' || command === '-h')
        console.log(`用法:先配置 desktopAppConfig.js 文件,然后运行->desktop-builder build 指令构建桌面应用程序`), process.exit(0);
    if (command === 'build') await build();
    else {
        console.error(`未知命令: ${command}`), console.log('请运行 "desktop-builder --help" 查看用法;'), process.exit(1);
    }
};
export { runCLI, build };