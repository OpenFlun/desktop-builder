import { app, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===== 强制系统网络栈 + 实验性平台特性 =====
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-features', 'UseDnsHttpsSvcb');
app.commandLine.appendSwitch('enable-features', 'NetworkService');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

const CONFIG = {
  APP_URL: JSON.parse('__APP_URL__'),
  WINDOW_CONFIG: JSON.parse('__WINDOW_CONFIG__'),
  SERVER_PATH: JSON.parse('__SERVER_PATH__'),
  AUTO_START_SERVER: JSON.parse('__AUTO_START_SERVER__'),
  AUTO_KILL_SERVER: JSON.parse('__AUTO_KILL_SERVER__'),
};

const TARGET_URL = CONFIG.APP_URL;
let mainWindow = null;
let serverProcess = null;
let loadFailed = false;
let windowCreationPromise = null;

// ---------- 日志 ----------
function log(message, ...args) {
  try {
    const desktop = app.getPath('desktop');
    const logPath = path.join(desktop, 'myapp_debug.log');
    const timestamp = new Date().toISOString();
    const msg = args.length ? `${timestamp} ${message} ${args.join(' ')}` : `${timestamp} ${message}`;
    fs.appendFileSync(logPath, msg + '\n');
  } catch (_) { }
}
function emergencyLog(message) {
  try {
    const logPath = path.join(process.cwd(), 'myapp_emergency.log');
    fs.appendFileSync(logPath, new Date().toISOString() + ' ' + message + '\n');
  } catch (_) { }
}

// ---------- 单实例 ----------
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log('Another instance is running, exiting');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ---------- 服务器就绪探测（强制 IPv4） ----------
function waitForServer(url, timeout = 30000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let timer = null;

    const check = () => {
      if (Date.now() - startTime > timeout) {
        log('Server ready check timed out, proceeding anyway');
        resolve(false);
        return;
      }

      const parsed = new URL(url);
      const protocol = parsed.protocol === 'https:' ? https : http;
      const request = protocol.get({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname || '/',
        rejectUnauthorized: false,
        timeout: 5000,
        family: 4,
      }, (res) => {
        log('Server responded with status: ' + res.statusCode);
        resolve(true);
        request.destroy();
      });

      request.on('error', (err) => {
        log('Server not ready yet: ' + err.message);
        timer = setTimeout(check, 2000);
      });

      request.on('timeout', () => {
        log('Server request timeout');
        request.destroy();
        timer = setTimeout(check, 2000);
      });
    };

    check();
  });
}

// ---------- 创建窗口 ----------
async function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    log('Window already exists, focusing');
    mainWindow.focus();
    return mainWindow;
  }

  if (windowCreationPromise) {
    log('Window creation in progress, waiting...');
    await windowCreationPromise;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      return mainWindow;
    }
  }

  windowCreationPromise = (async () => {
    log('Creating window...');

    try {
      const winConfig = {
        ...CONFIG.WINDOW_CONFIG,
        webPreferences: {
          ...CONFIG.WINDOW_CONFIG.webPreferences,
          webSecurity: false,
          allowRunningInsecureContent: true,
          enableWebAuthn: true,
          plugins: true,
          experimentalFeatures: true,
          enableBlinkFeatures: 'WebAuthn,WebUSB,WebHID,WebNFC', // 添加常见硬件特性
        }
      };

      mainWindow = new BrowserWindow(winConfig);
      log('Window created (webSecurity: false)');

      // ---------- 权限授予（兼容所有 Electron 版本） ----------
      const session = mainWindow.webContents.session;

      // 1. 通用权限请求
      session.setPermissionRequestHandler((webContents, permission, callback) => {
        log('Permission requested: ' + permission + ' - granting');
        callback(true);
      });

      // 2. 设备权限（WebAuthn 专用）
      if (typeof session.setDevicePermissionHandler === 'function') {
        session.setDevicePermissionHandler((details) => {
          log('Device permission requested: ' + details.deviceType);
          return true;
        });
      } else {
        log('setDevicePermissionHandler not available, using fallback');
      }

      // 3. 权限检查（可选，兼容性处理）
      if (typeof session.setPermissionCheckHandler === 'function') {
        session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
          log('Permission check: ' + permission + ' from ' + requestingOrigin + ' - granting');
          return true;
        });
      }

      // 注意：已移除 setMediaAccessPermissionHandler（旧版 Electron 不支持）

      // ---------- 唯一的事件注册 ----------
      let isShown = false;
      mainWindow.once('ready-to-show', () => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.show();
          isShown = true;
          log('Window shown (ready-to-show)');
        }
      });

      // ---------- 加载失败处理 ----------
      mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        const msg = `Failed to load URL: ${errorDescription} (${errorCode}) loading '${validatedURL}'`;
        log(msg);
        if (loadFailed) return;
        loadFailed = true;
        mainWindow.webContents.removeAllListeners('did-fail-load');

        mainWindow.loadURL(`data:text/html;charset=utf-8,
          <html>
            <head><meta charset="utf-8"><title>加载失败</title></head>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;margin:0;background:#f5f5f5;">
              <div style="background:white;padding:40px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);max-width:600px;text-align:center;">
                <h2>加载失败</h2>
                <p style="color:#d32f2f;">${errorDescription}</p>
                <p style="color:#666;font-size:14px;">URL: ${validatedURL}</p>
                <p style="color:#999;font-size:13px;">${serverProcess ? '服务器已启动' : '服务器未启动'}</p>
                <p style="color:#999;font-size:12px;">请检查: 1) 端口 ${new URL(validatedURL).port} 是否被占用 2) 防火墙是否放行</p>
              </div>
            </body>
          </html>
        `);
        if (!isShown) mainWindow.show();
      });

      log(`Loading: ${TARGET_URL}`);
      await mainWindow.loadURL(TARGET_URL);
      log('Load success');

      // ---------- 后备显示（3秒后若未显示则强制显示） ----------
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
          mainWindow.show();
          log('Window shown (forced timeout)');
        }
      }, 3000);

      mainWindow.on('closed', () => {
        mainWindow = null;
        log('Window closed');
      });

      log('Window creation completed');
      return mainWindow;
    } catch (err) {
      const msg = 'Failed to create window: ' + err.message;
      log(msg);
      emergencyLog(msg);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`data:text/html;charset=utf-8,
          <html>
            <head><meta charset="utf-8"><title>启动错误</title></head>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;margin:0;background:#f5f5f5;">
              <div style="background:white;padding:40px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);max-width:600px;text-align:center;">
                <h2>启动错误</h2>
                <p style="color:#d32f2f;">${err.message}</p>
                <p style="color:#999;font-size:13px;">请查看桌面上的 myapp_debug.log 获取详细信息。</p>
              </div>
            </body>
          </html>
        `);
        mainWindow.show();
        return mainWindow;
      } else {
        app.quit();
        throw err;
      }
    } finally {
      windowCreationPromise = null;
    }
  })();

  return windowCreationPromise;
}

// ---------- 启动服务器 ----------
async function startServer() {
  if (!CONFIG.AUTO_START_SERVER) return;

  const serverPath = path.join(__dirname, CONFIG.SERVER_PATH);
  log('Starting server: ' + serverPath);
  if (!fs.existsSync(serverPath)) {
    log('Server file not found: ' + serverPath);
    return;
  }

  const env = {
    ...process.env,
    NODE_PATH: path.join(__dirname, 'node_modules'),
  };

  serverProcess = spawn('node', [serverPath], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });

  serverProcess.stdout.on('data', (data) => {
    log('Server stdout: ' + data.toString().trim());
  });
  serverProcess.stderr.on('data', (data) => {
    log('Server stderr: ' + data.toString().trim());
  });

  serverProcess.on('error', (err) => log('Server process error: ' + err.message));
  serverProcess.on('exit', (code) => {
    log('Server process exited with code ' + code);
    if (!mainWindow && code !== null && code !== 0) {
      log('Server exited before window created with error, quitting');
      app.quit();
    }
  });

  const ready = await waitForServer(CONFIG.APP_URL, 30000);
  log(ready ? 'Server is ready' : 'Server not ready within timeout, window will try to load anyway');
}

// ---------- 生命周期 ----------
app.whenReady().then(async () => {
  log('App ready');
  await startServer();
  await createWindow();
});

app.on('window-all-closed', () => {
  log('All windows closed');
  if (CONFIG.AUTO_KILL_SERVER && serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});

app.on('activate', () => {
  log('Activate event');
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
});

process.on('uncaughtException', (err) => {
  const msg = 'Uncaught Exception: ' + err.message + '\n' + err.stack;
  log(msg);
  emergencyLog(msg);
  app.quit();
});