/**
 * Solana Trading Bot - Limit Order Manager
 * Manages pending limit orders and executes them when price targets are hit
 * Uses Drizzle ORM + PGLite for persistence
 */

import { LimitOrder, ExitStrategy } from '../types';
import { db } from '../db/index';
import { limitOrders as limitOrdersTable, NewLimitOrder } from '../db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Limit Order Manager
 * Tracks and manages all pending limit orders
 */
export class LimitOrderManager {
  private orders: Map<string, LimitOrder> = new Map();
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
      const allOrders = await db.select().from(limitOrdersTable);
      
      this.orders.clear();
      for (const ord of allOrders) {
        const order: LimitOrder = {
          id: ord.id,
          walletPublicKey: ord.walletPublicKey,
          type: ord.type as 'BUY' | 'SELL',
          tokenMint: ord.tokenMint,
          tokenSymbol: ord.tokenSymbol || undefined,
          targetPrice: parseFloat(ord.targetPriceUsd),
          solAmount: parseFloat(ord.solAmount),
          exitStrategy: ord.exitStrategy as ExitStrategy,
          slippageBps: ord.slippageBps || 200,
          status: ord.status as any,
          createdAt: ord.createdAt.getTime(),
          expiresAt: ord.expiresAt ? ord.expiresAt.getTime() : undefined,
          isPrivate: ord.isPrivate || false,
          executionWallet: ord.executionWallet || undefined
          // signature and positionMint will be added if filled
        };
        this.orders.set(order.id, order);
      }
      
      this.initialized = true;
      console.log(`[LimitOrderManager] Loaded ${allOrders.length} limit orders from database`);
    } catch (error) {
      console.error('[LimitOrderManager] Error initializing from database:', error);
    }
  }

  /**
   * Create a new limit order
   */
  async createOrder(params: {
    walletPublicKey: string;
    tokenMint: string;
    type?: 'BUY' | 'SELL';
    tokenSymbol?: string;
    targetPrice: number;
    solAmount: number;
    exitStrategy: ExitStrategy;
    slippageBps?: number;
    expiresIn?: number; // minutes
    isPrivate?: boolean;
  }): Promise<LimitOrder> {
    const order: LimitOrder = {
      id: uuidv4(),
      walletPublicKey: params.walletPublicKey,
      tokenMint: params.tokenMint,
      type: params.type || 'BUY',
      tokenSymbol: params.tokenSymbol,
      targetPrice: params.targetPrice,
      solAmount: params.solAmount,
      exitStrategy: params.exitStrategy,
      slippageBps: params.slippageBps || 200,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: params.expiresIn ? Date.now() + (params.expiresIn * 60000) : undefined,
      isPrivate: !!params.isPrivate
    };

    // Update Cache
    this.orders.set(order.id, order);

    // Persist to DB
    try {
      const newOrder: NewLimitOrder = {
        id: order.id,
        walletPublicKey: order.walletPublicKey,
        tokenMint: order.tokenMint,
        tokenSymbol: order.tokenSymbol,
        type: order.type,
        targetPriceUsd: order.targetPrice.toString(),
        solAmount: order.solAmount.toString(),
        slippageBps: order.slippageBps,
        condition: order.type === 'BUY' ? 'BELOW' : 'ABOVE', // Buy when price drops, Sell when price rises
        exitStrategy: order.exitStrategy,
        status: order.status,
        createdAt: new Date(order.createdAt),
        expiresAt: order.expiresAt ? new Date(order.expiresAt) : null,
        isPrivate: order.isPrivate
      };

      await db.insert(limitOrdersTable).values(newOrder);
      console.log(`[LimitOrderManager] Created ${order.type} limit order ${order.id} for ${params.tokenMint.slice(0, 8)}... at $${params.targetPrice}`);
    } catch (error) {
      console.error('[LimitOrderManager] Error saving limit order to DB:', error);
    }

    return order;
  }

  /**
   * Get all orders
   */
  getAllOrders(): LimitOrder[] {
    return Array.from(this.orders.values());
  }

  /**
   * Get orders for a specific wallet
   */
  getOrdersByWallet(walletPublicKey: string): LimitOrder[] {
    return Array.from(this.orders.values())
      .filter(order => order.walletPublicKey === walletPublicKey);
  }

  /**
   * Get pending orders for a specific token
   */
  getPendingOrdersForToken(tokenMint: string): LimitOrder[] {
    return Array.from(this.orders.values())
      .filter(order => order.tokenMint === tokenMint && (order.status === 'pending' || order.status === 'active' as any));
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): LimitOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: LimitOrder['status'], signature?: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    // Update Cache
    order.status = status;
    if (signature) {
      order.signature = signature;
    }

    // Update DB
    try {
      await db.update(limitOrdersTable)
        .set({ 
          status, 
          signature: signature || null,
          filledAt: status === 'filled' ? new Date() : null
        })
        .where(eq(limitOrdersTable.id, orderId));
        
      console.log(`[LimitOrderManager] Updated order ${orderId} status to ${status}`);
      return true;
    } catch (error) {
      console.error('[LimitOrderManager] Error updating order status in DB:', error);
      return false;
    }
  }

  /**
   * Mark order as executing
   */
  async markExecuting(orderId: string): Promise<boolean> {
    return this.updateOrderStatus(orderId, 'executing');
  }

  /**
   * Mark order as filled
   */
  async markFilled(orderId: string, signature: string, positionMint: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    order.status = 'filled';
    order.signature = signature;
    order.positionMint = positionMint;

    // Update DB
    try {
      await db.update(limitOrdersTable)
        .set({ 
          status: 'filled', 
          signature, 
          filledAt: new Date() 
        })
        .where(eq(limitOrdersTable.id, orderId));
        
      console.log(`[LimitOrderManager] Order ${orderId} filled with signature ${signature}`);
      return true;
    } catch (error) {
      console.error('[LimitOrderManager] Error marking order as filled in DB:', error);
      return false;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status === 'executing') {
      console.log(`[LimitOrderManager] Cannot cancel order ${orderId} - currently executing`);
      return false;
    }

    return this.updateOrderStatus(orderId, 'cancelled');
  }

  /**
   * Check if an order should be executed based on current price
   */
  async shouldExecuteOrder(order: LimitOrder, currentPrice: number): Promise<boolean> {
    // Check if order is pending
    if (order.status !== 'pending') return false;

    // Check if expired
    if (order.expiresAt && Date.now() > order.expiresAt) {
      await this.updateOrderStatus(order.id, 'expired');
      return false;
    }

    // Check if price target is hit
    // For buy limit orders, execute when current price <= target price
    if (order.type === 'BUY') {
      return currentPrice <= order.targetPrice;
    } else {
      // For sell limit orders, execute when current price >= target price
      return currentPrice >= order.targetPrice;
    }
  }

  /**
   * Get all executable orders (price target hit)
   */
  async getExecutableOrders(tokenMint: string, currentPrice: number): Promise<LimitOrder[]> {
    const pendingOrders = this.getPendingOrdersForToken(tokenMint);
    const executable: LimitOrder[] = [];
    
    for (const order of pendingOrders) {
      if (await this.shouldExecuteOrder(order, currentPrice)) {
        executable.push(order);
      }
    }
    
    return executable;
  }

  /**
   * Clean up old filled/cancelled/expired orders
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    const cutoffTime = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    let removed = 0;

    const idsToRemove: string[] = [];
    for (const [id, order] of this.orders.entries()) {
      if (
        (order.status === 'filled' || order.status === 'cancelled' || order.status === 'expired') &&
        order.createdAt < cutoffTime.getTime()
      ) {
        idsToRemove.push(id);
      }
    }

    if (idsToRemove.length > 0) {
      try {
        for (const id of idsToRemove) {
          await db.delete(limitOrdersTable).where(eq(limitOrdersTable.id, id));
          this.orders.delete(id);
          removed++;
        }
        console.log(`[LimitOrderManager] Cleaned up ${removed} old limit orders from DB`);
      } catch (error) {
        console.error('[LimitOrderManager] Error cleaning up limit orders in DB:', error);
      }
    }

    return removed;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const allOrders = this.getAllOrders();

    return {
      total: allOrders.length,
      pending: allOrders.filter(o => o.status === 'pending').length,
      executing: allOrders.filter(o => o.status === 'executing').length,
      filled: allOrders.filter(o => o.status === 'filled').length,
      cancelled: allOrders.filter(o => o.status === 'cancelled').length,
      expired: allOrders.filter(o => o.status === 'expired').length
    };
  }
}

// Singleton instance
export const limitOrderManager = new LimitOrderManager();
