import path from 'path';
import fs from 'fs';

/**
 * Get the data directory for the application.
 * Prioritizes DATA_DIR env var (set by Electron), falls back to process.cwd()/data
 */
export function getDataDir(): string {
  let dir = process.env.DATA_DIR;
  
  if (!dir) {
    // Default for local dev: ./data
    dir = path.join(process.cwd(), 'data');
  }
  
  // Ensure it exists
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.warn('Failed to create data dir:', e);
    }
  }
  
  return dir;
}

/**
 * Get the path to the wallet file
 */
export function getWalletPath(): string {
  // If we are in Electron/Prod, DATA_DIR points to ".../Application Support/Canopi"
  // We can put the wallet directly there or in a 'data' subdir.
  // To match previous logic, let's look for it in the root of the data dir.
  return path.join(getDataDir(), 'wallet.enc.json');
}
