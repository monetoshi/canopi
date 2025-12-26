const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Global reference to prevent garbage collection
let mainWindow;
let backendProcess;

const isDev = process.env.NODE_ENV !== 'production';
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 3000;

// Determine where to store user data (database, wallet keys)
// On macOS: ~/Library/Application Support/CanopiTradingBot
const userDataPath = app.getPath('userData');
console.log('[Electron] User Data Path:', userDataPath);

function startBackend() {
  console.log('[Electron] Starting Backend...');
  
  // In Dev: Run ts-node directly
  // In Prod: Run the compiled node script
  const backendCmd = isDev ? 'npx' : 'node';
  const backendArgs = isDev 
    ? ['ts-node', path.join(__dirname, '../backend/src/index.ts')] 
    : [path.join(__dirname, '../backend/dist/index.js')];

  const env = { 
    ...process.env, 
    PORT: BACKEND_PORT,
    DATA_DIR: userDataPath, // Tell backend to save DB here
    NODE_ENV: isDev ? 'development' : 'production'
  };

  backendProcess = spawn(backendCmd, backendArgs, {
    cwd: path.join(__dirname, '../backend'),
    env,
    shell: true,
    stdio: 'pipe'
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend Error] ${data}`);
  });
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
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });
}

app.whenReady().then(() => {
  // In development, the backend is started separately via concurrently 
  // so you can see logs in the terminal.
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