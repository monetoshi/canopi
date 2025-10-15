/**
 * Solana Trading Bot - Position Manager
 * Manages all active trading positions across multiple wallets
 */

import { Position, ExitStrategy } from '../types';
import { getStrategy } from './strategies';
import * as fs from 'fs';
import * as path from 'path';

const POSITIONS_FILE = path.join(__dirname, '../../data/positions.json');

/**
 * Position Manager
 * Tracks and manages all active trading positions
 */
export class PositionManager {
  // Map of wallet address -> array of positions
  private positions: Map<string, Position[]> = new Map();

  constructor() {
    // Load positions from disk on startup
    this.loadPositions();
  }

  /**
   * Load positions from disk
   */
  private loadPositions(): void {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.dirname(POSITIONS_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Load positions from file
      if (fs.existsSync(POSITIONS_FILE)) {
        const data = fs.readFileSync(POSITIONS_FILE, 'utf-8');
        const positionsArray: Position[] = JSON.parse(data);

        // Rebuild Map from array
        this.positions.clear();
        for (const position of positionsArray) {
          const key = position.walletPublicKey;
          if (!this.positions.has(key)) {
            this.positions.set(key, []);
          }
          this.positions.get(key)!.push(position);
        }

        console.log(`[PositionManager] Loaded ${positionsArray.length} positions from disk`);
      } else {
        console.log('[PositionManager] No saved positions found, starting fresh');
      }
    } catch (error) {
      console.error('[PositionManager] Error loading positions:', error);
    }
  }

  /**
   * Save positions to disk
   */
  private savePositions(): void {
    try {
      const allPositions = this.getAllPositions();
      fs.writeFileSync(POSITIONS_FILE, JSON.stringify(allPositions, null, 2));
      console.log(`[PositionManager] Saved ${allPositions.length} positions to disk`);
    } catch (error) {
      console.error('[PositionManager] Error saving positions:', error);
    }
  }

  /**
   * Add a new position
   */
  addPosition(position: Position): void {
    const key = position.walletPublicKey;
    if (!this.positions.has(key)) {
      this.positions.set(key, []);
    }
    this.positions.get(key)!.push(position);
    console.log(`[PositionManager] Added position: ${position.mint} for ${key.slice(0, 8)}...`);
    this.savePositions(); // Persist to disk
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
   * Update a position
   */
  updatePosition(walletPublicKey: string, mint: string, updates: Partial<Position>): boolean {
    const positions = this.positions.get(walletPublicKey);
    if (!positions) return false;

    const position = positions.find(p => p.mint === mint && p.status === 'active');
    if (position) {
      Object.assign(position, updates);
      console.log(`[PositionManager] Updated position: ${mint} for ${walletPublicKey.slice(0, 8)}...`);
      this.savePositions(); // Persist to disk
      return true;
    }
    return false;
  }

  /**
   * Update position with current price and calculate profit
   */
  updatePositionPrice(walletPublicKey: string, mint: string, currentPrice: number): Position | null {
    const position = this.getPosition(walletPublicKey, mint);
    if (!position) return null;

    // Don't update with obvious mock/fallback prices
    // The default Jupiter mock price is exactly 0.00015
    if (currentPrice === 0.00015) {
      console.log(`[PositionManager] Skipping mock price update for ${mint.slice(0, 8)}, keeping current: $${position.currentPrice}`);
      return position;
    }

    const currentProfit = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

    // Update highest profit if current is higher
    if (currentProfit > position.highestProfit) {
      position.highestProfit = currentProfit;
    }

    position.currentPrice = currentPrice;
    position.currentProfit = currentProfit;

    // Persist to disk so the real price is saved
    this.savePositions();

    return position;
  }

  /**
   * Mark position as closing
   */
  markClosing(walletPublicKey: string, mint: string): boolean {
    return this.updatePosition(walletPublicKey, mint, { status: 'closing' });
  }

  /**
   * Close a position
   */
  closePosition(walletPublicKey: string, mint: string): boolean {
    return this.updatePosition(walletPublicKey, mint, { status: 'closed' });
  }

  /**
   * Remove a position entirely (cleanup)
   */
  removePosition(walletPublicKey: string, mint: string): boolean {
    const positions = this.positions.get(walletPublicKey);
    if (!positions) return false;

    const index = positions.findIndex(p => p.mint === mint);
    if (index !== -1) {
      positions.splice(index, 1);
      console.log(`[PositionManager] Removed position: ${mint} for ${walletPublicKey.slice(0, 8)}...`);
      this.savePositions(); // Persist to disk
      return true;
    }
    return false;
  }

  /**
   * Check if position should exit based on strategy
   * Returns { shouldExit: boolean, percentage: number, reason: string }
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

      // For percentage-based strategies, only check profit
      if (strategy.isPercentageBased) {
        if (currentProfit >= nextStage.minProfitPercent) {
          return {
            shouldExit: true,
            percentage: nextStage.sellPercent,
            reason: `Stage ${currentStage + 1}: ${currentProfit.toFixed(2)}% profit reached`
          };
        }
      }
      // For time-based strategies, check both time and profit
      else {
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
  incrementExitStage(walletPublicKey: string, mint: string): boolean {
    const position = this.getPosition(walletPublicKey, mint);
    if (!position) return false;

    position.exitStagesCompleted++;
    console.log(`[PositionManager] Position ${mint} completed stage ${position.exitStagesCompleted}`);
    this.savePositions(); // Persist to disk
    return true;
  }

  /**
   * Get statistics across all positions
   */
  getStatistics() {
    const allPositions = this.getAllPositions();
    const activePositions = this.getAllActivePositions();

    const totalPositions = allPositions.length;
    const activeCount = activePositions.length;
    const closedCount = allPositions.filter(p => p.status === 'closed').length;

    const totalInvested = allPositions.reduce((sum, p) => sum + p.solSpent, 0);
    const avgHoldTime = allPositions
      .filter(p => p.status === 'closed')
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
  clear(): void {
    this.positions.clear();
    console.log('[PositionManager] All positions cleared');
  }
}

// Singleton instance
export const positionManager = new PositionManager();
