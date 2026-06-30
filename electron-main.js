import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import https from 'https';
import net from 'net';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const execPromise = promisify(exec);

// ========== Windows Hello 支持 ==========
let Passport = null;
if (process.platform === 'win32') {
  try {
    Passport = require('passport-desktop');
  } catch (_) {
    console.warn('[Windows Hello] passport-desktop 未安装');
  }
}

ipcMain.handle('webauthn:isAvailable', async () => {
  if (!Passport) return false;
  try {
    return Passport.available ? Passport.available() : false;
  } catch { return false; }
});

ipcMain.handle('webauthn:create', async (event, publicKey) => {
  if (!Passport) throw new Error('Windows Hello not supported');
  try {
    const accountId = publicKey?.user?.name || 'default';
    const passport = new Passport(accountId);
    if (!passport.accountExists) {
      await passport.createAccount();
    }
    // 模拟 credential
    return {
      id: Buffer.from(accountId).toString('base64'),
      rawId: Buffer.from(accountId),
      response: {
        clientDataJSON: Buffer.from(JSON.stringify({ type: 'webauthn.create' })),
        attestationObject: Buffer.from(''),
      },
      type: 'public-key',
    };
  } catch (error) {
    throw new Error(`Windows Hello 注册失败: ${error.message}`);
  }
});

ipcMain.handle('webauthn:get', async (event, publicKey) => {
  if (!Passport) throw new Error('Windows Hello not supported');
  try {
    const accountId = publicKey?.rpId || 'default';
    const passport = new Passport(accountId);
    const challenge = publicKey.challenge || Buffer.from('test');
    const signature = await passport.sign(challenge);
    return {
      id: Buffer.from(accountId).toString('base64'),
      rawId: Buffer.from(accountId),
      response: {
        authenticatorData: Buffer.from(''),
        clientDataJSON: Buffer.from(JSON.stringify({ type: 'webauthn.get' })),
        signature: signature,
        userHandle: Buffer.from(''),
      },
      type: 'public-key',
    };
  } catch (error) {
    throw new Error(`Windows Hello 登录失败: ${error.message}`);
  }
});
// ========== Windows Hello 支持结束 ==========

// 配置注入
const CONFIG = {
  APP_URL: JSON.parse('__APP_URL__'),
  WINDOW_CONFIG: JSON.parse('__WINDOW_CONFIG__'),
  SERVER_PATH: JSON.parse('__SERVER_PATH__'),
  AUTO_START_SERVER: JSON.parse('__AUTO_START_SERVER__'),
  AUTO_KILL_SERVER: JSON.parse('__AUTO_KILL_SERVER__'),
  MENU_TEMPLATE: __MENU_TEMPLATE__,
};
const TARGET_URL = CONFIG.APP_URL;

let mainWindow = null, serverProcess = null, windowCreationPromise = null, loadRetryCount = 0;
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost');

try {
  const hostname = new URL(TARGET_URL).hostname;
  app.commandLine.appendSwitch('host-resolver-rules', `MAP ${hostname} 127.0.0.1`);
  app.commandLine.appendSwitch('enable-features',
    'WebAuthentication,WebAuthn,WebAuthenticationHidSupport,WebAuthenticationWindowsApi,WebAuthenticationAndroidAccessory');
  app.commandLine.appendSwitch('disable-features', 'UseDnsHttpsSvcb,BlockInsecurePrivateNetworkRequests');
  app.commandLine.appendSwitch('enable-experimental-web-platform-features');
  app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
  app.commandLine.appendSwitch('vmodule', 'webauthn*=3');
  console.log(`[Electron] 已映射 ${hostname} 到 127.0.0.1`);
} catch (_) { }

const log = msg => {
  try {
    const logPath = path.join(app.getPath('desktop'), 'myapp_debug.log');
    fs.appendFileSync(logPath, new Date().toISOString() + ' ' + msg + '\n');
  } catch (_) { }
};
const emergencyLog = msg => {
  try { fs.appendFileSync(path.join(process.cwd(), 'myapp_emergency.log'), new Date().toISOString() + ' ' + msg + '\n'); } catch (_) { }
};

const killServerProcess = () => {
  if (!serverProcess) return;
  try {
    if (process.platform === 'win32') {
      exec(`taskkill /pid ${serverProcess.pid} /T /F`);
    } else {
      process.kill(-serverProcess.pid, 'SIGTERM');
    }
  } catch (_) { }
  serverProcess = null;
};

const focusMainWindow = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return true;
  }
  return false;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const ensureDependencies = async () => {
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  try {
    await fs.promises.access(nodeModulesPath, fs.constants.F_OK);
    return true;
  } catch {
    log('未找到 node_modules，开始安装依赖...');
    const depsPath = path.join(__dirname, 'deps.json');
    try {
      await fs.promises.access(depsPath, fs.constants.F_OK);
    } catch {
      log('错误: deps.json 不存在，无法安装依赖');
      return false;
    }
    let deps;
    try {
      const depsContent = await fs.promises.readFile(depsPath, 'utf-8');
      deps = JSON.parse(depsContent);
    } catch (err) {
      log('读取 deps.json 失败: ' + err.message);
      return false;
    }
    const pkgPath = path.join(__dirname, 'package.json');
    let pkg;
    try {
      const pkgContent = await fs.promises.readFile(pkgPath, 'utf-8');
      pkg = JSON.parse(pkgContent);
    } catch (err) {
      log('读取 package.json 失败: ' + err.message);
      return false;
    }
    pkg.dependencies = deps;
    pkg.devDependencies = {};
    try {
      await fs.promises.writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8');
    } catch (err) {
      log('写入 package.json 失败: ' + err.message);
      return false;
    }
    try {
      let cmd = 'npm install';
      const lockPath = path.join(__dirname, 'package-lock.json');
      try {
        await fs.promises.access(lockPath, fs.constants.F_OK);
        log('找到 package-lock.json，使用 npm ci');
        cmd = 'npm ci';
      } catch {
        log('未找到 package-lock.json，使用 npm install');
      }
      const { stdout, stderr } = await execPromise(cmd, {
        cwd: __dirname,
        env: process.env,
        timeout: 120000,
      });
      if (stdout) log('npm stdout: ' + stdout);
      if (stderr) log('npm stderr: ' + stderr);
      log('依赖安装完成');
      try {
        await fs.promises.access(nodeModulesPath, fs.constants.F_OK);
        return true;
      } catch {
        log('安装 node_modules 失败');
        return false;
      }
    } catch (error) {
      log('依赖安装失败: ' + error.message);
      emergencyLog('依赖安装失败堆栈: ' + error.stack);
      return false;
    }
  }
};

if (!app.requestSingleInstanceLock()) { log('已有另一个实例在运行,退出'); app.quit(); }
else app.on('second-instance', () => focusMainWindow());
app.on('certificate-error', (e, wc, url, err, cert, cb) => { e.preventDefault(); cb(true); });

const ensurePortFree = port => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const cmd = process.platform === 'win32' ? `netstat -ano | findstr :${port}` : `lsof -i :${port} -t`;
        exec(cmd, (err, stdout) => {
          if (err) { resolve(false); return; }
          const pids = stdout.split(/\s+/).filter(x => x && !isNaN(x));
          let killed = false;
          for (const pid of pids) {
            try { process.kill(parseInt(pid), 'SIGTERM'); killed = true; } catch (_) { }
          }
          setTimeout(() => resolve(killed), 1000);
        });
      } else { resolve(false); }
    });
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port, '127.0.0.1');
  });
};

const waitForServer = (port, timeout = 30000) => {
  return new Promise((resolve) => {
    const start = Date.now();
    const protocol = new URL(CONFIG.APP_URL).protocol;
    const httpModule = protocol === 'https:' ? https : http;
    const check = () => {
      if (Date.now() - start > timeout) {
        log('服务器就绪超时');
        resolve(false);
        return;
      }
      const req = httpModule.get({
        hostname: '127.0.0.1',
        port,
        path: '/',
        rejectUnauthorized: false,
        timeout: 5000,
        family: 4,
      }, res => {
        log('服务器响应 ' + res.statusCode);
        resolve(true);
        req.destroy();
      });
      req.on('error', (err) => {
        log('服务器尚未就绪: ' + err.message);
        setTimeout(check, 2000);
      });
      req.on('timeout', () => {
        req.destroy();
        setTimeout(check, 2000);
      });
    };
    check();
  });
};

// 补丁脚本：覆盖 WebAuthn API
const injectPatch = () => {
  const script = `
    (function() {
      const { ipcRenderer } = require('electron');
      // 暴露 API
      window.electronAPI = {
        webauthnCreate: (publicKey) => ipcRenderer.invoke('webauthn:create', publicKey),
        webauthnGet: (publicKey) => ipcRenderer.invoke('webauthn:get', publicKey),
        webauthnIsAvailable: () => ipcRenderer.invoke('webauthn:isAvailable'),
      };

      // 检查是否可用
      const hasWindowsHello = true; // 我们将尝试

      // 覆盖 navigator.credentials.create
      if (navigator.credentials && navigator.credentials.create) {
        const origCreate = navigator.credentials.create.bind(navigator.credentials);
        navigator.credentials.create = async function(options) {
          if (options && options.publicKey) {
            try {
              const result = await window.electronAPI.webauthnCreate(options.publicKey);
              return result;
            } catch (e) {
              console.error('[Electron] Windows Hello 创建失败，回退到浏览器 API:', e);
              return origCreate(options);
            }
          }
          return origCreate(options);
        };
      }

      // 覆盖 navigator.credentials.get
      if (navigator.credentials && navigator.credentials.get) {
        const origGet = navigator.credentials.get.bind(navigator.credentials);
        navigator.credentials.get = async function(options) {
          if (options && options.publicKey) {
            try {
              const result = await window.electronAPI.webauthnGet(options.publicKey);
              return result;
            } catch (e) {
              console.error('[Electron] Windows Hello 获取失败，回退到浏览器 API:', e);
              return origGet(options);
            }
          }
          return origGet(options);
        };
      }

      // 修改 isUserVerifyingPlatformAuthenticatorAvailable
      if (window.PublicKeyCredential) {
        const origIsUVPA = PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async function() {
          try {
            const available = await window.electronAPI.webauthnIsAvailable();
            if (available) return true;
            return origIsUVPA ? await origIsUVPA() : false;
          } catch {
            return origIsUVPA ? await origIsUVPA() : false;
          }
        };
      }

      console.log('[Electron] WebAuthn API 已覆盖，使用 Windows Hello 优先');
    })();
  `;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(script).catch(err => log('注入补丁错误: ' + err.message));
  }
};

const createWindow = async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    focusMainWindow();
    return mainWindow;
  }
  if (windowCreationPromise) {
    await windowCreationPromise;
    if (mainWindow) {
      focusMainWindow();
      return mainWindow;
    }
  }
  windowCreationPromise = (async () => {
    try {
      const winConfig = {
        ...CONFIG.WINDOW_CONFIG,
        webPreferences: {
          ...CONFIG.WINDOW_CONFIG.webPreferences,
          webSecurity: true,
          allowRunningInsecureContent: true,
          enableWebAuthn: true,
          sandbox: false,
          plugins: true,
          nodeIntegration: true,   // 启用 nodeIntegration 以便在渲染进程中使用 require('electron')
          contextIsolation: false,
        }
      };
      mainWindow = new BrowserWindow(winConfig);
      mainWindow.webContents.session.setPermissionRequestHandler((wc, perm, cb) => { cb(true); });
      mainWindow.webContents.session.setDevicePermissionHandler(() => true);

      let shown = false;
      mainWindow.once('ready-to-show', () => { if (!mainWindow.isDestroyed()) { mainWindow.show(); shown = true; } });

      mainWindow.webContents.on('did-fail-load', (e, code, desc, url) => {
        if (code === -102 && loadRetryCount < 3) {
          loadRetryCount++;
          setTimeout(() => { if (mainWindow) mainWindow.loadURL(TARGET_URL).catch(() => { }); }, 2000);
          return;
        }
        if (!shown) mainWindow.show();
        mainWindow.loadURL(`data:text/html;charset=utf-8,<h2>加载失败</h2><p>${desc}</p><p>URL: ${url}</p>`);
      });
      mainWindow.webContents.on('did-finish-load', () => { injectPatch(); });

      await mainWindow.loadURL(TARGET_URL);
      loadRetryCount = 0;
      setTimeout(() => { if (mainWindow && !mainWindow.isVisible()) mainWindow.show(); }, 3000);
      mainWindow.on('closed', () => { mainWindow = null; });
      return mainWindow;
    } catch (err) {
      log('创建窗口失败: ' + err.message);
      emergencyLog('窗口创建失败: ' + err.message);
      app.quit();
    } finally { windowCreationPromise = null; }
  })();
  return windowCreationPromise;
};

const startServer = async () => {
  if (!CONFIG.AUTO_START_SERVER) return;
  const serverPath = path.join(__dirname, CONFIG.SERVER_PATH);
  if (!fs.existsSync(serverPath)) { log('服务器文件不存在: ' + serverPath); return; }

  let port = 7296;
  try { port = parseInt(new URL(CONFIG.APP_URL).port) || 7296; } catch (_) { }
  await ensurePortFree(port);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const env = { ...process.env, NODE_PATH: path.join(__dirname, 'node_modules') };
    serverProcess = spawn('node', [serverPath], { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env });
    serverProcess.stdout.on('data', d => log('服务器 stdout: ' + d.toString().trim()));
    serverProcess.stderr.on('data', d => log('服务器 stderr: ' + d.toString().trim()));
    serverProcess.on('error', err => log('服务器进程错误: ' + err.message));
    serverProcess.unref();

    const ready = await waitForServer(port, 30000);
    if (ready) return;

    log(`服务器未就绪 (尝试 ${attempt}/3),重试...`);
    killServerProcess();
    await sleep(2000);
    await ensurePortFree(port);
  }
  log('服务器启动失败,继续加载窗口（可能无法访问）');
};

const setupMenu = () => {
  const template = CONFIG.MENU_TEMPLATE;
  if (!template || template.length === 0) return;
  const proc = template.map(item => {
    if (item.submenu) {
      item.submenu = item.submenu.map(sub => {
        if (sub.click && typeof sub.click === 'string') {
          try { sub.click = eval(sub.click) } catch (_) { }
        }
        return sub;
      });
    }
    return item;
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(proc));
};

app.whenReady().then(async () => {
  setupMenu();

  const depsOk = await ensureDependencies();
  if (!depsOk) {
    log('依赖安装失败，但将继续尝试启动服务器（可能失败）');
  }
  await startServer();
  await createWindow();
});

app.on('window-all-closed', () => {
  log('所有窗口已关闭');
  if (CONFIG.AUTO_KILL_SERVER) killServerProcess();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else if (mainWindow) mainWindow.focus();
});

process.on('uncaughtException', (err) => {
  const msg = '未捕获异常: ' + err.message + '\n' + err.stack;
  log(msg);
  emergencyLog(msg);
  app.quit();
});

app.on('will-quit', () => killServerProcess());