/**
 * Solana Trading Bot - DCA Order Manager
 * Manages Dollar Cost Averaging (DCA) orders for automated token purchases over time
 */

import { DCAOrder, DCABuyExecution, DCAStatistics, DCAStrategyType } from '../types/dca.types';
import { ExitStrategy } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DCA_ORDERS_FILE = path.join(__dirname, '../../data/dca-orders.json');

/**
 * DCA Order Manager
 * Tracks and manages all DCA (Dollar Cost Averaging) orders
 */
export class DCAOrderManager {
  private orders: Map<string, DCAOrder> = new Map();

  constructor() {
    this.loadOrders();
  }

  /**
   * Load orders from disk
   */
  private loadOrders(): void {
    try {
      const dataDir = path.dirname(DCA_ORDERS_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(DCA_ORDERS_FILE)) {
        const data = fs.readFileSync(DCA_ORDERS_FILE, 'utf-8');
        const ordersArray: DCAOrder[] = JSON.parse(data);

        this.orders.clear();
        for (const order of ordersArray) {
          this.orders.set(order.id, order);
        }

        console.log(`[DCAOrderManager] Loaded ${ordersArray.length} DCA orders from disk`);
      } else {
        console.log('[DCAOrderManager] No saved DCA orders found, starting fresh');
      }
    } catch (error) {
      console.error('[DCAOrderManager] Error loading DCA orders:', error);
    }
  }

  /**
   * Save orders to disk
   */
  private saveOrders(): void {
    try {
      const ordersArray = Array.from(this.orders.values());
      fs.writeFileSync(DCA_ORDERS_FILE, JSON.stringify(ordersArray, null, 2));
      console.log(`[DCAOrderManager] Saved ${ordersArray.length} DCA orders to disk`);
    } catch (error) {
      console.error('[DCAOrderManager] Error saving DCA orders:', error);
    }
  }

  /**
   * Create a new DCA order
   */
  createOrder(params: {
    walletPublicKey: string;
    tokenMint: string;
    tokenSymbol?: string;
    strategyType: DCAStrategyType;
    totalSolAmount: number;
    numberOfBuys: number;
    intervalMinutes: number;
    exitStrategy: ExitStrategy;
    slippageBps?: number;
    referencePrice?: number;
  }): DCAOrder {
    // Validate inputs
    if (params.numberOfBuys < 2) {
      throw new Error('Number of buys must be at least 2');
    }

    if (params.numberOfBuys > 100) {
      throw new Error('Number of buys cannot exceed 100');
    }

    if (params.intervalMinutes < 1) {
      throw new Error('Interval must be at least 1 minute');
    }

    if (params.totalSolAmount <= 0) {
      throw new Error('Total SOL amount must be positive');
    }

    const now = Date.now();
    const order: DCAOrder = {
      id: uuidv4(),
      walletPublicKey: params.walletPublicKey,
      tokenMint: params.tokenMint,
      tokenSymbol: params.tokenSymbol,
      strategyType: params.strategyType,
      totalSolAmount: params.totalSolAmount,
      numberOfBuys: params.numberOfBuys,
      intervalMinutes: params.intervalMinutes,
      exitStrategy: params.exitStrategy,
      slippageBps: params.slippageBps || 200,
      currentBuy: 0,
      status: 'active',
      createdAt: now,
      nextBuyAt: now + (params.intervalMinutes * 60000), // First buy after interval
      completedBuys: [],
      referencePrice: params.referencePrice
    };

    this.orders.set(order.id, order);
    this.saveOrders();

    console.log(`[DCAOrderManager] Created DCA order ${order.id} for ${params.tokenMint.slice(0, 8)}... - ${params.numberOfBuys} buys of ${params.totalSolAmount} SOL`);

    return order;
  }

  /**
   * Get all orders
   */
  getAllOrders(): DCAOrder[] {
    return Array.from(this.orders.values());
  }

  /**
   * Get orders for a specific wallet
   */
  getOrdersByWallet(walletPublicKey: string): DCAOrder[] {
    return Array.from(this.orders.values())
      .filter(order => order.walletPublicKey === walletPublicKey);
  }

  /**
   * Get active orders for a specific wallet
   */
  getActiveOrdersByWallet(walletPublicKey: string): DCAOrder[] {
    return Array.from(this.orders.values())
      .filter(order => order.walletPublicKey === walletPublicKey && order.status === 'active');
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): DCAOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all active orders
   */
  getActiveOrders(): DCAOrder[] {
    return Array.from(this.orders.values())
      .filter(order => order.status === 'active');
  }

  /**
   * Update order status
   */
  updateOrderStatus(orderId: string, status: DCAOrder['status']): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    order.status = status;
    this.saveOrders();

    console.log(`[DCAOrderManager] Updated order ${orderId} status to ${status}`);
    return true;
  }

  /**
   * Pause an order
   */
  pauseOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status !== 'active') {
      console.log(`[DCAOrderManager] Cannot pause order ${orderId} - not active`);
      return false;
    }

    order.status = 'paused';
    this.saveOrders();

    console.log(`[DCAOrderManager] Paused order ${orderId}`);
    return true;
  }

  /**
   * Resume a paused order
   */
  resumeOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status !== 'paused') {
      console.log(`[DCAOrderManager] Cannot resume order ${orderId} - not paused`);
      return false;
    }

    order.status = 'active';
    // Recalculate next buy time
    order.nextBuyAt = Date.now() + (order.intervalMinutes * 60000);
    this.saveOrders();

    console.log(`[DCAOrderManager] Resumed order ${orderId}`);
    return true;
  }

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status === 'completed') {
      console.log(`[DCAOrderManager] Cannot cancel order ${orderId} - already completed`);
      return false;
    }

    order.status = 'cancelled';
    this.saveOrders();

    console.log(`[DCAOrderManager] Cancelled order ${orderId}`);
    return true;
  }

  /**
   * Record a completed buy execution
   */
  recordBuyExecution(orderId: string, execution: DCABuyExecution): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    order.completedBuys.push(execution);
    order.currentBuy = execution.buyNumber;
    order.lastBuyAt = execution.timestamp;

    // Calculate next buy time
    if (order.currentBuy < order.numberOfBuys) {
      order.nextBuyAt = execution.timestamp + (order.intervalMinutes * 60000);
    } else {
      // All buys completed
      order.status = 'completed';
      order.nextBuyAt = undefined;
    }

    this.saveOrders();

    console.log(`[DCAOrderManager] Recorded buy ${execution.buyNumber}/${order.numberOfBuys} for order ${orderId}`);

    return true;
  }

  /**
   * Get orders ready for next buy
   */
  getOrdersReadyForBuy(): DCAOrder[] {
    const now = Date.now();
    return this.getActiveOrders()
      .filter(order => {
        // Must have a next buy time set
        if (!order.nextBuyAt) return false;

        // Must be past the next buy time
        if (now < order.nextBuyAt) return false;

        // Must not have completed all buys
        if (order.currentBuy >= order.numberOfBuys) return false;

        return true;
      });
  }

  /**
   * Get total SOL spent for an order
   */
  getTotalSpent(orderId: string): number {
    const order = this.orders.get(orderId);
    if (!order) return 0;

    return order.completedBuys.reduce((total, buy) => total + buy.solAmount, 0);
  }

  /**
   * Get remaining SOL for an order
   */
  getRemainingBudget(orderId: string): number {
    const order = this.orders.get(orderId);
    if (!order) return 0;

    const spent = this.getTotalSpent(orderId);
    return order.totalSolAmount - spent;
  }

  /**
   * Get average entry price for an order
   */
  getAverageEntryPrice(orderId: string): number {
    const order = this.orders.get(orderId);
    if (!order || order.completedBuys.length === 0) return 0;

    const totalTokens = order.completedBuys.reduce((total, buy) => total + buy.tokenAmount, 0);
    const totalSol = order.completedBuys.reduce((total, buy) => total + buy.solAmount, 0);

    if (totalTokens === 0) return 0;
    return totalSol / totalTokens;
  }

  /**
   * Get progress percentage for an order
   */
  getProgress(orderId: string): number {
    const order = this.orders.get(orderId);
    if (!order) return 0;

    return (order.currentBuy / order.numberOfBuys) * 100;
  }

  /**
   * Clean up old completed/cancelled orders
   */
  cleanup(olderThanDays: number = 30): number {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let removed = 0;

    for (const [id, order] of this.orders.entries()) {
      if (
        (order.status === 'completed' || order.status === 'cancelled') &&
        order.createdAt < cutoffTime
      ) {
        this.orders.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      this.saveOrders();
      console.log(`[DCAOrderManager] Cleaned up ${removed} old DCA orders`);
    }

    return removed;
  }

  /**
   * Calculate next buy amount based on DCA strategy
   */
  calculateNextBuyAmount(order: DCAOrder, currentPrice?: number): number {
    const remainingBuys = order.numberOfBuys - order.currentBuy;
    const remainingBudget = this.getRemainingBudget(order.id);

    switch (order.strategyType) {
      case 'time-based':
      case 'fixed-split':
        // Equal distribution
        return remainingBudget / remainingBuys;

      case 'price-based':
        // Price-based: buy more when price is lower, less when higher
        if (!currentPrice || !order.referencePrice) {
          // Fallback to equal distribution if no price data
          return remainingBudget / remainingBuys;
        }

        const priceChange = (currentPrice - order.referencePrice) / order.referencePrice;

        // If price dropped 10%, buy 20% more
        // If price rose 10%, buy 20% less
        const baseAmount = remainingBudget / remainingBuys;
        const adjustmentFactor = 1 - (priceChange * 2);

        // Clamp between 50% and 200% of base amount
        const adjustedAmount = baseAmount * Math.max(0.5, Math.min(2.0, adjustmentFactor));

        // Ensure we don't exceed remaining budget
        return Math.min(adjustedAmount, remainingBudget);

      default:
        return remainingBudget / remainingBuys;
    }
  }

  /**
   * Calculate next buy time for an order
   */
  calculateNextBuyTime(order: DCAOrder): number | undefined {
    if (order.currentBuy >= order.numberOfBuys) {
      return undefined; // All buys completed
    }

    if (!order.lastBuyAt) {
      // First buy - use creation time + interval
      return order.createdAt + (order.intervalMinutes * 60000);
    }

    // Subsequent buys - use last buy time + interval
    return order.lastBuyAt + (order.intervalMinutes * 60000);
  }

  /**
   * Check if order should execute next buy
   */
  shouldExecuteNextBuy(order: DCAOrder, currentTime: number): boolean {
    // Must be active
    if (order.status !== 'active') return false;

    // Must have buys remaining
    if (order.currentBuy >= order.numberOfBuys) return false;

    // Must have next buy time set
    if (!order.nextBuyAt) return false;

    // Must be past the next buy time
    if (currentTime < order.nextBuyAt) return false;

    return true;
  }

  /**
   * Get estimated completion time for an order
   */
  getEstimatedCompletionTime(orderId: string): number | undefined {
    const order = this.orders.get(orderId);
    if (!order) return undefined;

    const remainingBuys = order.numberOfBuys - order.currentBuy;
    if (remainingBuys <= 0) return undefined;

    const totalRemainingTime = remainingBuys * order.intervalMinutes * 60000;
    const lastTime = order.lastBuyAt || order.createdAt;

    return lastTime + totalRemainingTime;
  }

  /**
   * Get statistics
   */
  getStatistics(): DCAStatistics {
    const allOrders = this.getAllOrders();

    const totalSolAllocated = allOrders.reduce((sum, order) => sum + order.totalSolAmount, 0);
    const totalSolSpent = allOrders.reduce((sum, order) => {
      return sum + order.completedBuys.reduce((buySum, buy) => buySum + buy.solAmount, 0);
    }, 0);

    return {
      total: allOrders.length,
      active: allOrders.filter(o => o.status === 'active').length,
      paused: allOrders.filter(o => o.status === 'paused').length,
      completed: allOrders.filter(o => o.status === 'completed').length,
      cancelled: allOrders.filter(o => o.status === 'cancelled').length,
      totalSolAllocated,
      totalSolSpent
    };
  }
}

// Singleton instance
export const dcaOrderManager = new DCAOrderManager();
