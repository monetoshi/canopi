
import { getWalletKeypair } from './src/utils/blockchain.util';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config();

async function checkWallet() {
  console.log('--- Checking Active Wallet ---');
  try {
    const wallet = getWalletKeypair();
    if (wallet) {
        console.log(`Active Wallet Public Key: ${wallet.publicKey.toString()}`);
    } else {
        console.log('No active wallet found (getWalletKeypair returned null).');
    }
    
    // Also print where it might be looking
    console.log(`Current Working Directory: ${process.cwd()}`);
    console.log(`Node Environment: ${process.env.NODE_ENV}`);
    
  } catch (error: any) {
    console.error('Error checking wallet:', error.message);
  }
}

checkWallet();
