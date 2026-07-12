import { app, BrowserWindow, Menu, shell, nativeTheme } from 'electron';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
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
const require = createRequire(import.meta.url),
  __dirname = path.dirname(fileURLToPath(import.meta.url)), execPromise = promisify(exec),
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
  PROGRESS_HTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>正在安装依赖...</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: #2b49a1;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        padding: 20px;
      }
      .container {
        max-width: 800px;
        width: 100%;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        height: 80vh;
      }
      .header {
        padding: 20px 28px 16px;
        background: #2c3e50;
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .header h1 { font-weight: 500; font-size: 20px; letter-spacing: 0.3px; }
      .status-bar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 28px;
        background: #1f2a66;
        border-bottom: 1px solid #302b2b;
        font-size: 14px;
        color: #d4d4d4;
      }
      #status-text { font-weight: 500; }
      #timer { margin-left: auto; font-family: monospace; background: #110606; padding: 2px 10px; border-radius: 12px; }
      .log-area {
        flex: 1;
        padding: 16px 24px;
        overflow-y: auto;
        background: #1e1e1e;
        color: #d4d4d4;
        font-family: 'Cascadia Code', 'Fira Code', monospace;
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-all;
      }
      .log-area .timestamp { color: #888; margin-right: 8px; }
      .log-area .info { color: #4fc3f7; }
      .log-area .success { color: #81c784; }
      .log-area .error { color: #e57373; }
      .log-area .warn { color: #ffb74d; }
    </style>
  </head>
  <body>
  <div class="container">
    <div class="header"><h1>首次启动环境准备</h1></div>
    <div class="status-bar">
      <span id="status-text">正在初始化…</span>
      <span id="timer">已用时: 00:00</span>
    </div>
    <div class="log-area" id="log"></div>
  </div>
  <script>
    const logEl = document.getElementById('log');
    function appendLog(message, type = 'info') {
      const line = document.createElement('div'), time = new Date().toLocaleTimeString(),
       spanTime = document.createElement('span');
      spanTime.className = 'timestamp', spanTime.textContent = '[' + time + '] ';
      const spanMsg = document.createElement('span');
      spanMsg.className = type, spanMsg.textContent = message;
      line.appendChild(spanTime), line.appendChild(spanMsg);
      logEl.appendChild(line), logEl.scrollTop = logEl.scrollHeight;
    }
    window.appendLog = appendLog;

    // 计时器
    let timerInterval = null, seconds = 0;
    function updateTimerDisplay(sec) {
      const mins = Math.floor(sec / 60), secs = sec % 60;
      document.getElementById('timer').textContent = '已用时: ' + String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0');
    }

    function startTimer() {
      seconds = 0, updateTimerDisplay(0);
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        seconds++, updateTimerDisplay(seconds);
      }, 1000);
    }

    function stopTimer() {
      if (timerInterval) clearInterval(timerInterval), timerInterval = null;
    }

    // 静态文字（无省略号）
    function setStatusText(text) {
      if (window.ellipsisInterval) clearInterval(window.ellipsisInterval), window.ellipsisInterval = null;
      document.getElementById('status-text').textContent = text;
      if (text.includes('失败')) document.getElementById('status-text').style.color = '#e57373';
       else document.getElementById('status-text').style.color = '#d4d4d4';
    }

    // 动态省略号（统一动画）
    let ellipsisInterval = null;
    function startEllipsis(text) {
      if (ellipsisInterval) clearInterval(ellipsisInterval), ellipsisInterval = null;
      const statusEl = document.getElementById('status-text');
      let dots = 0;
      statusEl.textContent = text + ' ', statusEl.style.color = '#d4d4d4';
      ellipsisInterval = setInterval(() => {
        dots = (dots % 6) + 1, statusEl.textContent = text + ' ' + '.'.repeat(dots);
      }, 500);
    }

    function stopEllipsis() {
      if (ellipsisInterval) clearInterval(ellipsisInterval), ellipsisInterval = null;
    }

    window.startTimer = startTimer, window.stopTimer = stopTimer, window.setStatusText = setStatusText;
    window.startEllipsis = startEllipsis, window.stopEllipsis = stopEllipsis;
  </script>
  </body>
  </html>`,
  // --------------------- 工具函数 ---------------------
  safeExecuteJS = (win, code) => {
    if (win && !win.isDestroyed()) win.webContents.executeJavaScript(code).catch(() => { });
  },
  startTimerInWin = win => safeExecuteJS(win, 'startTimer()'),
  stopTimerInWin = win => safeExecuteJS(win, 'stopTimer()'),
  startEllipsisInWin = (win, text) => safeExecuteJS(win, `startEllipsis(${JSON.stringify(text)})`),
  stopEllipsisInWin = win => safeExecuteJS(win, 'stopEllipsis()'),
  setStatusTextInWin = (win, text) => safeExecuteJS(win, `setStatusText(${JSON.stringify(text)})`),
  writeLog = (filePath, msg) => {
    try { fs.appendFileSync(filePath, new Date().toISOString() + ' ' + msg + '\n'); } catch (_) { }
  },
  log = msg => {
    if (!CONFIG.LOGGING_ENABLED) return;
    writeLog(path.join(app.getPath('desktop'), 'myapp_debug.log'), msg);
  },
  // 执行焦点检查
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
  // 精准焦点恢复（执行失焦+聚焦+重置标记并进入冷却）
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
    // 窗口聚焦时,仅当从失焦状态恢复且未冷却时才执行恢复
    mainWindow.on('focus', () => {
      if (windowHadFocus && !focusRestoreCooldown) {
        if (focusRestoreTimer) clearTimeout(focusRestoreTimer);
        focusRestoreTimer = setTimeout(() => {
          focusRestoreTimer = null, performFocusRestore();
        }, 150);
      }
    });
    // 首次显示后,若窗口已聚焦,标记为曾聚焦
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
  },
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  // 依赖安装
  installDependenciesWithProgress = async (onProgress, win) => {
    startTimerInWin(win);
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    try {
      return await fs.promises.access(nodeModulesPath, fs.constants.F_OK), true;
    } catch (_) { }

    onProgress('未找到 node_modules,开始安装依赖...', 'warn');
    const depsPath = path.join(__dirname, 'deps.json');
    try {
      await fs.promises.access(depsPath, fs.constants.F_OK);
    } catch {
      return onProgress('错误: deps.json 不存在,无法安装依赖', 'error'), stopTimerInWin(win), false;
    }

    let deps;
    try {
      const depsContent = await fs.promises.readFile(depsPath, 'utf-8');
      deps = JSON.parse(depsContent);
    } catch (err) {
      return onProgress('读取 deps.json 失败: ' + err.message, 'error'), stopTimerInWin(win), false;
    }

    const pkgPath = path.join(__dirname, 'package.json');
    let pkg;
    try {
      const pkgContent = await fs.promises.readFile(pkgPath, 'utf-8');
      pkg = JSON.parse(pkgContent);
    } catch (err) {
      return onProgress('读取 package.json 失败: ' + err.message, 'error'), stopTimerInWin(win), false;
    }

    pkg.dependencies = deps, pkg.devDependencies = {};
    try {
      await fs.promises.writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8');
    } catch (err) {
      return onProgress('写入 package.json 失败: ' + err.message, 'error'), stopTimerInWin(win), false;
    }

    let cmd = 'install';
    const lockPath = path.join(__dirname, 'package-lock.json');
    try {
      await fs.promises.access(lockPath, fs.constants.F_OK);
      cmd = 'ci', onProgress('找到 package-lock.json,使用 npm ci', 'info');
    } catch {
      onProgress('未找到 package-lock.json,使用 npm install', 'info');
    }

    const args = [cmd, '--no-optional', '--force', '--no-audit', '--no-fund'],
      env = { ...process.env, npm_config_ignore_scripts: 'true', npm_config_optional: 'false' };

    onProgress(`执行 npm ${args.join(' ')} ...`, 'info');
    return new Promise(resolve => {
      const proc = spawn('npm', args, { cwd: __dirname, env, shell: true });

      proc.stdout.on('data', data => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        for (const line of lines) onProgress(line, 'info');
      });

      proc.stderr.on('data', data => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        for (const line of lines) onProgress('[stderr] ' + line, 'warn');
      });

      let timeoutId = setTimeout(() => {
        proc.kill(), onProgress('安装超时（120秒）,终止进程;', 'error'), stopTimerInWin(win), resolve(false);
      }, 120000);

      proc.on('close', async code => {
        clearTimeout(timeoutId);
        if (code !== 0) return onProgress(`npm 安装失败,退出码 ${code}`, 'error'), stopTimerInWin(win), resolve(false);
        onProgress('npm 安装完成,正在清理...', 'info');
        try {
          const entries = await fs.promises.readdir(nodeModulesPath, { withFileTypes: true }), toDelete = [];
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const name = entry.name;
            if (name === 'node') toDelete.push(path.join(nodeModulesPath, name));
            if (/^node-(win|darwin|linux|freebsd|sunos|aix)-/.test(name)) toDelete.push(path.join(nodeModulesPath, name));
          }
          for (const dir of toDelete) {
            await fs.promises.rm(dir, { recursive: true, force: true }), onProgress(`已删除问题目录: ${dir}`, 'info');
          }
        } catch (cleanErr) {
          onProgress('清理目录时出错（可忽略）: ' + cleanErr.message, 'warn');
        }

        try {
          await fs.promises.access(nodeModulesPath, fs.constants.F_OK), resolve(true);
        } catch {
          onProgress('安装后 node_modules 仍然不存在', 'error'), stopTimerInWin(win), resolve(false);
        }
      });

      proc.on('error', err => {
        clearTimeout(timeoutId), onProgress('启动npm进程失败:' + err.message, 'error'), stopTimerInWin(win), resolve(false);
      });
    });
  },
  ensurePortFree = port => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', err => {
        if (err.code === 'EADDRINUSE') {
          const cmd = process.platform === 'win32' ? `netstat -ano | findstr :${port}` : `lsof -i :${port} -t`;
          exec(cmd, (err, stdout) => {
            if (err) return resolve(false);
            const pids = stdout.split(/\s+/).filter(x => x && !isNaN(x));
            let killed = false;
            for (const pid of pids)
              try { process.kill(parseInt(pid), 'SIGTERM'), killed = true; } catch (_) { };
            setTimeout(() => resolve(killed), 1000);
          });
        }
        else resolve(false);
      });
      server.once('listening', () => { server.close(), resolve(true); });
      server.listen(port, '127.0.0.1');
    });
  },
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
  openInBrowser = () => {
    try {
      shell.openExternal(CONFIG.APP_URL);
    } catch (e) { log('打开浏览器失败: ' + e.message) }
  },
  startServer = async onProgress => {
    if (!CONFIG.AUTO_START_SERVER) return true;
    const serverPath = path.join(__dirname, CONFIG.SERVER_PATH);
    if (!fs.existsSync(serverPath)) {
      if (onProgress) onProgress('服务器文件不存在: ' + serverPath, 'error');
      return false;
    }

    let port = 7296;
    try { port = parseInt(new URL(CONFIG.APP_URL).port) || 7296 } catch (_) { }
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (onProgress) onProgress(`正在清理端口 ${port}（尝试 ${attempt}/3）...`, 'info');
      await ensurePortFree(port);

      if (onProgress) onProgress(`正在启动服务器进程...`, 'info');
      const env = { ...process.env, NODE_PATH: path.join(__dirname, 'node_modules') };
      serverProcess = spawn('node', [serverPath], { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env });
      serverProcess.stdout.on('data', d => log('服务器 stdout: ' + d.toString().trim()));
      serverProcess.stderr.on('data', d => log('服务器 stderr: ' + d.toString().trim()));
      serverProcess.on('error', err => log('服务器进程错误: ' + err.message));
      serverProcess.unref();

      if (onProgress) onProgress(`等待服务器就绪（端口 ${port}）...`, 'info');
      const ready = await waitForServer(port, 30000);
      if (ready) {
        if (onProgress) onProgress('服务器已就绪 ✓', 'success');
        return true;
      }
      log(`服务器未就绪 (尝试 ${attempt}/3),重试...`), killServerProcess(), await sleep(2000);
    }

    if (onProgress) onProgress('❌ 服务器启动失败:多次尝试未响应', 'error');
    return false;
  },
  // 窗口创建
  createWindow = async (loadProgress = false) => {
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
            plugins: true, nodeIntegration: true,
            sandbox: false, contextIsolation: false,
          }
        };
        mainWindow = new BrowserWindow(winConfig);
        mainWindow.webContents.session.setPermissionRequestHandler((wc, perm, cb) => cb(true));
        mainWindow.webContents.session.setDevicePermissionHandler(() => true);
        mainWindow.once('ready-to-show', () => {
          if (!mainWindow.isDestroyed()) mainWindow.show(), mainWindow.focus(), mainWindow.webContents.focus();
        });

        if (loadProgress) {
          await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(PROGRESS_HTML)}`);
          await mainWindow.webContents.executeJavaScript('typeof window.appendLog === "function"');
        } else {
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
        }

        mainWindow.on('closed', () => mainWindow = null);
        return mainWindow;
      } catch (err) {
        log('创建窗口失败: ' + err.message), app.quit();
      } finally { windowCreationPromise = null }
    })();
    return windowCreationPromise;
  },
  // 菜单设置
  setupMenu = () => {
    const template = CONFIG.MENU_TEMPLATE;
    if (!template || template.length === 0) return;

    // 递归处理菜单项：__TOGGLE_BROWSER__ 和字符串函数
    const processMenu = items => {
      return items.map(item => {
        const newItem = { ...item };
        if (newItem.submenu) newItem.submenu = processMenu(newItem.submenu);
        if (newItem.click === '__TOGGLE_BROWSER__') newItem.click = openInBrowser;
        else if (typeof newItem.click === 'string' &&
          /^(async\s+)?(function\s*(\w*\s*)?\(|\(\)\s*=>|async\s*\(\)\s*=>)/.test(newItem.click.trim())) {
          try { newItem.click = eval(newItem.click); } catch (_) { }
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
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  let depsExist = false;
  try {
    await fs.promises.access(nodeModulesPath, fs.constants.F_OK), depsExist = true;
  } catch (_) { }

  if (depsExist) await startServer(), await createWindow(false);
  else {
    const win = await createWindow(true);
    startEllipsisInWin(win, '正在安装依赖');

    const updateProgress = (msg, type = 'info') =>
      safeExecuteJS(win, `appendLog(${JSON.stringify(msg)}, ${JSON.stringify(type)})`),
      depsOk = await installDependenciesWithProgress(updateProgress, win);
    if (!depsOk) {
      updateProgress('依赖安装失败,应用可能无法正常运行', 'error'), stopEllipsisInWin(win);
      return setStatusTextInWin(win, '依赖安装失败');
    }

    startEllipsisInWin(win, '依赖安装成功,正在启动服务器');
    const serverOk = await startServer(updateProgress);
    if (!serverOk) {
      stopTimerInWin(win), stopEllipsisInWin(win), setStatusTextInWin(win, '🚫 服务器启动失败');
      return updateProgress('❌ 服务器启动失败,请退出并检查日志', 'error');
    }
    await win.loadURL(TARGET_URL);
  }
  startFocusRestore();
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
  log(msg), app.quit();
});
app.on('will-quit', () => {
  killServerProcess(), stopFocusRestore();
});