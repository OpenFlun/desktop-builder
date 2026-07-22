import { app, BrowserWindow, Menu, shell } from 'electron';
import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';
import { createRequire } from 'module';

// --------------------- 全局变量 ---------------------
let mainWindow = null, serverProcess = null, windowCreationPromise = null, loadRetryCount = 0, focusRestoreTimer = null,
  focusRestoreCooldown = false, windowHadFocus = false;
const require = createRequire(import.meta.url), __dirname = path.dirname(fileURLToPath(import.meta.url)),
  CONFIG = {
    APP_URL: JSON.parse('__APP_URL__'),
    WINDOW_CONFIG: JSON.parse('__WINDOW_CONFIG__'),
    SERVER_PATH: JSON.parse('__SERVER_PATH__'),
    AUTO_START_SERVER: JSON.parse('__AUTO_START_SERVER__'),
    AUTO_KILL_SERVER: JSON.parse('__AUTO_KILL_SERVER__'),
    LOGGING_ENABLED: JSON.parse('__LOGGING_ENABLED__'),
    MENU_TEMPLATE: __MENU_TEMPLATE__,
  }, TARGET_URL = CONFIG.APP_URL,
  switches = ['no-sandbox', 'ignore-certificate-errors', 'allow-insecure-localhost'],
  // --------------------- 工具函数 ---------------------
  writeLog = (filePath, msg) => {
    try { fs.appendFileSync(filePath, new Date().toISOString() + ' ' + msg + '\n'); } catch (_) { }
  },
  log = msg => {
    if (CONFIG.LOGGING_ENABLED) writeLog(path.join(app.getPath('desktop'), 'myapp_debug.log'), msg);
  },
  // 焦点恢复
  checkInputFocused = win => {
    if (!win || win.isDestroyed()) return Promise.resolve(false);
    return win.webContents.executeJavaScript(
      `(function() {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable))
        return true;
      return false;
    })();`).catch(() => false);
  },
  performFocusRestore = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!mainWindow.isVisible() || mainWindow.isMinimized()) return;
    if (focusRestoreCooldown) return;

    checkInputFocused(mainWindow).then(alreadyFocused => {
      if (alreadyFocused) return windowHadFocus = false;
      mainWindow.blur();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus(), mainWindow.webContents.focus();
      windowHadFocus = false, focusRestoreCooldown = true, setTimeout(() => focusRestoreCooldown = false, 1000);
    }).catch(() => windowHadFocus = false);
  },
  startFocusRestore = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.on('blur', () => windowHadFocus = true);
    mainWindow.on('focus', () => {
      if (windowHadFocus && !focusRestoreCooldown) {
        if (focusRestoreTimer) clearTimeout(focusRestoreTimer);
        focusRestoreTimer = setTimeout(() => {
          focusRestoreTimer = null, performFocusRestore();
        }, 150);
      }
    });
    mainWindow.once('ready-to-show', () => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) windowHadFocus = true;
    });
  },
  stopFocusRestore = () => {
    if (focusRestoreTimer) clearTimeout(focusRestoreTimer), focusRestoreTimer = null;
    focusRestoreCooldown = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeAllListeners('blur'), mainWindow.removeAllListeners('focus');
      mainWindow.removeAllListeners('ready-to-show');
    }
  },
  killServerProcess = () => {
    if (!serverProcess) return;
    try {
      if (process.platform === 'win32') exec(`taskkill /pid ${serverProcess.pid} /T /F`);
      else process.kill(-serverProcess.pid, 'SIGTERM');
    } catch (_) { }
    serverProcess = null;
  },
  focusMainWindow = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      return mainWindow.focus(), true;
    }
    return false;
  }, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  // 端口释放
  ensurePortFree = port => {
    return new Promise(resolve => {
      const server = net.createServer();
      server.once('error', err => {
        if (err.code === 'EADDRINUSE') {
          const cmd = process.platform === 'win32' ? `netstat -ano | findstr :${port}` : `lsof -i :${port} -t`;
          exec(cmd, (err, stdout) => {
            if (err) return resolve(false);
            const pids = stdout.split(/\s+/).filter(x => x && !isNaN(x));
            let killed = false;
            for (const pid of pids) try { process.kill(parseInt(pid), 'SIGTERM'), killed = true; } catch (_) { };
            setTimeout(() => resolve(killed), 1000);
          });
        }
        else resolve(false);
      });
      server.once('listening', () => { server.close(), resolve(true); });
      server.listen(port, '127.0.0.1');
    });
  },
  // 等待服务器就绪
  waitForServer = async (port, timeout = 30000) => {
    const start = Date.now(), url = new URL(CONFIG.APP_URL), hostname = url.hostname, protocol = url.protocol,
      httpModule = protocol === 'https:' ? https : http;
    let ip = '127.0.0.1';
    try {
      const { address } = await dns.promises.lookup(hostname);
      ip = address;
    } catch (err) {
      log(`解析 ${hostname} 失败: ${err.message}, 使用 127.0.0.1 兜底`);
    }

    return new Promise(resolve => {
      const check = () => {
        if (Date.now() - start > timeout) return log('服务器就绪超时'), resolve(false);
        const req = httpModule.get({
          hostname: ip, port: port, path: '/',
          rejectUnauthorized: false, timeout: 5000, family: 4
        }, res => {
          resolve(true), req.destroy();
        });

        req.on('error', (err) => {
          log('服务器尚未就绪: ' + err.message), setTimeout(check, 2000);
        });

        req.on('timeout', () => {
          req.destroy(), setTimeout(check, 2000);
        });
      };
      check();
    });
  },
  // 在浏览器中打开
  openInBrowser = () => {
    try {
      shell.openExternal(CONFIG.APP_URL);
    } catch (e) { log('打开浏览器失败: ' + e.message) }
  },
  // 启动后端服务器
  startServer = async () => {
    if (!CONFIG.AUTO_START_SERVER) return log('服务器自动启动已禁用'), true;
    const serverPath = path.join(__dirname, CONFIG.SERVER_PATH);
    if (!fs.existsSync(serverPath)) return log('[错误] 服务器文件不存在: ' + serverPath), false;

    let port = 7296;
    try { port = parseInt(new URL(CONFIG.APP_URL).port) || 7296 } catch (_) { }
    for (let attempt = 1; attempt <= 3; attempt++) {
      log(`正在清理端口 ${port}（尝试 ${attempt}/3）...`), await ensurePortFree(port), log('正在启动服务器进程...');
      const env = { ...process.env, NODE_PATH: path.join(__dirname, 'node_modules') };
      serverProcess = spawn('node', [serverPath], { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env });
      serverProcess.stdout.on('data', d => log('服务器 stdout: ' + d.toString().trim()));
      serverProcess.stderr.on('data', d => log('服务器 stderr: ' + d.toString().trim()));
      serverProcess.on('error', err => log('服务器进程错误: ' + err.message)), serverProcess.unref();

      log(`等待服务器就绪（端口 ${port}）...`);
      const ready = await waitForServer(port, 30000);
      if (ready) return log('服务器已就绪 ✓'), true;
      log(`服务器未就绪 (尝试 ${attempt}/3),重试...`), killServerProcess(), await sleep(2000);
    }
    return log('[错误] ❌ 服务器启动失败:多次尝试未响应'), false;
  },
  // 创建主窗口
  createWindow = async () => {
    if (mainWindow && !mainWindow.isDestroyed()) return focusMainWindow(), mainWindow;
    if (windowCreationPromise) {
      await windowCreationPromise;
      if (mainWindow) return focusMainWindow(), mainWindow;
    }

    windowCreationPromise = (async () => {
      try {
        const winConfig = {
          ...CONFIG.WINDOW_CONFIG,
          webPreferences: {
            ...CONFIG.WINDOW_CONFIG.webPreferences,
            webSecurity: true, allowRunningInsecureContent: true, enableWebAuthn: true,
            plugins: true, nodeIntegration: false,
            sandbox: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js')
          }
        };
        mainWindow = new BrowserWindow(winConfig);
        mainWindow.webContents.session.setPermissionRequestHandler((wc, perm, cb) => cb(true));
        mainWindow.webContents.session.setDevicePermissionHandler(() => true);
        mainWindow.once('ready-to-show', () => {
          if (!mainWindow.isDestroyed()) mainWindow.show(), mainWindow.focus(), mainWindow.webContents.focus();
        });

        mainWindow.webContents.on('did-fail-load', (e, code, desc, url) => {
          if (code === -102 && loadRetryCount < 3) {
            loadRetryCount++;
            setTimeout(() => { if (mainWindow) mainWindow.loadURL(TARGET_URL).catch(() => { }) }, 2000);
            return;
          }
          if (!mainWindow.isDestroyed())
            mainWindow.loadURL(`data:text/html;charset=utf-8,<h2>加载失败</h2><p>${desc}</p><p>URL: ${url}</p>`);
        });
        await mainWindow.loadURL(TARGET_URL), loadRetryCount = 0;
        setTimeout(() => { if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show(); }, 3000);

        mainWindow.on('closed', () => mainWindow = null);
        return mainWindow;
      } catch (err) {
        log('创建窗口失败: ' + err.message), app.quit();
      } finally { windowCreationPromise = null }
    })();
    return windowCreationPromise;
  },
  // 设置菜单
  setupMenu = () => {
    const template = CONFIG.MENU_TEMPLATE;
    if (!template || template.length === 0) return;

    const processMenu = items => {
      return items.map(item => {
        const newItem = { ...item };
        if (newItem.submenu) newItem.submenu = processMenu(newItem.submenu);
        if (newItem.click === '__TOGGLE_BROWSER__') newItem.click = openInBrowser;
        else if (typeof newItem.click === 'string' &&
          /^(async\s+)?(function\s*(\w*\s*)?\(|\(\)\s*=>|async\s*\(\)\s*=>)/.test(newItem.click.trim())) {
          try { newItem.click = eval(newItem.click) } catch (_) { }
        }
        return newItem;
      });
    }, processed = processMenu(template);
    Menu.setApplicationMenu(Menu.buildFromTemplate(processed));
  };

// --------------------- 主流程 ---------------------
globalThis.require = require;
switches.forEach(s => app.commandLine.appendSwitch(s));
try {
  const hostname = new URL(TARGET_URL).hostname;
  app.commandLine.appendSwitch('enable-features',
    'WebAuthentication,WebAuthn,WebAuthenticationHidSupport,WebAuthenticationWindowsApi,WebAuthenticationAndroidAccessory');
  app.commandLine.appendSwitch('disable-features', 'UseDnsHttpsSvcb,BlockInsecurePrivateNetworkRequests');
  app.commandLine.appendSwitch('enable-experimental-web-platform-features');
  app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
  app.commandLine.appendSwitch('vmodule', 'webauthn*=3');
} catch (_) { }

if (!app.requestSingleInstanceLock()) log('已有另一个实例在运行,退出'), app.quit();
else app.on('second-instance', () => focusMainWindow());

app.on('certificate-error', (e, wc, url, err, cert, cb) => { e.preventDefault(), cb(true); });
app.whenReady().then(async () => {
  setupMenu();

  // 检查 node_modules 是否存在
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  try {
    await fs.promises.access(nodeModulesPath, fs.constants.F_OK);
  } catch (_) {
    return log('[错误] node_modules 缺失,请重新安装应用程序;'), app.quit();
  }

  await startServer(), await createWindow(), startFocusRestore();
});

app.on('window-all-closed', () => {
  log('所有窗口已关闭');
  if (CONFIG.AUTO_KILL_SERVER) killServerProcess();
  stopFocusRestore(), app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else if (mainWindow) mainWindow.focus();
});

process.on('uncaughtException', err => {
  const msg = '未捕获异常: ' + err.message + '\n' + err.stack;
  log('[错误] ' + msg), app.quit();
});
app.on('will-quit', () => {
  killServerProcess(), stopFocusRestore();
});