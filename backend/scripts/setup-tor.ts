import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Put bin inside backend directory so it's self-contained
const BIN_DIR = path.join(__dirname, '../bin');
const TOR_LINK = path.join(BIN_DIR, 'tor');

// Ensure bin directory exists
if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

function getTorPath(): string | null {
  try {
    const output = execSync('which tor', { encoding: 'utf-8' }).trim();
    return output;
  } catch (e) {
    return null;
  }
}

function installTor() {
  console.log('🧅 Tor binary not found in PATH.');
  
  if (process.platform === 'darwin') {
    console.log('🍎 macOS detected. Attempting to install via Homebrew...');
    try {
      execSync('brew install tor', { stdio: 'inherit' });
      console.log('✅ Tor installed via Homebrew.');
    } catch (e) {
      console.error('❌ Failed to install Tor via Homebrew.');
      console.error('👉 Please run "brew install tor" manually.');
      process.exit(1);
    }
  } else if (process.platform === 'linux') {
    console.log('🐧 Linux detected. Please install Tor via your package manager.');
    console.log('👉 Ubuntu/Debian: sudo apt-get install tor');
    process.exit(1);
  } else {
    console.error('❌ Unsupported platform for auto-install.');
    console.error('👉 Please install Tor manually and ensure it is in your PATH.');
    process.exit(1);
  }
}

async function main() {
  console.log('🔍 Checking for Tor...');
  
  let torPath = getTorPath();
  
  if (!torPath) {
    installTor();
    torPath = getTorPath();
  }

  if (!torPath) {
    console.error('❌ Tor verification failed after install attempt.');
    process.exit(1);
  }

  console.log(`✅ Tor found at: ${torPath}`);
  
  // Symlink to local bin for consistency
  try {
    if (fs.existsSync(TOR_LINK)) {
      fs.unlinkSync(TOR_LINK);
    }
    fs.symlinkSync(torPath, TOR_LINK);
    console.log(`🔗 Linked to: ${TOR_LINK}`);
    console.log('🚀 Tor setup complete! The app can now manage the Tor process.');
  } catch (e: any) {
    console.error(`❌ Failed to link Tor binary: ${e.message}`);
  }
}

main().catch(console.error);
