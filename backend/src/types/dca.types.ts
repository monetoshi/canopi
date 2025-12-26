/**
 * DCA (Dollar Cost Averaging) Entry Strategy Types
 * For splitting buys across multiple transactions over time
 */

import { ExitStrategy } from './index';

/**
 * DCA Strategy Types
 */
export type DCAStrategyType =
  | 'time-based'    // Buy fixed amount at fixed intervals
  | 'price-based';  // Buy more when price drops, less when price rises

/**
 * DCA Order Configuration
 */
export interface DCAOrder {
  /** Unique order ID */
  id: string;
  /** Wallet public key */
  walletPublicKey: string;
  /** Token mint to buy */
  tokenMint: string;
  /** Token symbol (if known) */
  tokenSymbol?: string;
  /** DCA strategy type */
  strategyType: DCAStrategyType;
  /** Total SOL amount to spend across all buys */
  totalSolAmount: number;
  /** Number of individual buy transactions */
  numberOfBuys: number;
  /** Interval between buys (minutes) */
  intervalMinutes: number;
  /** Exit strategy to use for positions created */
  exitStrategy: ExitStrategy;
  /** Slippage tolerance in basis points */
  slippageBps: number;
  /** Current buy number (1-indexed) */
  currentBuy: number;
  /** Order status */
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  /** Creation timestamp */
  createdAt: number;
  /** Last buy timestamp */
  lastBuyAt?: number;
  /** Next buy timestamp */
  nextBuyAt?: number;
  /** Array of completed buy signatures */
  completedBuys: DCABuyExecution[];
  /** Reference price for price-based DCA */
  referencePrice?: number;
  /** Whether the DCA order is executed privately */
  isPrivate?: boolean;
}

/**
 * Individual DCA Buy Execution Record
 */
export interface DCABuyExecution {
  /** Buy number (1-indexed) */
  buyNumber: number;
  /** Timestamp */
  timestamp: number;
  /** SOL amount spent */
  solAmount: number;
  /** Token amount received */
  tokenAmount: number;
  /** Price at execution */
  price: number;
  /** Transaction signature */
  signature: string;
  /** Position mint created */
  positionMint: string;
  /** Wallet used for execution (if private) */
  executionWallet?: string;
}

/**
 * DCA Statistics
 */
export interface DCAStatistics {
  /** Total orders */
  total: number;
  /** Active orders */
  active: number;
  /** Paused orders */
  paused: number;
  /** Completed orders */
  completed: number;
  /** Cancelled orders */
  cancelled: number;
  /** Total SOL allocated */
  totalSolAllocated: number;
  /** Total SOL spent */
  totalSolSpent: number;
}
