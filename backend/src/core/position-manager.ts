/**
 * Solana Trading Bot - Position Manager
 * Manages all active trading positions across multiple wallets
 * Uses Drizzle ORM + PGLite for persistence and in-memory cache for speed
 */

import { Position, ExitStrategy } from '../types';
import { getStrategy } from './strategies';
import { logger } from '../utils/logger.util';
import { db } from '../db/index';
import { positions as positionsTable, NewPosition } from '../db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Position Manager
 * Tracks and manages all active trading positions
 */
export class PositionManager {
  // In-memory cache: wallet address -> array of positions
  private positions: Map<string, Position[]> = new Map();
  private initialized = false;
  private initPromise: Promise<void>;

  constructor() {
    // Load cache from DB on startup
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
      const allPositions = await db.select().from(positionsTable);
      
      this.positions.clear();
      for (const pos of allPositions) {
        // Map DB fields to Position type
        const position: Position = {
          mint: pos.tokenMint,
          walletPublicKey: pos.walletPublicKey,
          entryTime: pos.entryTime.getTime(),
          entryPrice: parseFloat(pos.entryPriceUsd),
          tokenAmount: parseFloat(pos.tokenAmount),
          solSpent: parseFloat(pos.solSpent),
          exitStagesCompleted: pos.exitStagesCompleted || 0,
          strategy: pos.strategy as ExitStrategy,
          isPercentageBased: false, // Default, updated by strategy config
          highestProfit: parseFloat(pos.highestProfit || '0'),
          status: pos.status as 'active' | 'closing' | 'closed',
          currentPrice: pos.currentPrice ? parseFloat(pos.currentPrice) : undefined,
          currentProfit: pos.currentProfit ? parseFloat(pos.currentProfit) : undefined,
          // Todo: Add isPrivate/executionWallet to DB schema if needed for full persistence
        };

        // Update percentage based flag from strategy config
        const strategyConfig = getStrategy(position.strategy);
        if (strategyConfig) {
          position.isPercentageBased = strategyConfig.isPercentageBased;
        }

        const key = position.walletPublicKey;
        if (!this.positions.has(key)) {
          this.positions.set(key, []);
        }
        this.positions.get(key)!.push(position);
      }
      
      this.initialized = true;
      console.log(`[PositionManager] Loaded ${allPositions.length} positions from database`);
    } catch (error) {
      console.error('[PositionManager] Error initializing from database:', error);
    }
  }

  /**
   * Add a new position
   */
  async addPosition(position: Position): Promise<void> {
    // Update Cache
    const key = position.walletPublicKey;
    if (!this.positions.has(key)) {
      this.positions.set(key, []);
    }
    this.positions.get(key)!.push(position);

    // Persist to DB
    try {
      const newPosition: NewPosition = {
        walletPublicKey: position.walletPublicKey,
        tokenMint: position.mint,
        entryTime: new Date(position.entryTime),
        entryPriceUsd: position.entryPrice.toString(),
        tokenAmount: position.tokenAmount.toString(),
        solSpent: position.solSpent.toString(),
        strategy: position.strategy,
        status: position.status,
        highestProfit: position.highestProfit.toString(),
        currentPrice: position.currentPrice?.toString(),
        currentProfit: position.currentProfit?.toString(),
        exitStagesCompleted: position.exitStagesCompleted
      };

      await db.insert(positionsTable).values(newPosition);
      console.log(`[PositionManager] Added position: ${position.mint} for ${key.slice(0, 8)}...`);
    } catch (error) {
      console.error('[PositionManager] Error saving position to DB:', error);
    }
  }

  /**
   * Get all positions for a specific wallet
   */
  getPositions(walletPublicKey: string): Position[] {
    return this.positions.get(walletPublicKey) || [];
  }

  /**
   * Get a specific position
   */
  getPosition(walletPublicKey: string, mint: string): Position | undefined {
    const positions = this.positions.get(walletPublicKey);
    if (!positions) return undefined;
    return positions.find(p => p.mint === mint && p.status === 'active');
  }

  /**
   * Add to an existing position by merging a new buy
   */
  public async addToPosition(
    walletPublicKey: string,
    mint: string,
    additionalTokens: number,
    additionalSolSpent: number,
    newEntryPrice: number
  ): Promise<void> {
    const position = this.getPosition(walletPublicKey, mint);

    if (!position) {
      throw new Error('Position not found');
    }

    if (position.status !== 'active') {
      throw new Error('Cannot add to closed position');
    }

    // Calculate new weighted average
    const oldCost = position.entryPrice * position.tokenAmount;
    const newCost = newEntryPrice * additionalTokens;
    const totalCost = oldCost + newCost;
    const totalTokens = position.tokenAmount + additionalTokens;
    const newAvgEntryPrice = totalCost / totalTokens;

    // Update Cache
    position.tokenAmount = totalTokens;
    position.solSpent = position.solSpent + additionalSolSpent;
    position.entryPrice = newAvgEntryPrice;
    position.exitStagesCompleted = 0;

    // Update DB
    try {
      await db.update(positionsTable)
        .set({
          tokenAmount: totalTokens.toString(),
          solSpent: position.solSpent.toString(),
          entryPriceUsd: newAvgEntryPrice.toString(),
          exitStagesCompleted: 0
        })
        .where(and(
          eq(positionsTable.walletPublicKey, walletPublicKey),
          eq(positionsTable.tokenMint, mint),
          eq(positionsTable.status, 'active')
        ));
        
      logger.info(`Added to position: ${mint} - New total: ${totalTokens} tokens, Avg entry: ${newAvgEntryPrice}`);
    } catch (error) {
      console.error('[PositionManager] Error updating position in DB:', error);
    }
  }

  /**
   * Get all active positions across all wallets
   */
  getAllActivePositions(): Position[] {
    const all: Position[] = [];
    for (const positions of this.positions.values()) {
      all.push(...positions.filter(p => p.status === 'active'));
    }
    return all;
  }

  /**
   * Get all positions (including closed)
   */
  getAllPositions(): Position[] {
    const all: Position[] = [];
    for (const positions of this.positions.values()) {
      all.push(...positions);
    }
    return all;
  }

  /**
   * Update a position (generic update)
   */
  async updatePosition(walletPublicKey: string, mint: string, updates: Partial<Position>): Promise<boolean> {
    const positions = this.positions.get(walletPublicKey);
    if (!positions) return false;

    const position = positions.find(p => p.mint === mint && p.status === 'active');
    if (position) {
      // Update Cache
      Object.assign(position, updates);
      console.log(`[PositionManager] Updated position: ${mint} for ${walletPublicKey.slice(0, 8)}...`);
      
      // Update DB
      try {
        const dbUpdates: any = {};
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.currentPrice !== undefined) dbUpdates.currentPrice = updates.currentPrice.toString();
        if (updates.currentProfit !== undefined) dbUpdates.currentProfit = updates.currentProfit.toString();
        if (updates.highestProfit !== undefined) dbUpdates.highestProfit = updates.highestProfit.toString();
        if (updates.exitStagesCompleted !== undefined) dbUpdates.exitStagesCompleted = updates.exitStagesCompleted;
        if (updates.tokenAmount !== undefined) dbUpdates.tokenAmount = updates.tokenAmount.toString();
        if (updates.solSpent !== undefined) dbUpdates.solSpent = updates.solSpent.toString();

        if (Object.keys(dbUpdates).length > 0) {
          await db.update(positionsTable)
            .set({ ...dbUpdates, updatedAt: new Date() })
            .where(and(
              eq(positionsTable.walletPublicKey, walletPublicKey),
              eq(positionsTable.tokenMint, mint),
              eq(positionsTable.status, 'active') // Only update active record in DB
            ));
        }
      } catch (error) {
        console.error('[PositionManager] Error syncing update to DB:', error);
      }
      
      return true;
    }
    return false;
  }

  /**
   * Update position with current price and calculate profit
   * (High frequency update - consider batching DB writes if performance suffers)
   */
  updatePositionPrice(walletPublicKey: string, mint: string, currentPrice: number): Position | null {
    const position = this.getPosition(walletPublicKey, mint);
    if (!position) return null;

    // Don't update with obvious mock/fallback prices
    if (currentPrice === 0.00015) {
      return position;
    }

    const currentProfit = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

    if (currentProfit > position.highestProfit) {
      position.highestProfit = currentProfit;
    }

    position.currentPrice = currentPrice;
    position.currentProfit = currentProfit;

    // Note: We don't await this to avoid blocking the loop
    // In production, we might want to debounce these DB writes
    this.persistPriceUpdate(walletPublicKey, mint, currentPrice, currentProfit, position.highestProfit);

    return position;
  }

  private async persistPriceUpdate(wallet: string, mint: string, price: number, profit: number, highestProfit: number) {
    try {
      await db.update(positionsTable)
        .set({
          currentPrice: price.toString(),
          currentProfit: profit.toString(),
          highestProfit: highestProfit.toString(),
          updatedAt: new Date()
        })
        .where(and(
          eq(positionsTable.walletPublicKey, wallet),
          eq(positionsTable.tokenMint, mint),
          eq(positionsTable.status, 'active')
        ));
    } catch (e) {
      // Silent fail for high freq updates
    }
  }

  /**
   * Mark position as closing
   */
  async markClosing(walletPublicKey: string, mint: string): Promise<boolean> {
    return this.updatePosition(walletPublicKey, mint, { status: 'closing' });
  }

  /**
   * Close a position
   */
  async closePosition(walletPublicKey: string, mint: string): Promise<boolean> {
    const success = await this.updatePosition(walletPublicKey, mint, { status: 'closed' });
    
    // Also remove from cache so it doesn't show up in active lists
    // But keep in DB as history
    if (success) {
      const positions = this.positions.get(walletPublicKey);
      if (positions) {
        const index = positions.findIndex(p => p.mint === mint);
        if (index !== -1) {
          // Remove from active cache (since getPosition filters by 'active' anyway, this is just cleanup)
          // positions.splice(index, 1); 
          // Actually, let's keep it in cache but marked closed, so UI can show "Recent Closed"
        }
      }
    }
    return success;
  }

  /**
   * Remove a position entirely (cleanup)
   */
  async removePosition(walletPublicKey: string, mint: string): Promise<boolean> {
    const positions = this.positions.get(walletPublicKey);
    if (!positions) return false;

    const index = positions.findIndex(p => p.mint === mint);
    if (index !== -1) {
      positions.splice(index, 1);
      
      try {
        await db.delete(positionsTable)
          .where(and(
            eq(positionsTable.walletPublicKey, walletPublicKey),
            eq(positionsTable.tokenMint, mint)
          ));
        console.log(`[PositionManager] Removed position: ${mint} for ${walletPublicKey.slice(0, 8)}...`);
      } catch (error) {
        console.error('[PositionManager] Error removing from DB:', error);
      }
      
      return true;
    }
    return false;
  }

  /**
   * Check if position should exit based on strategy
   */
  checkExitConditions(position: Position, currentPrice: number): {
    shouldExit: boolean;
    percentage: number;
    reason: string;
  } {
    const strategy = getStrategy(position.strategy);
    const currentProfit = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    const timeHeld = (Date.now() - position.entryTime) / 60000; // minutes
    const currentStage = position.exitStagesCompleted;

    // Manual strategy never auto-exits
    if (position.strategy === 'manual') {
      return {
        shouldExit: false,
        percentage: 0,
        reason: 'Manual control - no auto-exit'
      };
    }

    // Check stop loss
    if (currentProfit <= strategy.stopLossPercent) {
      return {
        shouldExit: true,
        percentage: 100,
        reason: `Stop loss triggered at ${currentProfit.toFixed(2)}%`
      };
    }

    // Check max hold time
    if (timeHeld >= strategy.maxHoldTime) {
      return {
        shouldExit: true,
        percentage: 100,
        reason: `Max hold time reached (${timeHeld.toFixed(0)}min)`
      };
    }

    // Check exit stages
    if (currentStage < strategy.exitStages.length) {
      const nextStage = strategy.exitStages[currentStage];

      if (strategy.isPercentageBased) {
        if (currentProfit >= nextStage.minProfitPercent) {
          return {
            shouldExit: true,
            percentage: nextStage.sellPercent,
            reason: `Stage ${currentStage + 1}: ${currentProfit.toFixed(2)}% profit reached`
          };
        }
      } else {
        if (nextStage.timeMinutes && timeHeld >= nextStage.timeMinutes) {
          if (currentProfit >= nextStage.minProfitPercent) {
            return {
              shouldExit: true,
              percentage: nextStage.sellPercent,
              reason: `Stage ${currentStage + 1}: Time reached with ${currentProfit.toFixed(2)}% profit`
            };
          }
        }
      }
    }

    return {
      shouldExit: false,
      percentage: 0,
      reason: 'No exit conditions met'
    };
  }

  /**
   * Increment exit stage for a position
   */
  async incrementExitStage(walletPublicKey: string, mint: string): Promise<boolean> {
    const position = this.getPosition(walletPublicKey, mint);
    if (!position) return false;

    position.exitStagesCompleted++;
    
    // Update DB
    try {
      await db.update(positionsTable)
        .set({ 
          exitStagesCompleted: position.exitStagesCompleted,
          updatedAt: new Date()
        })
        .where(and(
          eq(positionsTable.walletPublicKey, walletPublicKey),
          eq(positionsTable.tokenMint, mint),
          eq(positionsTable.status, 'active')
        ));
        
      console.log(`[PositionManager] Position ${mint} completed stage ${position.exitStagesCompleted}`);
    } catch (error) {
      console.error('[PositionManager] Error updating exit stage in DB:', error);
    }
    
    return true;
  }

  /**
   * Get statistics across all positions
   * (Now uses cached values, could optionally query DB for historical stats)
   */
  getStatistics() {
    // For now, use in-memory cache which holds active positions + recently closed
    // Ideally, we should query DB for full history
    const allPositions = Array.from(this.positions.values()).flat();
    const activePositions = allPositions.filter(p => p.status === 'active');
    const closedPositions = allPositions.filter(p => p.status === 'closed');

    const totalPositions = allPositions.length;
    const activeCount = activePositions.length;
    const closedCount = closedPositions.length;

    const totalInvested = allPositions.reduce((sum, p) => sum + p.solSpent, 0);
    
    // Simple average of held time for closed positions in memory
    const avgHoldTime = closedPositions
      .reduce((sum, p) => sum + (Date.now() - p.entryTime), 0) / (closedCount || 1);

    return {
      totalPositions,
      activeCount,
      closedCount,
      totalInvested,
      avgHoldTimeMinutes: avgHoldTime / 60000
    };
  }

  /**
   * Clear all positions (for testing)
   */
  async clear(): Promise<void> {
    this.positions.clear();
    try {
      await db.delete(positionsTable);
      console.log('[PositionManager] All positions cleared from DB');
    } catch (error) {
      console.error('[PositionManager] Error clearing DB:', error);
    }
  }
}

// Singleton instance
export const positionManager = new PositionManager();
