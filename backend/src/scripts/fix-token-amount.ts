/**
 * Fix Token Amount Script
 * Updates tokenAmount for positions that have 0 tokens
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey } from '@solana/web3.js';

const POSITIONS_FILE = path.join(__dirname, '../../data/positions.json');
const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

/**
 * Fix token amounts by checking actual wallet balance
 */
async function fixTokenAmounts() {
  try {
    console.log('🔧 Fixing token amounts for positions...\n');

    // Load positions
    if (!fs.existsSync(POSITIONS_FILE)) {
      console.log('❌ No positions file found at:', POSITIONS_FILE);
      return;
    }

    const data = fs.readFileSync(POSITIONS_FILE, 'utf-8');
    const positions = JSON.parse(data);

    console.log(`Found ${positions.length} positions\n`);

    const connection = new Connection(RPC_ENDPOINT);

    // Update each position with 0 tokenAmount
    for (const position of positions) {
      if (position.tokenAmount === 0 && position.status === 'active') {
        console.log(`📊 Position: ${position.mint.slice(0, 8)}...`);
        console.log(`   Wallet: ${position.walletPublicKey.slice(0, 8)}...`);
        console.log(`   SOL Spent: ${position.solSpent}`);

        try {
          // Get token accounts for this wallet
          const walletPubkey = new PublicKey(position.walletPublicKey);
          const tokenMintPubkey = new PublicKey(position.mint);

          // Get token accounts
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            walletPubkey,
            { mint: tokenMintPubkey }
          );

          if (tokenAccounts.value.length > 0) {
            const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
            position.tokenAmount = balance;
            console.log(`   ✅ Updated tokenAmount to: ${balance.toLocaleString()}`);
          } else {
            // Estimate from price if no token account found
            if (position.entryPrice > 0) {
              const estimated = position.solSpent / position.entryPrice;
              position.tokenAmount = estimated;
              console.log(`   ⚠️  No token account found, estimated: ${estimated.toLocaleString()}`);
            } else {
              console.log(`   ❌ Cannot fix - no token account and no entry price`);
            }
          }
        } catch (error) {
          console.log(`   ❌ Error fetching balance:`, error);
        }

        console.log('');
      }
    }

    // Save updated positions
    fs.writeFileSync(POSITIONS_FILE, JSON.stringify(positions, null, 2));
    console.log('✅ Positions file updated!\n');
    console.log('Restart your backend server to load the updated positions.');

  } catch (error) {
    console.error('Error fixing token amounts:', error);
  }
}

// Run the fix
fixTokenAmounts();
