/**
 * Solana Trading Bot - Exit Strategies
 * Defines 6 automated exit strategies with different risk/reward profiles
 */

import { StrategyConfig, ExitStrategy } from '../types';

/**
 * Exit strategy configurations
 *
 * MANUAL STRATEGY:
 * - manual: User controls all exits manually (no auto-exit)
 *
 * TIME-BASED STRATEGIES:
 * - aggressive: Quick exits for volatile memecoins (8min max)
 * - moderate: Balanced approach for most tokens (20min max)
 * - slow: Patient exits for chart formation (50min max)
 *
 * PERCENTAGE-BASED STRATEGIES (HODL):
 * - hodl1: Short-term holds for DeFi protocols (hours-days)
 * - hodl2: Medium-term holds for utility tokens (days-weeks)
 * - hodl3: Long-term diamond hands (weeks-months)
 */
export const EXIT_STRATEGIES: Record<ExitStrategy, StrategyConfig> = {
  /**
   * MANUAL CONTROL STRATEGY
   * Best for: Traders who want full control
   * Exit: Completely manual - no automated exits
   * User decides when and how much to sell
   */
  manual: {
    exitStages: [],          // No automatic exit stages
    maxHoldTime: 999999999,  // Effectively unlimited
    stopLossPercent: -100,   // No automatic stop loss
    isPercentageBased: false,
    description: '🎮 MANUAL: Full manual control - you decide when to sell'
  },

  /**
   * AGGRESSIVE STRATEGY
   * Best for: Volatile memecoins, high-risk plays
   * Exit time: 8 minutes maximum
   * Target: 100%+ profit quickly
   * Stop loss: -20%
   */
  aggressive: {
    exitStages: [
      { timeMinutes: 2, sellPercent: 40, minProfitPercent: 30 },   // Sell 40% at 2min if +30%
      { timeMinutes: 5, sellPercent: 40, minProfitPercent: 60 },   // Sell 40% at 5min if +60%
      { timeMinutes: 8, sellPercent: 20, minProfitPercent: 100 },  // Sell 20% at 8min if +100%
    ],
    maxHoldTime: 10,         // Force sell everything at 10 minutes
    stopLossPercent: -20,    // Stop loss at -20%
    isPercentageBased: false,
    description: '⚡ AGGRESSIVE: Fast exits for volatile plays (8min max)'
  },

  /**
   * MODERATE STRATEGY
   * Best for: Mid-cap tokens, balanced risk
   * Exit time: 20 minutes maximum
   * Target: 300%+ profit
   * Stop loss: -30%
   */
  moderate: {
    exitStages: [
      { timeMinutes: 5, sellPercent: 25, minProfitPercent: 50 },   // Sell 25% at 5min if +50%
      { timeMinutes: 10, sellPercent: 25, minProfitPercent: 100 }, // Sell 25% at 10min if +100%
      { timeMinutes: 15, sellPercent: 25, minProfitPercent: 200 }, // Sell 25% at 15min if +200%
      { timeMinutes: 20, sellPercent: 25, minProfitPercent: 300 }, // Sell 25% at 20min if +300%
    ],
    maxHoldTime: 25,         // Force sell at 25 minutes
    stopLossPercent: -30,    // Stop loss at -30%
    isPercentageBased: false,
    description: '⚖️ MODERATE: Balanced exits for mid-cap plays (20min max)'
  },

  /**
   * SLOW STRATEGY
   * Best for: Tokens with chart patterns, trend following
   * Exit time: 50 minutes maximum
   * Target: 500%+ profit
   * Stop loss: -35%
   */
  slow: {
    exitStages: [
      { timeMinutes: 5, sellPercent: 10, minProfitPercent: 50 },   // Take 10% profit early
      { timeMinutes: 10, sellPercent: 10, minProfitPercent: 100 },
      { timeMinutes: 15, sellPercent: 15, minProfitPercent: 150 },
      { timeMinutes: 20, sellPercent: 15, minProfitPercent: 200 },
      { timeMinutes: 25, sellPercent: 15, minProfitPercent: 300 },
      { timeMinutes: 30, sellPercent: 15, minProfitPercent: 400 },
      { timeMinutes: 40, sellPercent: 10, minProfitPercent: 500 },
      { timeMinutes: 50, sellPercent: 10, minProfitPercent: 0 },   // Force exit remainder
    ],
    maxHoldTime: 60,         // Force sell at 60 minutes
    stopLossPercent: -35,    // Stop loss at -35%
    isPercentageBased: false,
    description: '🐢 SLOW: Patient exits for trend following (50min max)'
  },

  /**
   * HODL 1 STRATEGY
   * Best for: DeFi protocols, yield farms
   * Exit: Percentage-based (no time limit)
   * Target: 300%+ profit
   * Stop loss: -35%
   */
  hodl1: {
    exitStages: [
      { sellPercent: 25, minProfitPercent: 30 },   // Sell 25% at +30%
      { sellPercent: 25, minProfitPercent: 75 },   // Sell 25% at +75%
      { sellPercent: 25, minProfitPercent: 150 },  // Sell 25% at +150%
      { sellPercent: 25, minProfitPercent: 300 },  // Sell 25% at +300%
    ],
    maxHoldTime: 4320,       // 3 days max (in minutes)
    stopLossPercent: -35,    // Stop loss at -35%
    isPercentageBased: true, // Percentage-based, not time-based
    description: '💎 HODL 1: Percentage-based for DeFi protocols (hours-days)'
  },

  /**
   * HODL 2 STRATEGY
   * Best for: Utility tokens, projects with fundamentals
   * Exit: Percentage-based (no time limit)
   * Target: 800%+ profit
   * Stop loss: -40%
   */
  hodl2: {
    exitStages: [
      { sellPercent: 20, minProfitPercent: 50 },   // Sell 20% at +50%
      { sellPercent: 20, minProfitPercent: 100 },  // Sell 20% at +100%
      { sellPercent: 20, minProfitPercent: 200 },  // Sell 20% at +200%
      { sellPercent: 20, minProfitPercent: 400 },  // Sell 20% at +400%
      { sellPercent: 20, minProfitPercent: 800 },  // Sell 20% at +800%
    ],
    maxHoldTime: 10080,      // 7 days max (in minutes)
    stopLossPercent: -40,    // Stop loss at -40%
    isPercentageBased: true, // Percentage-based, not time-based
    description: '💎 HODL 2: Percentage-based for utility tokens (days-weeks)'
  },

  /**
   * HODL 3 STRATEGY
   * Best for: Long-term conviction plays, blue chips
   * Exit: Percentage-based (no time limit)
   * Target: 10000%+ profit (100x)
   * Stop loss: -50%
   */
  hodl3: {
    exitStages: [
      { sellPercent: 10, minProfitPercent: 100 },    // Sell 10% at +100% (2x)
      { sellPercent: 10, minProfitPercent: 200 },    // Sell 10% at +200% (3x)
      { sellPercent: 10, minProfitPercent: 400 },    // Sell 10% at +400% (5x)
      { sellPercent: 10, minProfitPercent: 900 },    // Sell 10% at +900% (10x)
      { sellPercent: 10, minProfitPercent: 1900 },   // Sell 10% at +1900% (20x)
      { sellPercent: 10, minProfitPercent: 4900 },   // Sell 10% at +4900% (50x)
      { sellPercent: 10, minProfitPercent: 9900 },   // Sell 10% at +9900% (100x)
    ],
    maxHoldTime: 43200,      // 30 days max (in minutes)
    stopLossPercent: -50,    // Stop loss at -50%
    isPercentageBased: true, // Percentage-based, not time-based
    description: '💎 HODL 3: Diamond hands for moon shots (weeks-months)'
  },

  /**
   * SCALPING STRATEGY
   * Best for: Ultra-fast momentum trades, high volatility
   * Exit time: 1-3 minutes maximum
   * Target: 5-15% quick profit
   * Stop loss: -10%
   */
  scalping: {
    exitStages: [
      { timeMinutes: 0.5, sellPercent: 50, minProfitPercent: 5 },   // Sell 50% at 30sec if +5%
      { timeMinutes: 1, sellPercent: 30, minProfitPercent: 10 },    // Sell 30% at 1min if +10%
      { timeMinutes: 2, sellPercent: 20, minProfitPercent: 15 },    // Sell 20% at 2min if +15%
    ],
    maxHoldTime: 3,          // Force sell at 3 minutes
    stopLossPercent: -10,    // Tight stop loss at -10%
    isPercentageBased: false,
    description: '⚡ SCALPING: Ultra-fast 1-3min trades for quick 5-15% gains'
  },

  /**
   * SWING TRADING STRATEGY
   * Best for: Multi-day holds, trend following
   * Exit: Percentage-based (no time limit)
   * Target: 200%+ profit over days
   * Stop loss: -25%
   */
  swing: {
    exitStages: [
      { sellPercent: 25, minProfitPercent: 40 },   // Sell 25% at +40%
      { sellPercent: 25, minProfitPercent: 80 },   // Sell 25% at +80%
      { sellPercent: 25, minProfitPercent: 120 },  // Sell 25% at +120%
      { sellPercent: 25, minProfitPercent: 200 },  // Sell 25% at +200%
    ],
    maxHoldTime: 7200,       // 5 days max (in minutes)
    stopLossPercent: -25,    // Stop loss at -25%
    isPercentageBased: true,
    description: '📊 SWING: Multi-day trend following for 40-200% gains'
  },

  /**
   * BREAKOUT STRATEGY
   * Best for: Volume spikes, momentum trading
   * Exit time: 15 minutes maximum
   * Target: 150%+ profit on breakout
   * Stop loss: -25%
   */
  breakout: {
    exitStages: [
      { timeMinutes: 3, sellPercent: 30, minProfitPercent: 40 },   // Quick profit on spike
      { timeMinutes: 7, sellPercent: 30, minProfitPercent: 80 },   // Ride the momentum
      { timeMinutes: 12, sellPercent: 20, minProfitPercent: 120 }, // Lock in gains
      { timeMinutes: 15, sellPercent: 20, minProfitPercent: 150 }, // Final exit
    ],
    maxHoldTime: 18,         // Force sell at 18 minutes
    stopLossPercent: -25,    // Stop loss at -25%
    isPercentageBased: false,
    description: '🚀 BREAKOUT: Volume-based momentum trading for 40-150% gains'
  },

  /**
   * TRAILING STOP LOSS STRATEGY
   * Best for: Locking in profits while riding trends
   * Exit: Percentage-based with tight trailing
   * Target: Let winners run
   * Stop loss: Dynamic trailing -15%
   */
  trailing: {
    exitStages: [
      { sellPercent: 20, minProfitPercent: 25 },   // Take 20% at +25%
      { sellPercent: 20, minProfitPercent: 60 },   // Take 20% at +60%
      { sellPercent: 20, minProfitPercent: 120 },  // Take 20% at +120%
      { sellPercent: 20, minProfitPercent: 250 },  // Take 20% at +250%
      { sellPercent: 20, minProfitPercent: 500 },  // Take 20% at +500%
    ],
    maxHoldTime: 2880,       // 2 days max (in minutes)
    stopLossPercent: -15,    // Tight trailing stop
    isPercentageBased: true,
    description: '📈 TRAILING: Dynamic stop loss locks in profits while riding trends'
  },

  /**
   * GRID TRADING STRATEGY
   * Best for: Range-bound tokens, choppy markets
   * Exit time: 30 minutes maximum
   * Target: Multiple small 10-30% exits
   * Stop loss: -20%
   */
  grid: {
    exitStages: [
      { timeMinutes: 5, sellPercent: 15, minProfitPercent: 10 },   // Exit 1
      { timeMinutes: 10, sellPercent: 15, minProfitPercent: 15 },  // Exit 2
      { timeMinutes: 15, sellPercent: 15, minProfitPercent: 20 },  // Exit 3
      { timeMinutes: 20, sellPercent: 15, minProfitPercent: 25 },  // Exit 4
      { timeMinutes: 25, sellPercent: 15, minProfitPercent: 30 },  // Exit 5
      { timeMinutes: 30, sellPercent: 25, minProfitPercent: 40 },  // Final exit
    ],
    maxHoldTime: 35,         // Force sell at 35 minutes
    stopLossPercent: -20,    // Stop loss at -20%
    isPercentageBased: false,
    description: '⚙️ GRID: Range trading with multiple 10-30% exits'
  },

  /**
   * CONSERVATIVE STRATEGY
   * Best for: Risk-averse traders, capital preservation
   * Exit time: 15 minutes maximum
   * Target: Safe 20-60% profit
   * Stop loss: Very tight -10%
   */
  conservative: {
    exitStages: [
      { timeMinutes: 3, sellPercent: 40, minProfitPercent: 10 },   // Quick 10% profit
      { timeMinutes: 7, sellPercent: 30, minProfitPercent: 20 },   // Safe 20% profit
      { timeMinutes: 12, sellPercent: 20, minProfitPercent: 40 },  // Good 40% profit
      { timeMinutes: 15, sellPercent: 10, minProfitPercent: 60 },  // Bonus 60% profit
    ],
    maxHoldTime: 18,         // Force sell at 18 minutes
    stopLossPercent: -10,    // Very tight stop loss
    isPercentageBased: false,
    description: '🛡️ CONSERVATIVE: Safe exits with tight -10% stop loss for 10-60% gains'
  },

  /**
   * TAKE PROFIT ONLY STRATEGY
   * Best for: High conviction plays, no stop loss
   * Exit: Percentage-based (no time limit)
   * Target: 500%+ profit or bust
   * Stop loss: NONE (risky!)
   */
  takeProfit: {
    exitStages: [
      { sellPercent: 20, minProfitPercent: 50 },    // Sell 20% at +50%
      { sellPercent: 20, minProfitPercent: 100 },   // Sell 20% at +100%
      { sellPercent: 20, minProfitPercent: 200 },   // Sell 20% at +200%
      { sellPercent: 20, minProfitPercent: 350 },   // Sell 20% at +350%
      { sellPercent: 20, minProfitPercent: 500 },   // Sell 20% at +500%
    ],
    maxHoldTime: 10080,      // 7 days max (in minutes)
    stopLossPercent: -100,   // NO STOP LOSS (can lose everything!)
    isPercentageBased: true,
    description: '💰 TAKE PROFIT: Profit targets only, NO stop loss - high risk/reward!'
  },

  /**
   * DCA (Dollar Cost Average) EXIT STRATEGY
   * Best for: Accumulated positions from multiple buys
   * Exit: Percentage-based with conservative targets
   * Target: 100%+ average profit
   * Stop loss: -30%
   */
  dca: {
    exitStages: [
      { sellPercent: 15, minProfitPercent: 20 },   // Sell 15% at +20%
      { sellPercent: 20, minProfitPercent: 40 },   // Sell 20% at +40%
      { sellPercent: 20, minProfitPercent: 70 },   // Sell 20% at +70%
      { sellPercent: 20, minProfitPercent: 100 },  // Sell 20% at +100%
      { sellPercent: 25, minProfitPercent: 150 },  // Sell 25% at +150%
    ],
    maxHoldTime: 14400,      // 10 days max (in minutes)
    stopLossPercent: -30,    // Stop loss at -30%
    isPercentageBased: true,
    description: '💵 DCA: Conservative exits for averaged-in positions (20-150% targets)'
  }
};

/**
 * Get strategy configuration by name
 */
export function getStrategy(strategy: ExitStrategy): StrategyConfig {
  return EXIT_STRATEGIES[strategy];
}

/**
 * Get all available strategies
 */
export function getAllStrategies(): Record<ExitStrategy, StrategyConfig> {
  return EXIT_STRATEGIES;
}

/**
 * Validate if a strategy name is valid
 */
export function isValidStrategy(strategy: string): strategy is ExitStrategy {
  return strategy in EXIT_STRATEGIES;
}

/**
 * Get strategy names as array
 */
export function getStrategyNames(): ExitStrategy[] {
  return Object.keys(EXIT_STRATEGIES) as ExitStrategy[];
}
