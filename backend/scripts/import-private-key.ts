import * as readline from 'readline';
import { encrypt, saveEncryptedWallet } from '../src/utils/security.util';
import { getWalletPath } from '../src/utils/paths.util';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('\n--- Canopi Wallet Import Utility ---');
  console.log('This script will encrypt your private key and save it to the bot\'s data directory.');

  try {
    const privateKey = await question('\nEnter your Private Key (Base58 or [1,2,3...] format): ');
    if (!privateKey) {
      console.error('Error: Private key is required.');
      process.exit(1);
    }

    // Validate key
    let keypair: Keypair;
    try {
      if (privateKey.trim().startsWith('[')) {
        keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(privateKey)));
      } else {
        keypair = Keypair.fromSecretKey(bs58.decode(privateKey.trim()));
      }
      console.log(`Verified Wallet Address: ${keypair.publicKey.toString()}`);
    } catch (e) {
      console.error('Error: Invalid private key format.');
      process.exit(1);
    }

    const password = await question('Enter a Password to protect this wallet: ');
    if (!password || password.length < 8) {
      console.error('Error: Password must be at least 8 characters.');
      process.exit(1);
    }

    const confirmPassword = await question('Confirm Password: ');
    if (password !== confirmPassword) {
      console.error('Error: Passwords do not match.');
      process.exit(1);
    }

    // Encrypt
    const encrypted = encrypt(privateKey.trim(), password);
    
    // Get path
    const walletPath = getWalletPath();
    
    // Save
    saveEncryptedWallet(encrypted, walletPath);
    
    console.log(`\n✅ Success! Wallet encrypted and saved to: ${walletPath}`);
    console.log('\nIMPORTANT NEXT STEPS:');
    console.log('1. If you have WALLET_PRIVATE_KEY in your .env, REMOVE IT.');
    console.log('2. Set WALLET_PASSWORD=your_password in your .env so the bot can unlock it.');
    console.log('3. Restart the bot.');

  } catch (error: any) {
    console.error(`\nAn error occurred: ${error.message}`);
  } finally {
    rl.close();
  }
}

main();
