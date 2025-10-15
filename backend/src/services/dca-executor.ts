/**
 * Solana Trading Bot - DCA Executor Service
 * Monitors and executes DCA (Dollar Cost Averaging) buy orders automatically
 */

import { dcaOrderManager } from '../core/dca-order-manager';
import { positionManager } from '../core/position-manager';
import { DCAOrder, DCABuyExecution } from '../types/dca.types';
import { Position } from '../types';
import axios from 'axios';

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
        dcaOrderManager.cleanup();
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
      console.log(`[DCAExecutor] Calculated buy amount: ${solAmount} SOL`);

      // Estimate token amount (rough estimate)
      const estimatedTokenAmount = solAmount / currentPrice;

      // Create pending buy
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

      // Store pending buy
      const key = `${order.id}-${order.currentBuy + 1}`;
      this.pendingBuys.set(key, pendingBuy);

      console.log(`[DCAExecutor] 📋 DCA BUY READY TO EXECUTE!`);
      console.log(`[DCAExecutor] Order ID: ${order.id}`);
      console.log(`[DCAExecutor] Token: ${order.tokenSymbol || order.tokenMint.slice(0, 8)}...`);
      console.log(`[DCAExecutor] Buy: ${pendingBuy.buyNumber}/${order.numberOfBuys}`);
      console.log(`[DCAExecutor] SOL Amount: ${solAmount.toFixed(4)} SOL`);
      console.log(`[DCAExecutor] Est. Tokens: ~${estimatedTokenAmount.toFixed(2)}`);
      console.log(`[DCAExecutor] Current Price: $${currentPrice}`);
      console.log(`[DCAExecutor] Wallet: ${order.walletPublicKey.slice(0, 8)}...`);
      console.log(`[DCAExecutor] ⚠️ Pending approval - use API to execute this buy`);

      // Clean up old pending buys (older than 1 hour)
      this.cleanupOldPendingBuys();
    } catch (error) {
      console.error(`[DCAExecutor] Error checking order ${order.id}:`, error);
    }
  }

  /**
   * Fetch current token price from DexScreener
   */
  private async fetchTokenPrice(tokenMint: string): Promise<number | null> {
    try {
      const response = await axios.get(`${DEXSCREENER_API}/${tokenMint}`, {
        timeout: 10000
      });

      if (response.data?.pairs && response.data.pairs.length > 0) {
        // Get the pair with highest liquidity
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
      if (error.code !== 'ECONNABORTED') {
        console.error(`[DCAExecutor] Error fetching price for ${tokenMint}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Get all pending buys
   */
  getPendingBuys(): PendingDCABuy[] {
    return Array.from(this.pendingBuys.values());
  }

  /**
   * Get pending buy by order ID and buy number
   */
  getPendingBuy(orderId: string, buyNumber: number): PendingDCABuy | undefined {
    const key = `${orderId}-${buyNumber}`;
    return this.pendingBuys.get(key);
  }

  /**
   * Execute a pending DCA buy
   * This should be called from the API after user approves/signs the transaction
   *
   * @param orderId - DCA order ID
   * @param buyNumber - Buy number to execute
   * @param signature - Transaction signature from blockchain
   * @param actualTokenAmount - Actual tokens received
   * @param actualSolSpent - Actual SOL spent (may differ from estimate)
   * @param actualPrice - Actual execution price
   */
  async executeBuy(
    orderId: string,
    buyNumber: number,
    signature: string,
    actualTokenAmount: number,
    actualSolSpent: number,
    actualPrice: number
  ): Promise<boolean> {
    try {
      const key = `${orderId}-${buyNumber}`;
      const pendingBuy = this.pendingBuys.get(key);

      if (!pendingBuy) {
        console.error(`[DCAExecutor] No pending buy found for ${orderId} buy ${buyNumber}`);
        return false;
      }

      const order = dcaOrderManager.getOrder(orderId);
      if (!order) {
        console.error(`[DCAExecutor] Order ${orderId} not found`);
        return false;
      }

      console.log(`[DCAExecutor] ✅ Executing DCA buy ${buyNumber}/${order.numberOfBuys} for order ${orderId}`);

      // Create buy execution record
      const execution: DCABuyExecution = {
        buyNumber,
        timestamp: Date.now(),
        solAmount: actualSolSpent,
        tokenAmount: actualTokenAmount,
        price: actualPrice,
        signature,
        positionMint: order.tokenMint
      };

      // Record execution in DCA order manager
      const success = dcaOrderManager.recordBuyExecution(orderId, execution);
      if (!success) {
        console.error(`[DCAExecutor] Failed to record buy execution for order ${orderId}`);
        return false;
      }

      // Check if this is the first buy or if we need to update existing position
      const existingPosition = positionManager.getPosition(order.walletPublicKey, order.tokenMint);

      if (existingPosition) {
        // Update existing position (accumulate tokens, recalculate avg entry)
        const totalSolSpent = existingPosition.solSpent + actualSolSpent;
        const totalTokens = existingPosition.tokenAmount + actualTokenAmount;
        const newAvgEntry = totalSolSpent / totalTokens;

        positionManager.updatePosition(order.walletPublicKey, order.tokenMint, {
          solSpent: totalSolSpent,
          tokenAmount: totalTokens,
          entryPrice: newAvgEntry,
          currentPrice: actualPrice,
          currentProfit: ((actualPrice - newAvgEntry) / newAvgEntry) * 100
        });

        console.log(`[DCAExecutor] Updated position: ${totalTokens.toFixed(2)} tokens @ avg $${newAvgEntry.toFixed(6)}`);
      } else {
        // Create new position
        const position: Position = {
          mint: order.tokenMint,
          walletPublicKey: order.walletPublicKey,
          entryTime: Date.now(),
          entryPrice: actualPrice,
          tokenAmount: actualTokenAmount,
          solSpent: actualSolSpent,
          exitStagesCompleted: 0,
          strategy: order.exitStrategy,
          isPercentageBased: false, // DCA positions use the exit strategy's setting
          highestProfit: 0,
          status: 'active',
          currentPrice: actualPrice,
          currentProfit: 0
        };

        positionManager.addPosition(position);
        console.log(`[DCAExecutor] Created position: ${actualTokenAmount.toFixed(2)} tokens @ $${actualPrice.toFixed(6)}`);
      }

      // Remove from pending
      this.pendingBuys.delete(key);

      console.log(`[DCAExecutor] ✅ DCA buy ${buyNumber}/${order.numberOfBuys} completed successfully`);
      console.log(`[DCAExecutor] Progress: ${dcaOrderManager.getProgress(orderId).toFixed(1)}%`);

      return true;
    } catch (error) {
      console.error(`[DCAExecutor] Error executing buy:`, error);
      return false;
    }
  }

  /**
   * Clean up old pending buys (older than 1 hour)
   */
  private cleanupOldPendingBuys(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let removed = 0;

    for (const [key, buy] of this.pendingBuys.entries()) {
      if (buy.timestamp < oneHourAgo) {
        this.pendingBuys.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[DCAExecutor] Cleaned up ${removed} old pending buys`);
    }
  }

  /**
   * Cancel a pending buy
   */
  cancelPendingBuy(orderId: string, buyNumber: number): boolean {
    const key = `${orderId}-${buyNumber}`;
    const existed = this.pendingBuys.has(key);
    this.pendingBuys.delete(key);

    if (existed) {
      console.log(`[DCAExecutor] Cancelled pending buy for order ${orderId} buy ${buyNumber}`);
    }

    return existed;
  }

  /**
   * Get executor status
   */
  getStatus() {
    const activeOrders = dcaOrderManager.getActiveOrders();
    const pendingBuys = this.getPendingBuys();

    return {
      isRunning: this.isRunning,
      checkInterval: CHECK_INTERVAL,
      activeOrders: activeOrders.length,
      pendingBuys: pendingBuys.length,
      pendingBuysList: pendingBuys.map(buy => ({
        orderId: buy.orderId.slice(0, 8),
        buyNumber: buy.buyNumber,
        token: buy.tokenSymbol || buy.tokenMint.slice(0, 8),
        solAmount: buy.solAmount,
        age: Math.floor((Date.now() - buy.timestamp) / 1000) // seconds
      }))
    };
  }
}

// Singleton instance
export const dcaExecutor = new DCAExecutor();
