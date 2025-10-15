/**
 * Solana Trading Bot - Limit Order Manager
 * Manages pending limit orders and executes them when price targets are hit
 */

import { LimitOrder, ExitStrategy } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const LIMIT_ORDERS_FILE = path.join(__dirname, '../../data/limit-orders.json');

/**
 * Limit Order Manager
 * Tracks and manages all pending limit orders
 */
export class LimitOrderManager {
  private orders: Map<string, LimitOrder> = new Map();

  constructor() {
    this.loadOrders();
  }

  /**
   * Load orders from disk
   */
  private loadOrders(): void {
    try {
      const dataDir = path.dirname(LIMIT_ORDERS_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(LIMIT_ORDERS_FILE)) {
        const data = fs.readFileSync(LIMIT_ORDERS_FILE, 'utf-8');
        const ordersArray: LimitOrder[] = JSON.parse(data);

        this.orders.clear();
        for (const order of ordersArray) {
          this.orders.set(order.id, order);
        }

        console.log(`[LimitOrderManager] Loaded ${ordersArray.length} limit orders from disk`);
      } else {
        console.log('[LimitOrderManager] No saved limit orders found, starting fresh');
      }
    } catch (error) {
      console.error('[LimitOrderManager] Error loading limit orders:', error);
    }
  }

  /**
   * Save orders to disk
   */
  private saveOrders(): void {
    try {
      const ordersArray = Array.from(this.orders.values());
      fs.writeFileSync(LIMIT_ORDERS_FILE, JSON.stringify(ordersArray, null, 2));
      console.log(`[LimitOrderManager] Saved ${ordersArray.length} limit orders to disk`);
    } catch (error) {
      console.error('[LimitOrderManager] Error saving limit orders:', error);
    }
  }

  /**
   * Create a new limit order
   */
  createOrder(params: {
    walletPublicKey: string;
    tokenMint: string;
    tokenSymbol?: string;
    targetPrice: number;
    solAmount: number;
    exitStrategy: ExitStrategy;
    slippageBps?: number;
    expiresIn?: number; // minutes
  }): LimitOrder {
    const order: LimitOrder = {
      id: uuidv4(),
      walletPublicKey: params.walletPublicKey,
      tokenMint: params.tokenMint,
      tokenSymbol: params.tokenSymbol,
      targetPrice: params.targetPrice,
      solAmount: params.solAmount,
      exitStrategy: params.exitStrategy,
      slippageBps: params.slippageBps || 200,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: params.expiresIn ? Date.now() + (params.expiresIn * 60000) : undefined
    };

    this.orders.set(order.id, order);
    this.saveOrders();

    console.log(`[LimitOrderManager] Created limit order ${order.id} for ${params.tokenMint.slice(0, 8)}... at $${params.targetPrice}`);

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
      .filter(order => order.tokenMint === tokenMint && order.status === 'pending');
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
  updateOrderStatus(orderId: string, status: LimitOrder['status'], signature?: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    order.status = status;
    if (signature) {
      order.signature = signature;
    }

    this.saveOrders();
    console.log(`[LimitOrderManager] Updated order ${orderId} status to ${status}`);

    return true;
  }

  /**
   * Mark order as executing
   */
  markExecuting(orderId: string): boolean {
    return this.updateOrderStatus(orderId, 'executing');
  }

  /**
   * Mark order as filled
   */
  markFilled(orderId: string, signature: string, positionMint: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    order.status = 'filled';
    order.signature = signature;
    order.positionMint = positionMint;

    this.saveOrders();
    console.log(`[LimitOrderManager] Order ${orderId} filled with signature ${signature}`);

    return true;
  }

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status === 'executing') {
      console.log(`[LimitOrderManager] Cannot cancel order ${orderId} - currently executing`);
      return false;
    }

    order.status = 'cancelled';
    this.saveOrders();

    console.log(`[LimitOrderManager] Cancelled order ${orderId}`);
    return true;
  }

  /**
   * Check if an order should be executed based on current price
   */
  shouldExecuteOrder(order: LimitOrder, currentPrice: number): boolean {
    // Check if order is pending
    if (order.status !== 'pending') return false;

    // Check if expired
    if (order.expiresAt && Date.now() > order.expiresAt) {
      this.updateOrderStatus(order.id, 'expired');
      return false;
    }

    // Check if price target is hit
    // For buy limit orders, execute when current price <= target price
    return currentPrice <= order.targetPrice;
  }

  /**
   * Get all executable orders (price target hit)
   */
  getExecutableOrders(tokenMint: string, currentPrice: number): LimitOrder[] {
    return this.getPendingOrdersForToken(tokenMint)
      .filter(order => this.shouldExecuteOrder(order, currentPrice));
  }

  /**
   * Clean up old filled/cancelled/expired orders
   */
  cleanup(olderThanDays: number = 7): number {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let removed = 0;

    for (const [id, order] of this.orders.entries()) {
      if (
        (order.status === 'filled' || order.status === 'cancelled' || order.status === 'expired') &&
        order.createdAt < cutoffTime
      ) {
        this.orders.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      this.saveOrders();
      console.log(`[LimitOrderManager] Cleaned up ${removed} old orders`);
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
