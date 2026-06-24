import { app, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// 配置（由 build.js 注入）
// ============================================================
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
let loadRetryCount = 0;

// ============================================================
// 动态设置命令行开关（从 APP_URL 中提取主机名）
// ============================================================
try {
  const urlObj = new URL(TARGET_URL);
  const hostname = urlObj.hostname;

  // 基础开关
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('ignore-certificate-errors');
  app.commandLine.appendSwitch('disable-web-security');
  app.commandLine.appendSwitch('allow-insecure-localhost');

  // 动态映射域名到 127.0.0.1，使该域名成为安全源
  app.commandLine.appendSwitch('host-resolver-rules', `MAP ${hostname} 127.0.0.1`);

  // 启用所有 WebAuthn 特性（包括 Windows 系统 API 和 HID）
  app.commandLine.appendSwitch('enable-features',
    'WebAuthentication,WebAuthn,WebAuthenticationHidSupport,WebAuthenticationWindowsApi');
  app.commandLine.appendSwitch('disable-features',
    'UseDnsHttpsSvcb,BlockInsecurePrivateNetworkRequests');
  app.commandLine.appendSwitch('enable-experimental-web-platform-features');
  app.commandLine.appendSwitch('vmodule', 'webauthn*=3');

  console.log(`[Electron] Mapped ${hostname} to 127.0.0.1 for WebAuthn security.`);
} catch (err) {
  console.error('[Electron] Failed to parse APP_URL, using fallback:', err);
  // 如果解析失败，仍然启用基本开关
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('ignore-certificate-errors');
  app.commandLine.appendSwitch('disable-web-security');
  app.commandLine.appendSwitch('allow-insecure-localhost');
  app.commandLine.appendSwitch('enable-features',
    'WebAuthentication,WebAuthn,WebAuthenticationHidSupport,WebAuthenticationWindowsApi');
  app.commandLine.appendSwitch('disable-features',
    'UseDnsHttpsSvcb,BlockInsecurePrivateNetworkRequests');
  app.commandLine.appendSwitch('enable-experimental-web-platform-features');
  app.commandLine.appendSwitch('vmodule', 'webauthn*=3');
}

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

// ---------- 证书信任 ----------
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});

// ---------- 服务器就绪探测 ----------
function waitForServer(url, timeout = 60000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let timer = null;
    const check = () => {
      if (Date.now() - startTime > timeout) {
        log('Server ready check timed out after ' + timeout + 'ms, proceeding anyway');
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

// ---------- 注入前端补丁（解决 startAuthentication 警告） ----------
function injectWebAuthnPatch() {
  const patchScript = `
    (async function() {
      console.log('[Electron] Injecting WebAuthn compatibility patch...');
      if (typeof window.startAuthentication === 'function') {
        const originalStart = window.startAuthentication;
        window.startAuthentication = function(options) {
          console.log('[Electron] Intercepted startAuthentication with options:', options);
          if (options && !options.options && (options.rpId || options.challenge)) {
            const wrapped = { options: options };
            return originalStart(wrapped);
          }
          return originalStart(options);
        };
        console.log('[Electron] startAuthentication patched successfully.');
      } else {
        console.log('[Electron] startAuthentication not found, skipping patch.');
      }
      console.log('[Electron] PublicKeyCredential available:', !!window.PublicKeyCredential);
      if (window.PublicKeyCredential) {
        try {
          const result = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          console.log('[Electron] isUserVerifyingPlatformAuthenticatorAvailable:', result);
        } catch (e) {
          console.log('[Electron] Error checking UVPA:', e);
        }
      }
    })();
  `;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(patchScript)
      .catch(err => log('Patch injection error:', err.message));
  }
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
          experimentalFeatures: true,
          enableBlinkFeatures: 'WebAuthn',
          sandbox: false,
          plugins: true,
        }
      };
      mainWindow = new BrowserWindow(winConfig);
      log('Window created (webSecurity: false, sandbox: false, host-resolver-rules dynamic, WebAuthn Windows API enabled)');

      // ---------- 权限授予 ----------
      mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        log('Permission requested: ' + permission + ' - granting');
        callback(true);
      });
      mainWindow.webContents.session.setDevicePermissionHandler(() => true);

      let isShown = false;
      mainWindow.once('ready-to-show', () => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.show();
          isShown = true;
          log('Window shown (ready-to-show)');
        }
      });

      // ---------- 加载失败重试 ----------
      mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        const msg = `Failed to load URL: ${errorDescription} (${errorCode}) loading '${validatedURL}'`;
        log(msg);
        if (errorCode === -102 && loadRetryCount < 3) {
          loadRetryCount++;
          log('Retrying load attempt ' + loadRetryCount + ' of 3...');
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(TARGET_URL).catch(err => log('Retry load error: ' + err.message));
            }
          }, 2000);
          return;
        }
        if (loadFailed) return;
        loadFailed = true;
        mainWindow.webContents.removeAllListeners('did-fail-load');
        mainWindow.loadURL(`data:text/html;charset=utf-8,
          <html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
            <div style="text-align:center;">
              <h2>加载失败</h2>
              <p style="color:#d32f2f;">${errorDescription}</p>
              <p>URL: ${validatedURL}</p>
            </div>
          </body></html>
        `);
        if (!isShown) mainWindow.show();
      });

      mainWindow.webContents.on('did-finish-load', () => {
        log('Page finished loading');
        injectWebAuthnPatch();
      });

      log(`Loading: ${TARGET_URL}`);
      await mainWindow.loadURL(TARGET_URL);
      log('Load success');
      loadRetryCount = 0;

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
        mainWindow.loadURL(`data:text/html;charset=utf-8,<html>...error page...</html>`);
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
  const env = { ...process.env, NODE_PATH: path.join(__dirname, 'node_modules') };
  serverProcess = spawn('node', [serverPath], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env,
  });
  serverProcess.stdout.on('data', (data) => log('Server stdout: ' + data.toString().trim()));
  serverProcess.stderr.on('data', (data) => log('Server stderr: ' + data.toString().trim()));
  serverProcess.on('error', (err) => log('Server process error: ' + err.message));
  serverProcess.on('exit', (code) => {
    log('Server process exited with code ' + code);
    if (!mainWindow) {
      log('Server exited before window created, quitting');
      app.quit();
    }
  });
  serverProcess.unref();
  const ready = await waitForServer(CONFIG.APP_URL, 60000);
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