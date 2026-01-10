/**
 * Frontend Type Definitions
 * Shared types between frontend and backend
 */

export type ExitStrategy =
  | 'manual'
  | 'scalping'
  | 'aggressive'
  | 'moderate'
  | 'slow'
  | 'hodl1'
  | 'hodl2'
  | 'hodl3'
  | 'swing'
  | 'breakout'
  | 'trailing'
  | 'grid'
  | 'conservative'
  | 'takeProfit'
  | 'dca';

export interface ExitStage {
  timeMinutes?: number;
  sellPercent: number;
  minProfitPercent: number;
}

export interface StrategyConfig {
  exitStages: ExitStage[];
  maxHoldTime: number;
  stopLossPercent: number;
  isPercentageBased: boolean;
  description: string;
  details: string[];
}

export interface Position {
  mint: string;
  walletPublicKey: string;
  entryTime: number;
  entryPrice: number;
  tokenAmount: number;
  solSpent: number;
  exitStagesCompleted: number;
  strategy: ExitStrategy;
  isPercentageBased: boolean;
  /** Highest profit percentage achieved */
  highestProfit: number;
  /** Current status of the position */
  status: 'active' | 'closing' | 'closed';
  /** Whether this position was executed privately */
  isPrivate?: boolean;
  /** The public key of the wallet that actually holds the tokens (different from walletPublicKey if private) */
  executionWallet?: string;
  /** Optional: Current price */
  currentPrice?: number;
  currentProfit?: number;
}

export interface PriceData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface WalletBalance {
  publicKey: string;
  sol: number;
  solUsd: number;
}

export type EntryStrategy =
  | 'instant'
  | 'limit'
  | 'dca'
  | 'breakout'
  | 'dip';

export interface LimitOrder {
  id: string;
  walletPublicKey: string;
  type: 'BUY' | 'SELL';
  tokenMint: string;
  tokenSymbol?: string;
  targetPrice: number;
  solAmount: number;
  exitStrategy: ExitStrategy;
  slippageBps: number;
  status: 'pending' | 'executing' | 'filled' | 'cancelled' | 'expired';
  createdAt: number;
  expiresAt?: number;
  signature?: string;
  positionMint?: string;
}

// DCA Types
export type DCAStrategyType = 'time-based' | 'price-based';

export type DCAOrderStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface DCABuyExecution {
  buyNumber: number;
  timestamp: number;
  solAmount: number;
  tokenAmount: number;
  price: number;
  signature: string;
  positionMint: string;
  executionWallet?: string;
}

export interface DCAOrder {
  id: string;
  walletPublicKey: string;
  tokenMint: string;
  tokenSymbol?: string;
  strategyType: DCAStrategyType;
  totalSolAmount: number;
  numberOfBuys: number;
  intervalMinutes: number;
  exitStrategy: ExitStrategy;
  slippageBps: number;
  currentBuy: number;
  status: DCAOrderStatus;
  createdAt: number;
  lastBuyAt?: number;
  nextBuyAt?: number;
  completedBuys: DCABuyExecution[];
  referencePrice?: number;
  isPrivate?: boolean;
}

export interface PendingDCABuy {
  orderId: string;
  buyNumber: number;
  tokenMint: string;
  tokenSymbol?: string;
  solAmount: number;
  currentPrice: number;
  estimatedTokenAmount: number;
  walletPublicKey: string;
  slippageBps: number;
  exitStrategy: string;
  timestamp: number;
}

export interface DCAStatistics {
  total: number;
  active: number;
  paused: number;
  completed: number;
  cancelled: number;
  totalSolAllocated: number;
  totalSolSpent: number;
}

// Pending Sell Types (Auto-Exit)
export interface PendingSell {
  id: string;
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
  status: 'pending' | 'executing' | 'executed' | 'cancelled' | 'expired';
  createdAt: number;
  expiresAt: number;
  signature?: string;
}

export interface BotStatus {
  configured: boolean;
  isLocked?: boolean;
  publicKey: string | null;
  balance: number;
}

export interface Trade {
  id: string;
  walletPublicKey: string;
  tokenMint: string;
  positionId: string | null;
  type: string;
  solAmount: string;
  tokenAmount: string;
  priceUsd: string;
  priceSol: string;
  feeSol: string;
  entryStrategy: string | null;
  exitStrategy: string | null;
  signature: string;
  timestamp: string;
  costBasisUsd: string | null;
  costBasisMethod: string | null;
  realizedGainLossUsd: string | null;
  holdingPeriodDays: number | null;
  isShortTerm: boolean | null;
  isWashSale: boolean | null;
  washSaleDisallowed: string | null;
}
