/**
 * Position Recovery Script
 * Use this to manually add back a lost position
 */

import { positionManager } from '../core/position-manager';
import { Position, ExitStrategy } from '../types';

/**
 * Manually add a position
 *
 * Usage:
 * 1. Edit the values below to match your position
 * 2. Run: npx ts-node src/scripts/recover-position.ts
 */

const recoverPosition = () => {
  // EDIT THESE VALUES FOR YOUR ZERA POSITION
  const position: Position = {
    mint: 'YOUR_ZERA_TOKEN_MINT_ADDRESS',           // Replace with Zera token mint
    walletPublicKey: 'YOUR_WALLET_PUBLIC_KEY',      // Replace with your wallet
    entryTime: Date.now() - (5 * 60 * 1000),       // Replace with when you bought (5 min ago example)
    entryPrice: 0.001,                              // Replace with your buy price in USD
    tokenAmount: 1000,                              // Replace with how many tokens you have
    solSpent: 0.1,                                  // Replace with how much SOL you spent
    exitStagesCompleted: 0,                         // Starts at 0
    strategy: 'moderate' as ExitStrategy,           // The strategy you used
    isPercentageBased: false,                       // moderate is time-based
    highestProfit: 0,                               // Will be calculated
    status: 'active',
    currentPrice: undefined,
    currentProfit: undefined
  };

  // Add the position
  positionManager.addPosition(position);

  console.log('✅ Position recovered successfully!');
  console.log('Position details:', position);
  console.log('\nThe position has been saved to disk and will persist across restarts.');
  console.log('Check your Active Positions in the dashboard!');
};

// Run the recovery
recoverPosition();
