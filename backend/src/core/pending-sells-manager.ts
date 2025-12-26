/**
 * Solana Trading Bot - Pending Sells Manager
 * Manages pending exit transactions waiting for user approval
 * Uses Drizzle ORM + PGLite for persistence
 */

import { PendingSell, ExitStrategy } from '../types';
import { db } from '../db/index';
import { pendingSells as pendingSellsTable, NewPendingSell } from '../db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Pending Sells Manager
 * Tracks exit transactions detected by exit-executor that need user approval
 */
export class PendingSellsManager {
  private pendingSells: Map<string, PendingSell> = new Map();
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
      const allSells = await db.select().from(pendingSellsTable);
      
      this.pendingSells.clear();
      for (const sell of allSells) {
        const pendingSell: PendingSell = {
          id: sell.id,
          walletPublicKey: sell.walletPublicKey,
          tokenMint: sell.tokenMint,
          tokenSymbol: sell.tokenSymbol || undefined,
          sellPercentage: sell.sellPercentage,
          tokenAmount: parseFloat(sell.tokenAmount),
          currentPrice: parseFloat(sell.currentPrice),
          entryPrice: parseFloat(sell.entryPrice),
          currentProfit: parseFloat(sell.currentProfit),
          estimatedSolReceived: parseFloat(sell.estimatedSolReceived),
          reason: sell.reason,
          strategy: sell.strategy as ExitStrategy,
          slippageBps: sell.slippageBps || 300,
          preparedTransaction: sell.preparedTransaction,
          status: sell.status as any,
          createdAt: sell.createdAt.getTime(),
          expiresAt: sell.expiresAt.getTime(),
          signature: sell.signature || undefined
        };
        this.pendingSells.set(pendingSell.id, pendingSell);
      }
      
      this.initialized = true;
      console.log(`[PendingSellsManager] Loaded ${allSells.length} pending sells from database`);
    } catch (error) {
      console.error('[PendingSellsManager] Error initializing from database:', error);
    }
  }

  /**
   * Create a new pending sell
   */
  async createPendingSell(params: {
    walletPublicKey: string;
    tokenMint: string;
    tokenSymbol?: string;
    sellPercentage: number;
    tokenAmount: number;
    currentPrice: number;
    entryPrice: number;
    currentProfit: number;
    estimatedSolReceived: number;
    reason: string;
    strategy: ExitStrategy;
    slippageBps: number;
    preparedTransaction: string;
    expiresInMinutes?: number;
  }): Promise<PendingSell> {
    const now = Date.now();
    const expiresIn = params.expiresInMinutes || 30; // Default 30 minutes

    const pendingSell: PendingSell = {
      id: uuidv4(),
      walletPublicKey: params.walletPublicKey,
      tokenMint: params.tokenMint,
      tokenSymbol: params.tokenSymbol,
      sellPercentage: params.sellPercentage,
      tokenAmount: params.tokenAmount,
      currentPrice: params.currentPrice,
      entryPrice: params.entryPrice,
      currentProfit: params.currentProfit,
      estimatedSolReceived: params.estimatedSolReceived,
      reason: params.reason,
      strategy: params.strategy,
      slippageBps: params.slippageBps,
      preparedTransaction: params.preparedTransaction,
      status: 'pending',
      createdAt: now,
      expiresAt: now + (expiresIn * 60000)
    };

    // Update Cache
    this.pendingSells.set(pendingSell.id, pendingSell);

    // Persist to DB
    try {
      const newRecord: NewPendingSell = {
        id: pendingSell.id,
        walletPublicKey: pendingSell.walletPublicKey,
        tokenMint: pendingSell.tokenMint,
        tokenSymbol: pendingSell.tokenSymbol,
        sellPercentage: pendingSell.sellPercentage,
        tokenAmount: pendingSell.tokenAmount.toString(),
        currentPrice: pendingSell.currentPrice.toString(),
        entryPrice: pendingSell.entryPrice.toString(),
        currentProfit: pendingSell.currentProfit.toString(),
        estimatedSolReceived: pendingSell.estimatedSolReceived.toString(),
        reason: pendingSell.reason,
        strategy: pendingSell.strategy,
        slippageBps: pendingSell.slippageBps,
        preparedTransaction: pendingSell.preparedTransaction,
        status: pendingSell.status,
        createdAt: new Date(pendingSell.createdAt),
        expiresAt: new Date(pendingSell.expiresAt)
      };

      await db.insert(pendingSellsTable).values(newRecord);
      
      console.log(
        `[PendingSellsManager] Created pending sell ${pendingSell.id} for ${params.tokenMint.slice(0, 8)}... ` +
        `(${params.sellPercentage}% @ ${params.currentProfit.toFixed(2)}% profit)`
      );
    } catch (error) {
      console.error('[PendingSellsManager] Error saving pending sell to DB:', error);
    }

    return pendingSell;
  }

  /**
   * Get all pending sells
   */
  getAllPendingSells(): PendingSell[] {
    return Array.from(this.pendingSells.values());
  }

  /**
   * Get pending sells for a specific wallet
   */
  getPendingSellsByWallet(walletPublicKey: string): PendingSell[] {
    return Array.from(this.pendingSells.values())
      .filter(sell => sell.walletPublicKey === walletPublicKey && sell.status === 'pending');
  }

  /**
   * Get pending sells for a specific token
   */
  getPendingSellsByToken(tokenMint: string): PendingSell[] {
    return Array.from(this.pendingSells.values())
      .filter(sell => sell.tokenMint === tokenMint && sell.status === 'pending');
  }

  /**
   * Get pending sell by ID
   */
  getPendingSell(id: string): PendingSell | undefined {
    return this.pendingSells.get(id);
  }

  /**
   * Update pending sell status
   */
  async updateStatus(id: string, status: PendingSell['status'], signature?: string): Promise<boolean> {
    const sell = this.pendingSells.get(id);
    if (!sell) return false;

    // Update Cache
    sell.status = status;
    if (signature) {
      sell.signature = signature;
    }

    // Update DB
    try {
      await db.update(pendingSellsTable)
        .set({ 
          status, 
          signature: signature || null,
          updatedAt: new Date() 
        })
        .where(eq(pendingSellsTable.id, id));
        
      console.log(`[PendingSellsManager] Updated pending sell ${id} status to ${status}`);
      return true;
    } catch (error) {
      console.error('[PendingSellsManager] Error updating status in DB:', error);
      return false;
    }
  }

  /**
   * Mark pending sell as executing
   */
  async markExecuting(id: string): Promise<boolean> {
    return this.updateStatus(id, 'executing');
  }

  /**
   * Mark pending sell as executed
   */
  async markExecuted(id: string, signature: string): Promise<boolean> {
    return this.updateStatus(id, 'executed', signature);
  }

  /**
   * Cancel a pending sell
   */
  async cancel(id: string): Promise<boolean> {
    const sell = this.pendingSells.get(id);
    if (!sell) return false;

    if (sell.status === 'executing') {
      console.log(`[PendingSellsManager] Cannot cancel pending sell ${id} - currently executing`);
      return false;
    }

    return this.updateStatus(id, 'cancelled');
  }

  /**
   * Check for expired pending sells and mark them
   */
  async expireOldPendingSells(): Promise<number> {
    const now = new Date();
    let expiredCount = 0;

    // Update Cache
    for (const [id, sell] of this.pendingSells.entries()) {
      if (sell.status === 'pending' && Date.now() > sell.expiresAt) {
        sell.status = 'expired';
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      try {
        await db.update(pendingSellsTable)
          .set({ status: 'expired' })
          .where(and(
            eq(pendingSellsTable.status, 'pending'),
            lt(pendingSellsTable.expiresAt, now)
          ));
        console.log(`[PendingSellsManager] Expired ${expiredCount} pending sells`);
      } catch (error) {
        console.error('[PendingSellsManager] Error expiring sells in DB:', error);
      }
    }

    return expiredCount;
  }

  /**
   * Check if a pending sell already exists for a position
   */
  hasPendingSellForPosition(walletPublicKey: string, tokenMint: string): boolean {
    return Array.from(this.pendingSells.values()).some(
      sell =>
        sell.walletPublicKey === walletPublicKey &&
        sell.tokenMint === tokenMint &&
        sell.status === 'pending'
    );
  }

  /**
   * Clean up old executed/cancelled/expired pending sells
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    const cutoffTime = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    let removed = 0;

    const idsToRemove: string[] = [];
    for (const [id, sell] of this.pendingSells.entries()) {
      if (
        (sell.status === 'executed' || sell.status === 'cancelled' || sell.status === 'expired') &&
        sell.createdAt < cutoffTime.getTime()
      ) {
        idsToRemove.push(id);
      }
    }

    if (idsToRemove.length > 0) {
      try {
        for (const id of idsToRemove) {
          await db.delete(pendingSellsTable).where(eq(pendingSellsTable.id, id));
          this.pendingSells.delete(id);
          removed++;
        }
        console.log(`[PendingSellsManager] Cleaned up ${removed} old pending sells from DB`);
      } catch (error) {
        console.error('[PendingSellsManager] Error cleaning up old sells in DB:', error);
      }
    }

    return removed;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const all = this.getAllPendingSells();

    return {
      total: all.length,
      pending: all.filter(s => s.status === 'pending').length,
      executing: all.filter(s => s.status === 'executing').length,
      executed: all.filter(s => s.status === 'executed').length,
      cancelled: all.filter(s => s.status === 'cancelled').length,
      expired: all.filter(s => s.status === 'expired').length
    };
  }
}

// Singleton instance
export const pendingSellsManager = new PendingSellsManager();
