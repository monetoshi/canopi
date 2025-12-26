/**
 * Solana Trading Bot - DCA Order Manager
 * Manages Dollar Cost Averaging (DCA) orders for automated token purchases over time
 * Uses Drizzle ORM + PGLite for persistence
 */

import { DCAOrder, DCABuyExecution, DCAStatistics, DCAStrategyType } from '../types/dca.types';
import { ExitStrategy } from '../types';
import { logger } from '../utils/logger.util';
import { db } from '../db/index';
import { dcaOrders as dcaOrdersTable, NewDCAOrder } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * DCA Order Manager
 * Tracks and manages all DCA (Dollar Cost Averaging) orders
 */
export class DCAOrderManager {
  private orders: Map<string, DCAOrder> = new Map();
  private initialized = false;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initialize();
  }

  /**
   * Wait for initialization to complete
   */
  public async waitForReady(): Promise<void> {
    return this.initPromise;
  }

  /**
   * Initialize cache from database
   */
  private async initialize() {
    try {
      const allOrders = await db.select().from(dcaOrdersTable);
      
      this.orders.clear();
      for (const ord of allOrders) {
        const order: DCAOrder = {
          id: ord.id,
          walletPublicKey: ord.walletPublicKey,
          tokenMint: ord.tokenMint,
          tokenSymbol: ord.tokenSymbol || undefined,
          strategyType: ord.strategyType as DCAStrategyType,
          totalSolAmount: parseFloat(ord.totalSolAmount),
          numberOfBuys: ord.numberOfBuys,
          intervalMinutes: ord.intervalMinutes,
          exitStrategy: ord.exitStrategy as ExitStrategy,
          slippageBps: ord.slippageBps || 200,
          currentBuy: ord.currentBuy || 0,
          status: ord.status as any,
          createdAt: ord.createdAt.getTime(),
          lastBuyAt: ord.lastBuyTime ? ord.lastBuyTime.getTime() : undefined,
          nextBuyAt: ord.nextBuyTime ? ord.nextBuyTime.getTime() : undefined,
          completedBuys: (ord.completedBuys as any) || [],
          referencePrice: ord.referencePrice ? parseFloat(ord.referencePrice) : undefined,
          isPrivate: ord.isPrivate || false
        };
        this.orders.set(order.id, order);
      }
      
      this.initialized = true;
      console.log(`[DCAOrderManager] Loaded ${allOrders.length} DCA orders from database`);
    } catch (error) {
      console.error('[DCAOrderManager] Error initializing from database:', error);
    }
  }

  /**
   * Create a new DCA order
   */
  async createOrder(params: {
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
    isPrivate?: boolean;
  }): Promise<DCAOrder> {
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
      nextBuyAt: now, // First buy immediately
      completedBuys: [],
      referencePrice: params.referencePrice,
      isPrivate: !!params.isPrivate
    };

    // Update Cache
    this.orders.set(order.id, order);

    // Persist to DB
    try {
      const newOrder: NewDCAOrder = {
        id: order.id,
        walletPublicKey: order.walletPublicKey,
        tokenMint: order.tokenMint,
        tokenSymbol: order.tokenSymbol,
        strategyType: order.strategyType,
        totalSolAmount: order.totalSolAmount.toString(),
        numberOfBuys: order.numberOfBuys,
        intervalMinutes: order.intervalMinutes,
        exitStrategy: order.exitStrategy,
        slippageBps: order.slippageBps,
        currentBuy: order.currentBuy,
        status: order.status,
        createdAt: new Date(order.createdAt),
        nextBuyTime: order.nextBuyAt ? new Date(order.nextBuyAt) : null,
        completedBuys: order.completedBuys,
        referencePrice: order.referencePrice?.toString(),
        isPrivate: order.isPrivate
      };

      await db.insert(dcaOrdersTable).values(newOrder);
      console.log(`[DCAOrderManager] Created DCA order ${order.id} for ${params.tokenMint.slice(0, 8)}...`);
    } catch (error) {
      console.error('[DCAOrderManager] Error saving DCA order to DB:', error);
    }

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
  async updateOrderStatus(orderId: string, status: DCAOrder['status']): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    order.status = status;
    
    // Update DB
    try {
      await db.update(dcaOrdersTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(dcaOrdersTable.id, orderId));
      
      console.log(`[DCAOrderManager] Updated order ${orderId} status to ${status}`);
      return true;
    } catch (error) {
      console.error('[DCAOrderManager] Error updating order status in DB:', error);
      return false;
    }
  }

  /**
   * Pause an order
   */
  async pauseOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status !== 'active') {
      return false;
    }

    return this.updateOrderStatus(orderId, 'paused');
  }

  /**
   * Resume a paused order
   */
  async resumeOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status !== 'paused') {
      return false;
    }

    order.status = 'active';
    // Recalculate next buy time
    order.nextBuyAt = Date.now() + (order.intervalMinutes * 60000);
    
    // Update DB
    try {
      await db.update(dcaOrdersTable)
        .set({ 
          status: 'active', 
          nextBuyTime: new Date(order.nextBuyAt),
          updatedAt: new Date() 
        })
        .where(eq(dcaOrdersTable.id, orderId));
        
      console.log(`[DCAOrderManager] Resumed order ${orderId}`);
      return true;
    } catch (error) {
      console.error('[DCAOrderManager] Error resuming order in DB:', error);
      return false;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status === 'completed') {
      return false;
    }

    return this.updateOrderStatus(orderId, 'cancelled');
  }

  /**
   * Record a completed buy execution
   */
  async recordBuyExecution(orderId: string, execution: DCABuyExecution): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    // Update Cache
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

    // Update DB
    try {
      await db.update(dcaOrdersTable)
        .set({
          currentBuy: order.currentBuy,
          lastBuyTime: new Date(order.lastBuyAt),
          nextBuyTime: order.nextBuyAt ? new Date(order.nextBuyAt) : null,
          completedBuys: order.completedBuys,
          status: order.status,
          updatedAt: new Date()
        })
        .where(eq(dcaOrdersTable.id, orderId));

      console.log(`[DCAOrderManager] Recorded buy ${execution.buyNumber}/${order.numberOfBuys} for order ${orderId}`);
      return true;
    } catch (error) {
      console.error('[DCAOrderManager] Error recording buy execution in DB:', error);
      return false;
    }
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
  async cleanup(olderThanDays: number = 30): Promise<number> {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let removed = 0;

    const idsToRemove: string[] = [];
    for (const [id, order] of this.orders.entries()) {
      if (
        (order.status === 'completed' || order.status === 'cancelled') &&
        order.createdAt < cutoffTime
      ) {
        idsToRemove.push(id);
      }
    }

    if (idsToRemove.length > 0) {
      try {
        for (const id of idsToRemove) {
          await db.delete(dcaOrdersTable).where(eq(dcaOrdersTable.id, id));
          this.orders.delete(id);
          removed++;
        }
        console.log(`[DCAOrderManager] Cleaned up ${removed} old DCA orders from DB`);
      } catch (error) {
        console.error('[DCAOrderManager] Error cleaning up old orders in DB:', error);
      }
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

  /**
   * Clear all orders (for testing)
   */
  async clear(): Promise<void> {
    this.orders.clear();
    try {
      await db.delete(dcaOrdersTable);
      console.log('[DCAOrderManager] All DCA orders cleared from DB');
    } catch (error) {
      console.error('[DCAOrderManager] Error clearing DB:', error);
    }
  }
}

// Singleton instance
export const dcaOrderManager = new DCAOrderManager();
