const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const { spawn, fork } = require('child_process');
const fs = require('fs');

// Global reference to prevent garbage collection
let mainWindow;
let backendProcess;

// Robust check for development vs production
const isDev = !app.isPackaged;
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 3000;

// Determine where to store user data (database, wallet keys)
// On macOS: ~/Library/Application Support/CanopiTradingBot
const userDataPath = app.getPath('userData');
const logFile = path.join(userDataPath, 'startup.log');

// Simple file logger
function log(msg) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
    console.log(msg);
  } catch (e) { console.error(e); }
}

log(`App starting. User Data: ${userDataPath}`);
log(`Is Dev: ${isDev}`);

function startBackend() {
  log('[Electron] Starting Backend...');
  
  // In production, we unpack the backend to app.asar.unpacked because fork() cannot run from ASAR
  const backendEntry = isDev 
    ? path.join(__dirname, '../backend/src/index.ts')
    : path.join(process.resourcesPath, 'app.asar.unpacked', 'backend/dist/index.js');

  log(`Backend Entry: ${backendEntry}`);

  if (!isDev && !fs.existsSync(backendEntry)) {
    log(`CRITICAL: Backend entry file not found at ${backendEntry}`);
    return;
  }

  const env = { 
    ...process.env, 
    PORT: BACKEND_PORT,
    DATA_DIR: userDataPath,
    NODE_ENV: isDev ? 'development' : 'production'
  };

  try {
    if (isDev) {
      log('Spawning backend via npx ts-node (Dev mode)');
      backendProcess = spawn('npx', ['ts-node', backendEntry], {
        cwd: path.join(__dirname, '../backend'),
        env,
        shell: true,
        stdio: 'pipe'
      });
    } else {
      log('Forking backend process (Production mode)');
      // fork is specialized for spawning node processes and handles the execPath automatically
      backendProcess = fork(backendEntry, [], {
        cwd: path.dirname(backendEntry),
        env,
        stdio: 'pipe'
      });
    }

    if (backendProcess.stdout) {
      backendProcess.stdout.on('data', (data) => {
        log(`[Backend] ${data}`);
      });
    }

    if (backendProcess.stderr) {
      backendProcess.stderr.on('data', (data) => {
        log(`[Backend Error] ${data}`);
      });
    }
    
    backendProcess.on('error', (err) => {
      log(`[Electron] Failed to start backend: ${err.message}`);
    });
    
    backendProcess.on('close', (code) => {
      log(`[Backend] Process exited with code ${code}`);
    });
  } catch (e) {
    log(`[Electron] Exception starting backend: ${e.message}`);
  }
}

function createWindow() {
  // Force dark mode for native elements (context menus, etc)
  nativeTheme.themeSource = 'dark';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, // Don't show the window until it's ready, prevents white flash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Canopi Trading Bot',
    backgroundColor: '#020617', // Deeper dark background (slate-950)
    titleBarStyle: 'hiddenInset', // Modern macOS look with traffic lights inset
  });

  const url = isDev 
    ? `http://localhost:${FRONTEND_PORT}` 
    : `file://${path.join(__dirname, '../frontend/out/index.html')}`;

  console.log('[Electron] Loading URL:', url);
  mainWindow.loadURL(url);

  // Only show the window when it's ready to prevent visual glitches
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Only open DevTools in development mode
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });
}

app.whenReady().then(() => {
  // Only start the backend manually in production
  // In dev, "npm run desktop" starts it separately
  if (!isDev) {
    startBackend();
  }
  
  // Wait a moment for backend to spin up before showing window
  setTimeout(createWindow, isDev ? 500 : 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  // Kill backend when app closes
  if (backendProcess) {
    console.log('[Electron] Killing backend process...');
    backendProcess.kill();
  }
});
