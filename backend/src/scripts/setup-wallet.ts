/**
 * Wallet Setup Script
 * Encrypts a private key and saves it to disk
 * Usage: npx tsx src/scripts/setup-wallet.ts
 */

import readline from 'readline';
import path from 'path';
import { encrypt, saveEncryptedWallet } from '../utils/security.util';
import { getWalletPath } from '../utils/paths.util';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Path to wallet file
const WALLET_FILE = getWalletPath();

async function question(query: string): Promise<string> {

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n\uD83D\uDD10 Secure Wallet Setup');
console.log('======================');
console.log('This script will encrypt your private key and save it to disk.');
console.log('You will need to provide a password to run the bot.\n');

// Helper to prompt securely (simulated, node readline doesn't hide input well by default)
const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
  try {
    const mode = await question('🔑 Do you want to (1) Enter existing key or (2) Generate NEW wallet? [1/2]: ');
    
    let keypair: Keypair;

    if (mode === '2') {
       console.log('\n🎲 Generating new Solana wallet...');
       keypair = Keypair.generate();
       console.log('================================================================');
       console.log('✅ NEW WALLET GENERATED');
       console.log(`Public Key (Address):  ${keypair.publicKey.toString()}`);
       console.log(`Private Key (Base58):  ${bs58.encode(keypair.secretKey)}`);
       console.log(`Private Key (Array):   [${keypair.secretKey.toString()}]`);
       console.log('================================================================');
       console.log('⚠️  IMPORTANT: SAVE THESE KEYS NOW! They will be encrypted and hidden after this step.');
       
       const saved = await question('Have you saved these keys safely? (yes/no): ');
       if (saved.toLowerCase() !== 'yes') {
          console.log('❌ Aborted. Please run again when ready to save keys.');
          process.exit(1);
       }
       
    } else {
       const privateKeyInput = await question('🔑 Enter your Private Key (Base58 string): ');
       // Validate key
        try {
          if (privateKeyInput.startsWith('[') && privateKeyInput.endsWith(']')) {
             keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(privateKeyInput)));
          } else {
             keypair = Keypair.fromSecretKey(bs58.decode(privateKeyInput));
          }
          console.log(`\n✅ Valid key for wallet: ${keypair.publicKey.toString()}`);
        } catch (e) {
          console.error('\n❌ Invalid private key format.');
          process.exit(1);
        }
    }

    const password = await question('\n🔒 Set a strong password for this wallet: ');
    if (password.length < 4) {
      console.error('❌ Password too short.');
      process.exit(1);
    }

    const confirm = await question('🔒 Confirm password: ');
    if (password !== confirm) {
      console.error('❌ Passwords do not match.');
      process.exit(1);
    }

    console.log('\nEncrypting...');
    // Always encrypt the Base58 string of the keypair we have in memory
    const secretKeyBase58 = bs58.encode(keypair.secretKey);
    const encryptedData = encrypt(secretKeyBase58, password);
    
    saveEncryptedWallet(encryptedData, WALLET_FILE);
    
    console.log(`\n\u2705 Encrypted wallet saved to: ${WALLET_FILE}`);
    console.log('\n🚀 TO RUN THE BOT:');
    console.log('------------------');
    console.log('1. Remove WALLET_PRIVATE_KEY from your .env file (it is no longer needed there)');
    console.log('2. Run: export WALLET_PASSWORD="' + password + '"');
    console.log('3. Run: npm run dev');
    console.log('\n(Or pass it inline: WALLET_PASSWORD=yourpassword npm run dev)');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    rl.close();
  }
}

main();
