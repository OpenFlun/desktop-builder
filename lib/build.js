import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function build() {
    const configPath = path.join(process.cwd(), 'desktopAppConfig.js');
    if (!(await fs.pathExists(configPath))) {
        console.error(chalk.red('❌ desktopAppConfig.js not found.'));
        console.error(chalk.yellow('💡 Please reinstall @flun/desktop-builder to generate the config file, or manually copy it from the package.'));
        process.exit(1);
    }

    // 动态导入用户配置 (ES Module)
    const configModule = await import(`file://${configPath}?t=${Date.now()}`);
    const config = configModule.default;

    // 验证必要参数
    if (!config.serverPath || !config.appUrl || !config.appName) {
        console.error(chalk.red('❌ Missing required fields: serverPath, appUrl, appName'));
        process.exit(1);
    }

    // 创建临时构建目录
    const tempDir = path.join(process.cwd(), '.desktop-builder', 'build');
    await fs.emptyDir(tempDir);

    // 1. 生成 Electron 主进程文件（从包根目录读取模板）
    const mainTemplatePath = path.join(__dirname, '..', 'electron-main.js');
    const mainTemplate = await fs.readFile(mainTemplatePath, 'utf-8');

    const serverAbsPath = path.resolve(process.cwd(), config.serverPath);
    const iconAbsPath = config.branding?.icon
        ? path.resolve(process.cwd(), config.branding.icon)
        : path.join(__dirname, '..', 'default-icon.png'); // 如果没有图标，使用包内默认（需自行准备）

    // 合并窗口配置
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

    const mainJs = mainTemplate
        .replace('__APP_URL__', JSON.stringify(config.appUrl))
        .replace('__WINDOW_CONFIG__', JSON.stringify(windowConfig, null, 2))
        .replace('__SERVER_PATH__', JSON.stringify(serverAbsPath))
        .replace('__AUTO_START_SERVER__', JSON.stringify(advanced.autoStartServer))
        .replace('__AUTO_KILL_SERVER__', JSON.stringify(advanced.autoKillServer))
        .replace('__SERVER_STARTUP_DELAY__', JSON.stringify(advanced.serverStartupDelay));

    await fs.writeFile(path.join(tempDir, 'main.js'), mainJs);

    // 2. 复制图标
    await fs.copy(iconAbsPath, path.join(tempDir, 'icon.png'));

    // 3. 生成临时 package.json
    const buildConfig = config.build || {};
    const pkgJson = {
        name: config.appName,
        version: '1.0.0',
        main: 'main.js',
        build: {
            appId: buildConfig.appId || 'com.example.app',
            productName: config.appName,
            directories: {
                output: buildConfig.outputDir || './dist',
                app: '.',
            },
            files: ['main.js', 'icon.png'],
            win: {
                target: ['nsis'],
                icon: 'icon.png',
            },
            mac: {
                target: ['dmg'],
                icon: 'icon.png',
            },
            linux: {
                target: ['AppImage'],
                icon: 'icon.png',
                category: buildConfig.linux?.category || 'Utility',
            },
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
        },
    };

    await fs.writeJson(path.join(tempDir, 'package.json'), pkgJson, { spaces: 2 });

    console.log(chalk.green('✅ Temporary build files generated.'));

    // 4. 执行 electron-builder
    console.log(chalk.blue('📦 Building application... (this may take a few minutes)'));
    try {
        await execa('npx', ['electron-builder', '--config', 'package.json'], {
            cwd: tempDir,
            stdio: 'inherit',
        });
        const outputDir = buildConfig.outputDir || './dist';
        console.log(chalk.green(`✅ Build complete! Application is in: ${path.resolve(outputDir)}`));
    } catch (error) {
        console.error(chalk.red('❌ Build failed:'), error);
        process.exit(1);
    } finally {
        // 可选择清理临时目录
        // await fs.remove(tempDir);
    }
}