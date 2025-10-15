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
  highestProfit: number;
  status: 'active' | 'closing' | 'closed';
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

export interface TradeRequest {
  walletPublicKey: string;
  tokenMint: string;
  solAmount: number;
  slippageBps?: number;
  strategy?: ExitStrategy;
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
