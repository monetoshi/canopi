/**
 * Solana Trading Bot - Exit Executor Service
 * Monitors positions and creates pending sells when exit conditions are met
 */

import { positionManager } from '../core/position-manager';
import { pendingSellsManager } from '../core/pending-sells-manager';
import { jupiterService } from './jupiter.service';
import { Position } from '../types';
import { PublicKey, VersionedTransaction, Keypair } from '@solana/web3.js';
import { getWalletKeypair, getConnection } from '../utils/blockchain.util';
import { taxService } from './tax.service';
import { priceService } from './price.service';
import { privacyService } from './privacy.service';
import { ephemeralWalletManager } from '../core/ephemeral-wallet-manager';
import { telegramNotifier } from './telegram-notifier';

const SLIPPAGE_BPS = 300; // 3% slippage for auto-exits (more generous to ensure execution)

/**
 * Exit Executor Service
 * Continuously monitors positions and creates pending sells for user approval
 * when exit conditions are met (stop loss, take profit, exit stages, etc.)
 */
export class ExitExecutor {
  private isRunning = false;

  /**
   * Check all active positions for exit conditions
   * This should be called from the WebSocket price update loop
   */
  async checkPositionsForExits(positions: Position[], currentPrices: Map<string, number>): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      for (const position of positions) {
        // Skip if not active
        if (position.status !== 'active') {
          continue;
        }

        // Get current price
        const currentPrice = currentPrices.get(position.mint);
        if (!currentPrice) {
          continue;
        }

        // Check if exit conditions are met
        const exitCheck = positionManager.checkExitConditions(position, currentPrice);

        if (exitCheck.shouldExit) {
          await this.createPendingSell(position, currentPrice, exitCheck.percentage, exitCheck.reason);
        }
      }

      // Expire old pending sells every check
      await pendingSellsManager.expireOldPendingSells();
    } catch (error) {
      console.error('[ExitExecutor] Error checking positions for exits:', error);
    }
  }

  /**
   * Create a pending sell for user approval
   */
  private async createPendingSell(
    position: Position,
    currentPrice: number,
    sellPercentage: number,
    reason: string
  ): Promise<void> {
    try {
      // Check if we already have a pending sell for this position
      const existingPendingSells = pendingSellsManager.getPendingSellsByToken(position.mint)
        .filter(ps => ps.walletPublicKey === position.walletPublicKey && ps.status === 'pending');

      if (existingPendingSells.length > 0) {
        // ... (existing debounce logic) ...
        const existingSell = existingPendingSells[0];
        const age = Date.now() - existingSell.createdAt;
        const BLOCKHASH_LIFETIME = 90000;

        if (age > BLOCKHASH_LIFETIME) {
           await pendingSellsManager.cancel(existingSell.id);
        } else {
           return;
        }
      }

      console.log(`[ExitExecutor] 🎯 EXIT CONDITION MET!`);
      console.log(`[ExitExecutor] Reason: ${reason}`);
      console.log(`[ExitExecutor] Sell Percentage: ${sellPercentage}%`);

      // Calculate amounts
      const tokenAmount = (position.tokenAmount * sellPercentage) / 100;
      const SOL_MINT = 'So11111111111111111111111111111111111111112';

      // Get Quote
      const quote = await jupiterService.getQuote(
        position.mint,
        SOL_MINT,
        Math.floor(tokenAmount), // Note: Need to check decimals here properly in real world
        SLIPPAGE_BPS
      );

      // Get Swap Transaction
      const swapData = await jupiterService.getSwapTransaction(quote, position.walletPublicKey);
      if (!swapData || !swapData.swapTransaction) {
        console.error(`[ExitExecutor] Failed to prepare sell transaction`);
        return;
      }
      
      const expectedOutput = Number(quote.outAmount) / 1e9;
      
      // AUTO-EXECUTION CHECK (Bot Wallet or Ephemeral Wallet)
      const botWallet = getWalletKeypair();
      let signer: Keypair | null = null;

      if (position.isPrivate && position.executionWallet) {
        // Use ephemeral wallet for private positions
        const password = process.env.WALLET_PASSWORD || '';
        signer = ephemeralWalletManager.getWallet(position.executionWallet, password);
      } else if (botWallet && botWallet.publicKey.toString() === position.walletPublicKey) {
        // Use bot wallet for standard bot positions
        signer = botWallet;
      }

      if (signer) {
         console.log(`[ExitExecutor] 🤖 Auto-executing EXIT... ${position.isPrivate ? '(PRIVATE)' : ''}`);
         
         try {
             const connection = getConnection();
             
             // Sign
             const txBuffer = Buffer.from(swapData.swapTransaction, 'base64');
             const transaction = VersionedTransaction.deserialize(txBuffer);
             transaction.sign([signer]);
             
             // Send
             const signature = await connection.sendRawTransaction(transaction.serialize(), {
               skipPreflight: false,
               maxRetries: 3
             });
             
             console.log(`[ExitExecutor] ✅ Transaction sent: ${signature}`);
             
             // Notify Telegram
             try {
               await telegramNotifier.notifyExitTriggered(position, reason, signature);
             } catch (e: any) { console.error('Telegram error', e); }

             // Update State
             if (sellPercentage >= 100) {
               await positionManager.closePosition(position.walletPublicKey, position.mint);
             } else {
               await positionManager.incrementExitStage(position.walletPublicKey, position.mint);
             }

             // PRIVATE RECLAIM: If private, deposit resulting SOL back to shield
             if (position.isPrivate) {
               try {
                 console.log(`[ExitExecutor] 🛡️ Reclaiming ${expectedOutput.toFixed(4)} SOL to shielded pool...`);
                 // Small delay to ensure SOL balance is updated
                 setTimeout(async () => {
                   try {
                    await privacyService.shieldFunds(expectedOutput - 0.001, signer!);
                    console.log(`[ExitExecutor] ✅ Reclaimed to shield`);
                   } catch (e: any) { console.error(`[ExitExecutor] Reclaim failed:`, e.message); }
                 }, 5000);
               } catch (e: any) { console.error(`[ExitExecutor] Reclaim setup failed:`, e.message); }
             }
             
             // Record Tax
             try {
                const estimatedFee = 0.000005;
                const solPrice = await priceService.getCurrentPrice(SOL_MINT) || 100;
                
                await taxService.recordSellTrade({
                   walletPublicKey: position.walletPublicKey,
                   tokenMint: position.mint,
                   solAmount: expectedOutput,
                   tokenAmount: tokenAmount,
                   priceUsd: currentPrice,
                   priceSol: solPrice,
                   feeSol: estimatedFee,
                   signature,
                   exitStrategy: position.strategy
                });
             } catch(e) { console.error('Tax error', e); }
             
             return;
             
         } catch (e: any) {
             console.error(`[ExitExecutor] Auto-exit failed:`, e.message);
             return;
         }
      }

      // MANUAL FALLBACK
      console.log(`[ExitExecutor] Preparing pending sell for manual approval...`);

      // Create pending sell
      const pendingSell = await pendingSellsManager.createPendingSell({
        walletPublicKey: position.walletPublicKey,
        tokenMint: position.mint,
        tokenSymbol: undefined,
        sellPercentage: sellPercentage,
        tokenAmount: tokenAmount,
        currentPrice: currentPrice,
        entryPrice: position.entryPrice,
        currentProfit: ((currentPrice - position.entryPrice) / position.entryPrice) * 100,
        estimatedSolReceived: expectedOutput,
        reason: reason,
        strategy: position.strategy,
        slippageBps: SLIPPAGE_BPS,
        preparedTransaction: swapData.swapTransaction
      });

      console.log(`[ExitExecutor] ✅ Created pending sell ${pendingSell.id}`);

      // Notify Telegram
      try {
        await telegramNotifier.notifyExitTriggered(position, reason);
      } catch (e: any) { console.error('Telegram error', e); }
    } catch (error: any) {
      console.error(`[ExitExecutor] Error creating pending sell:`, error.message);
    }
  }

  /**
   * Start the exit executor
   * Note: This doesn't run on its own interval - it's called from WebSocket loop
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[ExitExecutor] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[ExitExecutor] Started - will check positions when called from WebSocket loop');

    // Clean up old pending sells on startup
    await pendingSellsManager.cleanup();
  }

  /**
   * Stop the exit executor
   */
  stop(): void {
    this.isRunning = false;
    console.log('[ExitExecutor] Stopped');
  }

  /**
   * Get executor status
   */
  getStatus() {
    const stats = pendingSellsManager.getStatistics();

    return {
      isRunning: this.isRunning,
      pendingSells: stats.pending,
      totalPendingSells: stats.total
    };
  }
}

// Singleton instance
export const exitExecutor = new ExitExecutor();
