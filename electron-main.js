import { app, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 占位符，构建时替换
const CONFIG = {
    APP_URL: '__APP_URL__',
    WINDOW_CONFIG: __WINDOW_CONFIG__,
    SERVER_PATH: '__SERVER_PATH__',
    AUTO_START_SERVER: '__AUTO_START_SERVER__',
    AUTO_KILL_SERVER: '__AUTO_KILL_SERVER__',
    SERVER_STARTUP_DELAY: '__SERVER_STARTUP_DELAY__',
};

let mainWindow = null;
let serverProcess = null;

async function createWindow() {
    mainWindow = new BrowserWindow(CONFIG.WINDOW_CONFIG);
    mainWindow.loadURL(CONFIG.APP_URL);
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

async function startServer() {
    if (!CONFIG.AUTO_START_SERVER) return;
    serverProcess = spawn('node', [CONFIG.SERVER_PATH], {
        cwd: path.dirname(CONFIG.SERVER_PATH),
        stdio: 'ignore',
        detached: true,
    });
    await new Promise(resolve => setTimeout(resolve, CONFIG.SERVER_STARTUP_DELAY));
}

app.whenReady().then(async () => {
    await startServer();
    await createWindow();
});

app.on('window-all-closed', () => {
    if (CONFIG.AUTO_KILL_SERVER && serverProcess) {
        serverProcess.kill('SIGTERM');
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});