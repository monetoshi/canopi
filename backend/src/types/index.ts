/**
 * Solana Trading Bot - Type Definitions
 * Defines all core types and interfaces used throughout the application
 */

/**
 * Available exit strategy types
 * MANUAL:
 * - manual: User controls all exits manually
 *
 * TIME-BASED (Fast Trading):
 * - scalping: Ultra-fast 1-3min trades, 5-15% gains
 * - aggressive: Fast exits (8min)
 * - moderate: Balanced exits (20min)
 * - slow: Chart-friendly (50min)
 *
 * PERCENTAGE-BASED (HODL):
 * - hodl1: Percentage-based (hours-days)
 * - hodl2: Percentage-based (days-weeks)
 * - hodl3: Diamond hands (weeks-months)
 * - swing: Multi-day swing trading
 *
 * ADVANCED:
 * - breakout: Volume-based momentum trading
 * - trailing: Dynamic trailing stop loss
 * - grid: Range trading with multiple exits
 * - conservative: Very tight stop loss, safe exits
 * - takeProfit: Profit targets only, no stop loss (risky)
 * - dca: Conservative exits for DCA positions
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

/**
 * Exit stage configuration
 * Defines when and how much to sell at each stage
 */
export interface ExitStage {
  /** Time in minutes before this stage triggers (undefined for percentage-based) */
  timeMinutes?: number;
  /** Percentage of position to sell at this stage */
  sellPercent: number;
  /** Minimum profit percentage required to trigger this stage */
  minProfitPercent: number;
}

/**
 * Complete strategy configuration
 */
export interface StrategyConfig {
  /** Array of exit stages for this strategy */
  exitStages: ExitStage[];
  /** Maximum time to hold position (minutes) */
  maxHoldTime: number;
  /** Stop loss percentage (negative value) */
  stopLossPercent: number;
  /** Whether this strategy is percentage-based (vs time-based) */
  isPercentageBased: boolean;
  /** Human-readable description */
  description: string;
}

/**
 * Active trading position
 */
export interface Position {
  /** Token mint address */
  mint: string;
  /** Wallet public key that owns this position */
  walletPublicKey: string;
  /** Entry timestamp (milliseconds) */
  entryTime: number;
  /** Entry price in USD */
  entryPrice: number;
  /** Amount of tokens purchased */
  tokenAmount: number;
  /** Amount of SOL spent */
  solSpent: number;
  /** Number of exit stages completed */
  exitStagesCompleted: number;
  /** Strategy being used for this position */
  strategy: ExitStrategy;
  /** Whether using percentage-based exits */
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
  /** Optional: Current profit percentage */
  currentProfit?: number;
}

/**
 * OHLCV price data for charting
 */
export interface PriceData {
  /** Timestamp (milliseconds) */
  time: number;
  /** Opening price */
  open: number;
  /** Highest price in period */
  high: number;
  /** Lowest price in period */
  low: number;
  /** Closing price */
  close: number;
  /** Trading volume */
  volume: number;
}

/**
 * Token information
 */
export interface TokenInfo {
  /** Token mint address */
  mint: string;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Token decimals */
  decimals: number;
  /** Current price in USD */
  price?: number;
  /** Market cap */
  marketCap?: number;
  /** Liquidity */
  liquidity?: number;
}

/**
 * Wallet balance information
 */
export interface WalletBalance {
  /** Wallet public key */
  publicKey: string;
  /** SOL balance */
  sol: number;
  /** USD value of SOL */
  solUsd: number;
  /** Token balances */
  tokens: TokenBalance[];
}

/**
 * Individual token balance
 */
export interface TokenBalance {
  /** Token mint address */
  mint: string;
  /** Token amount */
  amount: number;
  /** Token decimals */
  decimals: number;
  /** Token symbol (if known) */
  symbol?: string;
  /** USD value (if available) */
  usdValue?: number;
}

/**
 * Trade execution request
 */
export interface TradeRequest {
  /** Wallet public key */
  walletPublicKey: string;
  /** Input token mint */
  inputMint: string;
  /** Output token mint */
  outputMint: string;
  /** Amount to trade (in smallest units) */
  amount: number;
  /** Slippage in basis points (default: 200 = 2%) */
  slippageBps?: number;
  /** Exit strategy to use */
  strategy?: ExitStrategy;
}

/**
 * Trade execution response
 */
export interface TradeResponse {
  /** Success status */
  success: boolean;
  /** Transaction signature (if successful) */
  signature?: string;
  /** Error message (if failed) */
  error?: string;
  /** Quote data */
  quote?: any;
  /** Position created (if buy) */
  position?: Position;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  /** Success status */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message */
  error?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType =
  | 'position_update'
  | 'price_update'
  | 'trade_executed'
  | 'error'
  | 'connection';

/**
 * WebSocket message
 */
export interface WebSocketMessage {
  /** Message type */
  type: WebSocketMessageType;
  /** Message data */
  data: any;
  /** Timestamp */
  timestamp: number;
}

/**
 * Trade notification
 */
export interface TradeNotification {
  /** Wallet public key */
  walletPublicKey: string;
  /** Token mint */
  mint: string;
  /** Trade type */
  type: 'buy' | 'sell';
  /** Amount traded */
  amount: number;
  /** Price at trade */
  price: number;
  /** Transaction signature */
  signature: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Entry strategy types
 */
export type EntryStrategy =
  | 'instant'
  | 'limit'
  | 'dca'
  | 'breakout'
  | 'dip';

/**
 * Limit order for automated token purchases
 */
export interface LimitOrder {
  /** Unique order ID */
  id: string;
  /** Wallet public key */
  walletPublicKey: string;
  /** Order type (BUY or SELL) */
  type: 'BUY' | 'SELL';
  /** Token mint to buy */
  tokenMint: string;
  /** Token symbol (if known) */
  tokenSymbol?: string;
  /** Target price in USD */
  targetPrice: number;
  /** Amount of SOL to spend */
  solAmount: number;
  /** Exit strategy to use when position is created */
  exitStrategy: ExitStrategy;
  /** Slippage tolerance in basis points */
  slippageBps: number;
  /** Order status */
  status: 'pending' | 'executing' | 'filled' | 'cancelled' | 'expired';
  /** Creation timestamp */
  createdAt: number;
  /** Expiration timestamp (optional) */
  expiresAt?: number;
  /** Transaction signature (when filled) */
  signature?: string;
  /** Position created (when filled) */
  positionMint?: string;
  /** Whether this order should be executed privately */
  isPrivate?: boolean;
  /** Address of ephemeral wallet (if private) */
  executionWallet?: string;
}

/**
 * Pending sell waiting for user approval
 * Created when exit conditions are met, executed when user approves
 */
export interface PendingSell {
  /** Unique pending sell ID */
  id: string;
  /** Wallet public key */
  walletPublicKey: string;
  /** Token mint to sell */
  tokenMint: string;
  /** Token symbol (if known) */
  tokenSymbol?: string;
  /** Percentage of position to sell (1-100) */
  sellPercentage: number;
  /** Amount of tokens to sell */
  tokenAmount: number;
  /** Current price at time of detection */
  currentPrice: number;
  /** Entry price of the position */
  entryPrice: number;
  /** Current profit percentage */
  currentProfit: number;
  /** Estimated SOL to receive from sale */
  estimatedSolReceived: number;
  /** Exit trigger reason */
  reason: string;
  /** Exit strategy that triggered this sell */
  strategy: ExitStrategy;
  /** Slippage tolerance in basis points */
  slippageBps: number;
  /** Prepared transaction (base64 encoded) */
  preparedTransaction: string;
  /** Status */
  status: 'pending' | 'executing' | 'executed' | 'cancelled' | 'expired';
  /** Creation timestamp */
  createdAt: number;
  /** Expiration timestamp (30 minutes default) */
  expiresAt: number;
  /** Transaction signature (when executed) */
  signature?: string;
}
