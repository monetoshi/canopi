/**
 * Solana Trading Bot - DCA Executor Service
 * Monitors and executes DCA (Dollar Cost Averaging) buy orders automatically
 */

import { dcaOrderManager } from '../core/dca-order-manager';
import { positionManager } from '../core/position-manager';
import { DCAOrder, DCABuyExecution } from '../types/dca.types';
import { Position } from '../types';
import axios from 'axios';
import { getWalletKeypair, getConnection } from '../utils/blockchain.util';
import { jupiterService } from './jupiter.service';
import { VersionedTransaction } from '@solana/web3.js';
import { taxService } from './tax.service';
import { priceService } from './price.service';
import { privacyService } from './privacy.service';
import { ephemeralWalletManager } from '../core/ephemeral-wallet-manager';
import { telegramNotifier } from './telegram-notifier';
import { logger } from '../utils/logger.util';

const CHECK_INTERVAL = 60000; // 1 minute
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

/**
 * Pending DCA Buy
 * Represents a buy that's ready to execute but awaiting transaction execution
 */
export interface PendingDCABuy {
  orderId: string;
  buyNumber: number;
  tokenMint: string;
  tokenSymbol?: string;
  solAmount: number;
  currentPrice: number;
  estimatedTokenAmount: number;
  walletPublicKey: string;
  slippageBps: number;
  exitStrategy: string;
  timestamp: number;
}

/**
 * DCA Executor Service
 * Monitors DCA orders and identifies when buys should be executed
 */
export class DCAExecutor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private pendingBuys: Map<string, PendingDCABuy> = new Map();

  /**
   * Start monitoring DCA orders
   */
  start(): void {
    if (this.isRunning) {
      console.log('[DCAExecutor] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[DCAExecutor] Starting DCA order monitoring...');

    // Run immediately
    this.checkOrders();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.checkOrders();
    }, CHECK_INTERVAL);
  }

  /**
   * Stop monitoring DCA orders
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[DCAExecutor] Stopped DCA order monitoring');
  }

  /**
   * Check all active DCA orders for ready buys
   */
  private async checkOrders(): Promise<void> {
    try {
      const readyOrders = dcaOrderManager.getOrdersReadyForBuy();

      if (readyOrders.length === 0) {
        return;
      }

      console.log(`[DCAExecutor] Found ${readyOrders.length} orders ready for next buy`);

      // Check each order
      for (const order of readyOrders) {
        await this.checkOrder(order);
      }

      // Clean up old completed/cancelled orders (weekly)
      const now = Date.now();
      const lastCleanup = (this as any).lastCleanup || 0;
      if (now - lastCleanup > 7 * 24 * 60 * 60 * 1000) {
        await dcaOrderManager.cleanup();
        (this as any).lastCleanup = now;
      }
    } catch (error) {
      console.error('[DCAExecutor] Error checking orders:', error);
    }
  }

  /**
   * Check a single DCA order
   */
  private async checkOrder(order: DCAOrder): Promise<void> {
    try {
      // Fetch current price
      const currentPrice = await this.fetchTokenPrice(order.tokenMint);

      if (!currentPrice) {
        console.log(`[DCAExecutor] No price data for ${order.tokenMint.slice(0, 8)}... - skipping`);
        return;
      }

      console.log(`[DCAExecutor] Order ${order.id.slice(0, 8)}... ready for buy ${order.currentBuy + 1}/${order.numberOfBuys}`);
      console.log(`[DCAExecutor] Current price: $${currentPrice}`);

      // Calculate buy amount based on strategy
      const solAmount = dcaOrderManager.calculateNextBuyAmount(order, currentPrice);
      
      // Setup wallet: either server wallet or ephemeral wallet
      let signer = getWalletKeypair();
      let isPrivateExecution = false;

      // PRIVATE DCA LOGIC
      if (order.isPrivate) {
        console.log(`[DCAExecutor] 🕵️ Executing PRIVATE DCA buy...`);
        isPrivateExecution = true;
        
        const password = process.env.WALLET_PASSWORD || '';
        if (!password) {
           console.error(`[DCAExecutor] Cannot execute private buy: WALLET_PASSWORD not set`);
           return;
        }

        // Check shielded balance of main wallet
        if (signer) {
           try {
             const shieldStatus = await privacyService.getShieldedBalance(signer.publicKey.toString());
             if (shieldStatus.available < solAmount + 0.01) {
                console.error(`[DCAExecutor] Insufficient shielded balance for private DCA. Need ${solAmount + 0.01}, have ${shieldStatus.available}`);
                return;
             }
           } catch (e) {
             console.error(`[DCAExecutor] Failed to check shielded balance, proceeding anyway...`);
           }
        }

        // Create NEW ephemeral wallet for this buy
        signer = ephemeralWalletManager.createWallet(password);
        
        // Fund it
        try {
           await privacyService.fundEphemeralWallet(signer.publicKey.toString(), solAmount + 0.005);
           console.log(`[DCAExecutor] Funding ephemeral wallet... waiting 10s`);
           await new Promise(r => setTimeout(r, 10000));
        } catch (e: any) {
           console.error(`[DCAExecutor] Funding failed:`, e.message);
           return;
        }
      }

      // IF SERVER WALLET CONFIGURED (OR EPHEMERAL): Execute immediately
      if (signer) {
         console.log(`[DCAExecutor] 🤖 Auto-executing DCA buy via ${signer.publicKey.toString().slice(0, 8)}...`);
         
         try {
             const connection = getConnection();
             const SOL_MINT = 'So11111111111111111111111111111111111111112';
             const lamports = Math.floor(solAmount * 1e9);
             
             // 1. Get Quote
             const quote = await jupiterService.getQuote(
               SOL_MINT,
               order.tokenMint,
               lamports,
               order.slippageBps || 200
             );
             
             // 2. Get Swap Transaction
             const swapData = await jupiterService.getSwapTransaction(quote, signer.publicKey.toString());
             
             if (!swapData || !swapData.swapTransaction) throw new Error('Failed to get swap transaction');
             
             // 3. Sign & Send
             const txBuffer = Buffer.from(swapData.swapTransaction, 'base64');
             const transaction = VersionedTransaction.deserialize(txBuffer);
             transaction.sign([signer]);
             
             const signature = await connection.sendRawTransaction(transaction.serialize(), {
               skipPreflight: false,
               maxRetries: 3
             });
             
             console.log(`[DCAExecutor] ✅ Transaction sent: ${signature}`);
             
             // 4. Update State
             const actualTokenAmount = Number(quote.outAmount) / 10 ** (quote.outputMintDecimals || 9);
             
             // Reuse execution logic
             const key = `${order.id}-${order.currentBuy + 1}`;
             this.pendingBuys.set(key, {
                orderId: order.id,
                buyNumber: order.currentBuy + 1,
                tokenMint: order.tokenMint,
                solAmount,
                currentPrice,
                estimatedTokenAmount: actualTokenAmount,
                walletPublicKey: order.walletPublicKey,
                slippageBps: order.slippageBps,
                exitStrategy: order.exitStrategy as string,
                timestamp: Date.now()
             });
             
             await this.executeBuy(
                order.id,
                order.currentBuy + 1,
                signature,
                actualTokenAmount,
                solAmount,
                currentPrice,
                isPrivateExecution ? signer.publicKey.toString() : undefined
             );

             // Send Telegram Notification
             try {
               await telegramNotifier.notifyDcaBuy(order, order.currentBuy + 1, signature, actualTokenAmount, solAmount, currentPrice);
             } catch (e: any) { logger.error('[DCAExecutor] Telegram error:', e.message); }
             
             // Record Tax
             try {
                const estimatedFee = 0.000005; 
                await taxService.recordBuyTrade({
                  walletPublicKey: order.walletPublicKey,
                  tokenMint: order.tokenMint,
                  solAmount: solAmount,
                  tokenAmount: actualTokenAmount,
                  priceUsd: currentPrice,
                  priceSol: 0, 
                  feeSol: estimatedFee,
                  signature,
                  entryStrategy: `DCA-${order.strategyType}`
                });
             } catch(e) { console.error('Tax error', e); }

         } catch (e: any) {
            console.error(`[DCAExecutor] Auto-execution failed:`, e.message);
         }
         
         return;
      }

      // ELSE: Manual flow
      console.log(`[DCAExecutor] Calculated buy amount: ${solAmount} SOL`);
      const estimatedTokenAmount = solAmount / currentPrice;

      const pendingBuy: PendingDCABuy = {
        orderId: order.id,
        buyNumber: order.currentBuy + 1,
        tokenMint: order.tokenMint,
        tokenSymbol: order.tokenSymbol,
        solAmount,
        currentPrice,
        estimatedTokenAmount,
        walletPublicKey: order.walletPublicKey,
        slippageBps: order.slippageBps,
        exitStrategy: order.exitStrategy as string,
        timestamp: Date.now()
      };

      const key = `${order.id}-${order.currentBuy + 1}`;
      this.pendingBuys.set(key, pendingBuy);

      console.log(`[DCAExecutor] 📋 DCA BUY READY TO EXECUTE! Buy: ${pendingBuy.buyNumber}/${order.numberOfBuys}`);
      this.cleanupOldPendingBuys();
    } catch (error) {
      console.error(`[DCAExecutor] Error checking order ${order.id}:`, error);
    }
  }

  private async fetchTokenPrice(tokenMint: string): Promise<number | null> {
    try {
      const response = await axios.get(`${DEXSCREENER_API}/${tokenMint}`, { timeout: 10000 });
      if (response.data?.pairs && response.data.pairs.length > 0) {
        const sortedPairs = response.data.pairs.sort((a: any, b: any) => {
          const liqA = parseFloat(a.liquidity?.usd || '0');
          const liqB = parseFloat(b.liquidity?.usd || '0');
          return liqB - liqA;
        });
        const price = parseFloat(sortedPairs[0].priceUsd);
        return isNaN(price) ? null : price;
      }
      return null;
    } catch (error: any) {
      return null;
    }
  }

  getPendingBuys(): PendingDCABuy[] {
    return Array.from(this.pendingBuys.values());
  }

  getPendingBuy(orderId: string, buyNumber: number): PendingDCABuy | undefined {
    const key = `${orderId}-${buyNumber}`;
    return this.pendingBuys.get(key);
  }

  async executeBuy(
    orderId: string,
    buyNumber: number,
    signature: string,
    actualTokenAmount: number,
    actualSolSpent: number,
    actualPrice: number,
    executionWallet?: string
  ): Promise<boolean> {
    try {
      const key = `${orderId}-${buyNumber}`;
      const pendingBuy = this.pendingBuys.get(key);

      if (!pendingBuy) return false;

      const order = dcaOrderManager.getOrder(orderId);
      if (!order) return false;

      const execution: DCABuyExecution = {
        buyNumber,
        timestamp: Date.now(),
        solAmount: actualSolSpent,
        tokenAmount: actualTokenAmount,
        price: actualPrice,
        signature,
        positionMint: order.tokenMint,
        executionWallet
      };

      const success = await dcaOrderManager.recordBuyExecution(orderId, execution);
      if (!success) return false;

      const existingPosition = positionManager.getPosition(order.walletPublicKey, order.tokenMint);

      if (existingPosition) {
        await positionManager.addToPosition(order.walletPublicKey, order.tokenMint, actualTokenAmount, actualSolSpent, actualPrice);
        await positionManager.updatePosition(order.walletPublicKey, order.tokenMint, {
          currentPrice: actualPrice,
          currentProfit: ((actualPrice - existingPosition.entryPrice) / existingPosition.entryPrice) * 100
        });
      } else {
        const position: Position = {
          mint: order.tokenMint,
          walletPublicKey: order.walletPublicKey,
          entryTime: Date.now(),
          entryPrice: actualPrice,
          tokenAmount: actualTokenAmount,
          solSpent: actualSolSpent,
          exitStagesCompleted: 0,
          strategy: order.exitStrategy,
          isPercentageBased: false,
          highestProfit: 0,
          status: 'active',
          currentPrice: actualPrice,
          currentProfit: 0,
          isPrivate: !!executionWallet,
          executionWallet
        };
        await positionManager.addPosition(position);
      }

      this.pendingBuys.delete(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  private cleanupOldPendingBuys(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [key, buy] of this.pendingBuys.entries()) {
      if (buy.timestamp < oneHourAgo) this.pendingBuys.delete(key);
    }
  }

  cancelPendingBuy(orderId: string, buyNumber: number): boolean {
    const key = `${orderId}-${buyNumber}`;
    const existed = this.pendingBuys.has(key);
    this.pendingBuys.delete(key);
    return existed;
  }

  getStatus() {
    const activeOrders = dcaOrderManager.getActiveOrders();
    const pendingBuysList = this.getPendingBuys();
    return {
      isRunning: this.isRunning,
      checkInterval: CHECK_INTERVAL,
      activeOrders: activeOrders.length,
      pendingBuys: pendingBuysList.length,
      pendingBuysList: pendingBuysList.map(buy => ({
        orderId: buy.orderId.slice(0, 8),
        buyNumber: buy.buyNumber,
        token: buy.tokenMint.slice(0, 8),
        solAmount: buy.solAmount,
        age: Math.floor((Date.now() - buy.timestamp) / 1000)
      }))
    };
  }
}

export const dcaExecutor = new DCAExecutor();