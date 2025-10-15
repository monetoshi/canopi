/**
 * Solana Trading Bot - Limit Order Executor Service
 * Monitors prices and executes limit orders when targets are hit
 */

import { limitOrderManager } from '../core/limit-order-manager';
import { positionManager } from '../core/position-manager';
import { LimitOrder } from '../types';
import axios from 'axios';

const PRICE_CHECK_INTERVAL = 30000; // 30 seconds
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

/**
 * Limit Order Executor Service
 * Monitors prices and executes limit orders automatically
 */
export class LimitOrderExecutor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private executeTransaction: Function | null = null;

  /**
   * Initialize with transaction executor function
   */
  constructor(executeTransactionFn?: Function) {
    this.executeTransaction = executeTransactionFn || null;
  }

  /**
   * Set the transaction executor function
   */
  setTransactionExecutor(fn: Function): void {
    this.executeTransaction = fn;
  }

  /**
   * Start monitoring limit orders
   */
  start(): void {
    if (this.isRunning) {
      console.log('[LimitOrderExecutor] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[LimitOrderExecutor] Starting price monitoring...');

    // Run immediately
    this.checkOrders();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.checkOrders();
    }, PRICE_CHECK_INTERVAL);
  }

  /**
   * Stop monitoring limit orders
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[LimitOrderExecutor] Stopped price monitoring');
  }

  /**
   * Check all pending limit orders
   */
  private async checkOrders(): Promise<void> {
    try {
      const allOrders = limitOrderManager.getAllOrders();
      const pendingOrders = allOrders.filter(o => o.status === 'pending');

      if (pendingOrders.length === 0) {
        return;
      }

      console.log(`[LimitOrderExecutor] Checking ${pendingOrders.length} pending orders...`);

      // Group orders by token mint to minimize API calls
      const ordersByToken = new Map<string, LimitOrder[]>();
      for (const order of pendingOrders) {
        const existing = ordersByToken.get(order.tokenMint) || [];
        existing.push(order);
        ordersByToken.set(order.tokenMint, existing);
      }

      // Check each token's price
      for (const [tokenMint, orders] of ordersByToken.entries()) {
        await this.checkTokenOrders(tokenMint, orders);
      }

      // Clean up old orders (weekly)
      const now = Date.now();
      const lastCleanup = (this as any).lastCleanup || 0;
      if (now - lastCleanup > 7 * 24 * 60 * 60 * 1000) {
        limitOrderManager.cleanup();
        (this as any).lastCleanup = now;
      }
    } catch (error) {
      console.error('[LimitOrderExecutor] Error checking orders:', error);
    }
  }

  /**
   * Check orders for a specific token
   */
  private async checkTokenOrders(tokenMint: string, orders: LimitOrder[]): Promise<void> {
    try {
      // Fetch current price from DexScreener
      const currentPrice = await this.fetchTokenPrice(tokenMint);

      if (!currentPrice) {
        console.log(`[LimitOrderExecutor] No price data for ${tokenMint.slice(0, 8)}...`);
        return;
      }

      console.log(`[LimitOrderExecutor] ${tokenMint.slice(0, 8)}... current price: $${currentPrice}`);

      // Check each order for this token
      for (const order of orders) {
        if (limitOrderManager.shouldExecuteOrder(order, currentPrice)) {
          await this.executeOrder(order, currentPrice);
        }
      }
    } catch (error) {
      console.error(`[LimitOrderExecutor] Error checking token ${tokenMint}:`, error);
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
        console.error(`[LimitOrderExecutor] Error fetching price for ${tokenMint}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Execute a limit order
   * NOTE: Automatic execution requires wallet private keys which is a security risk.
   * For now, we just mark orders as ready to execute and log them.
   * Future enhancement: Support bot wallets or require manual approval
   */
  private async executeOrder(order: LimitOrder, currentPrice: number): Promise<void> {
    console.log(`[LimitOrderExecutor] 🎯 LIMIT ORDER TRIGGERED!`);
    console.log(`[LimitOrderExecutor] Order ID: ${order.id}`);
    console.log(`[LimitOrderExecutor] Token: ${order.tokenSymbol || order.tokenMint.slice(0, 8)}...`);
    console.log(`[LimitOrderExecutor] Target Price: $${order.targetPrice}`);
    console.log(`[LimitOrderExecutor] Current Price: $${currentPrice}`);
    console.log(`[LimitOrderExecutor] SOL Amount: ${order.solAmount} SOL`);
    console.log(`[LimitOrderExecutor] Exit Strategy: ${order.exitStrategy}`);
    console.log(`[LimitOrderExecutor] Wallet: ${order.walletPublicKey.slice(0, 8)}...`);

    try {
      // Mark order as executing (will stay in this state until manually approved/filled)
      limitOrderManager.markExecuting(order.id);

      // TODO: In the future, this could:
      // 1. Create an unsigned transaction and store it
      // 2. Send a webhook/notification to user
      // 3. Wait for user approval via API
      // 4. Execute the approved transaction
      // OR support a dedicated bot wallet with automated execution

      console.log(`[LimitOrderExecutor] ⚠️ Order marked as 'executing' - requires manual approval`);
      console.log(`[LimitOrderExecutor] Use the frontend or API to approve and execute this order`);
    } catch (error: any) {
      console.error(`[LimitOrderExecutor] Error processing order ${order.id}:`, error.message);
      // Reset to pending so it can be retried
      limitOrderManager.updateOrderStatus(order.id, 'pending');
    }
  }

  /**
   * Get executor status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: PRICE_CHECK_INTERVAL,
      hasExecutor: this.executeTransaction !== null
    };
  }
}

// Singleton instance
export const limitOrderExecutor = new LimitOrderExecutor();
