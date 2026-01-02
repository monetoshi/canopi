/**
 * API Client
 * Handles all API requests to the backend
 */

import axios, { AxiosError } from 'axios';
import type { ApiResponse, Position, WalletBalance, StrategyConfig, PriceData, ExitStrategy, DCAOrder, DCAStrategyType, PendingDCABuy, DCAStatistics, PendingSell, BotStatus, Trade, LimitOrder } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 2 minutes for long-running private transactions
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to inject Admin Key from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const adminKey = localStorage.getItem('admin_api_key');
    if (adminKey) {
      config.headers['x-admin-key'] = adminKey;
    }
  }
  return config;
});

/**
 * Unlock wallet
 */
export async function unlockWallet(password: string): Promise<boolean> {
  try {
    const response = await api.post<ApiResponse>('/api/wallet/unlock', { password });
    return response.data.success;
  } catch (error) {
    console.error('Error unlocking wallet:', error);
    if (error instanceof AxiosError && error.response) {
      throw new Error(error.response.data.error || 'Failed to unlock wallet');
    }
    throw error;
  }
}

/**
 * Get bot wallet status
 */
export async function getBotStatus(): Promise<BotStatus> {
  try {
    const response = await api.get<ApiResponse<BotStatus>>('/api/bot/status');
    if (!response.data.success || !response.data.data) {
       // Return default "not configured" state on error
       return { configured: false, publicKey: null, balance: 0 };
    }
    return response.data.data;
  } catch (error) {
    console.error('Error getting bot status:', error);
    return { configured: false, publicKey: null, balance: 0 };
  }
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(publicKey: string): Promise<WalletBalance> {
  try {
    const response = await api.get<ApiResponse<WalletBalance>>(`/api/wallet/balance/${publicKey}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get balance');
    }
    return response.data.data;
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    throw error;
  }
}

/**
 * Get user positions
 */
export async function getPositions(publicKey: string): Promise<Position[]> {
  try {
    const response = await api.get<ApiResponse<Position[]>>(`/api/wallet/positions/${publicKey}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get positions');
    }
    return response.data.data || [];
  } catch (error) {
    console.error('Error getting positions:', error);
    throw error;
  }
}

/**
 * Get all available strategies
 */
export async function getStrategies(): Promise<Record<ExitStrategy, StrategyConfig>> {
  try {
    const response = await api.get<ApiResponse<Record<ExitStrategy, StrategyConfig>>>('/api/strategies');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get strategies');
    }
    return response.data.data;
  } catch (error) {
    console.error('Error getting strategies:', error);
    throw error;
  }
}

/**
 * Execute buy transaction using Bot Wallet (Server-Side)
 */
export async function executeBotTrade(params: {
  tokenMint: string;
  solAmount: number;
  strategy?: ExitStrategy;
  slippageBps?: number;
  isPrivate?: boolean;
}): Promise<{ signature: string; position: Position }> {
  try {
    const response = await api.post<ApiResponse>('/api/bot/trade', params);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to execute bot trade');
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
}

/**
 * Prepare buy transaction
 */
export async function prepareBuyTransaction(params: {
  walletPublicKey: string;
  tokenMint: string;
  solAmount: number;
  slippageBps?: number;
  strategy?: ExitStrategy;
}): Promise<any> {
  try {
    const response = await api.post<ApiResponse>('/api/snipe/prepare', params);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to prepare transaction');
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
}

/**
 * Execute buy transaction
 */
export async function executeBuyTransaction(params: {
  walletPublicKey: string;
  signedTransaction: string;
  tokenMint: string;
  solAmount: number;
  strategy?: ExitStrategy;
  expectedOutput?: number;
}): Promise<{ signature: string; position: Position }> {
  try {
    const response = await api.post<ApiResponse>('/api/snipe/execute', params);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to execute transaction');
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
}

/**
 * Prepare sell transaction
 */
export async function prepareSellTransaction(params: {
  walletPublicKey: string;
  tokenMint: string;
  percentage: number;
  slippageBps?: number;
}): Promise<any> {
  try {
    const response = await api.post<ApiResponse>('/api/exit/prepare', params);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to prepare sell');
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
}

/**
 * Get Telegram connection status
 */
export async function getTelegramStatus(walletPublicKey: string): Promise<{ linked: boolean; username: string | null; botUsername: string }> {
  try {
    const response = await api.get<ApiResponse<{ linked: boolean; username: string | null; botUsername: string }>>(`/api/telegram/status/${walletPublicKey}`);
    if (!response.data.success || !response.data.data) {
      throw new Error('Failed to get Telegram status');
    }
    return response.data.data;
  } catch (error) {
    console.error('Error getting Telegram status:', error);
    return { linked: false, username: null, botUsername: 'CanopiTradingBot' };
  }
}

/**
 * Create a new limit order
 */
export async function createLimitOrder(params: {
  walletPublicKey: string;
  tokenMint: string;
  type?: 'BUY' | 'SELL';
  tokenSymbol?: string;
  targetPrice: number;
  solAmount: number;
  exitStrategy: ExitStrategy;
  slippageBps?: number;
  expiresIn?: number;
}): Promise<LimitOrder> {
  try {
    const response = await api.post<ApiResponse<LimitOrder>>('/api/limit-orders', params);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create limit order');
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
}

/**
 * Generate Telegram Link Code
 */
export async function generateTelegramLinkCode(walletPublicKey: string): Promise<{ code: string; botUsername: string }> {
  try {
    const response = await api.post<ApiResponse<{ code: string; botUsername: string }>>('/api/telegram/link', { walletPublicKey });
    if (!response.data.success || !response.data.data) {
      throw new Error('Failed to generate Telegram link code');
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
}

/**
 * Get transaction history
 */
export async function getTrades(publicKey: string): Promise<Trade[]> {
  try {
    const response = await api.get<ApiResponse<Trade[]>>(`/api/trades/${publicKey}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get trades');
    }
    return response.data.data || [];
  } catch (error) {
    console.error('Error getting trades:', error);
    return [];
  }
}

/**
 * Execute sell transaction using Bot Wallet or Ephemeral Wallet (Server-Side)
 */
export async function executeBotExit(params: {
  tokenMint: string;
  walletPublicKey: string;
  percentage: number;
  slippageBps?: number;
}): Promise<{ signature: string }> {
  try {
    const response = await api.post<ApiResponse>('/api/bot/exit', params);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to execute bot exit');
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
}

/**
 * Execute sell transaction
 */
export async function executeSellTransaction(params: {
  walletPublicKey: string;
  tokenMint: string;
  signedTransaction: string;
  percentage: number;
}): Promise<{ signature: string }> {
  try {
    const response = await api.post<ApiResponse>('/api/exit/execute', params);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to execute sell');
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
}

export interface WatchlistItem {
  mint: string;
  symbol: string;
  addedAt: number;
}

export interface ShieldedStatus {
  available: number;
  availableRaw: string;
  poolAddress: string;
}

/**
 * Get shielded balance (ShadowWire)
 */
export async function getShieldedStatus(walletAddress: string): Promise<ShieldedStatus | null> {
  try {
    const response = await api.get<ApiResponse<ShieldedStatus>>(`/api/privacy/status/${walletAddress}`);
    return response.data.data || null;
  } catch (error) {
    console.error('Error getting shielded status:', error);
    return null;
  }
}

/**
 * Shield funds (Deposit)
 */
export async function shieldFunds(amount: number): Promise<{ signature: string }> {
  const response = await api.post<ApiResponse<{ signature: string }>>('/api/privacy/shield', { amount });
  if (!response.data.success || !response.data.data) throw new Error(response.data.error || 'Shielding failed');
  return response.data.data;
}

/**
 * Unshield funds (Withdraw)
 */
export async function unshieldFunds(amount: number): Promise<{ signature: string }> {
  const response = await api.post<ApiResponse<{ signature: string }>>('/api/privacy/unshield', { amount });
  if (!response.data.success || !response.data.data) throw new Error(response.data.error || 'Unshielding failed');
  return response.data.data;
}

/**
 * Get watchlist
 */
export async function getWatchlist(walletPublicKey: string): Promise<WatchlistItem[]> {
  try {
    const response = await api.get<ApiResponse<WatchlistItem[]>>(`/api/watchlist/${walletPublicKey}`);
    return response.data.data || [];
  } catch (error) {
    console.error('Error getting watchlist:', error);
    return [];
  }
}

/**
 * Add to watchlist
 */
export async function addToWatchlist(walletPublicKey: string, mint: string, symbol: string): Promise<WatchlistItem[]> {
  try {
    const response = await api.post<ApiResponse<WatchlistItem[]>>('/api/watchlist', { walletPublicKey, mint, symbol });
    return response.data.data || [];
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    return [];
  }
}

/**
 * Remove from watchlist
 */
export async function removeFromWatchlist(walletPublicKey: string, mint: string): Promise<WatchlistItem[]> {
  try {
    const response = await api.delete<ApiResponse<WatchlistItem[]>>(`/api/watchlist/${walletPublicKey}/${mint}`);
    return response.data.data || [];
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    return [];
  }
}

/**
 * Get OHLCV chart data
 */
export async function getChartData(
  mint: string,
  timeframe: string = '15m',
  limit: number = 100
): Promise<PriceData[]> {
  try {
    const response = await api.get<ApiResponse>(`/api/chart/ohlcv/${mint}`, {
      params: { timeframe, limit },
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get chart data');
    }
    return response.data.data?.candles || [];
  } catch (error) {
    console.error('Error getting chart data:', error);
    return [];
  }
}

/**
 * Get current price
 */
export async function getCurrentPrice(mint: string): Promise<number | null> {
  try {
    const response = await api.get<ApiResponse>(`/api/chart/price/${mint}`);
    if (!response.data.success) {
      return null;
    }
    return response.data.data?.price || null;
  } catch (error) {
    console.error('Error getting price:', error);
    return null;
  }
}

/**
 * Get statistics
 */
export async function getStatistics(): Promise<any> {
  try {
    const response = await api.get<ApiResponse>('/api/stats');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get statistics');
    }
    return response.data.data;
  } catch (error) {
    console.error('Error getting statistics:', error);
    return null;
  }
}

// ===== DCA API Functions =====

/**
 * Create a new DCA order
 */
export async function createDCAOrder(params: {
  walletPublicKey: string;
  tokenMint: string;
  tokenSymbol?: string;
  totalSolAmount: number;
  numberOfBuys: number;
  intervalMinutes: number;
  strategyType: DCAStrategyType;
  exitStrategy: ExitStrategy;
  slippageBps?: number;
  referencePrice?: number;
  isPrivate?: boolean;
}): Promise<DCAOrder> {
  try {
    const response = await api.post<ApiResponse<DCAOrder>>('/api/dca-orders', params);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create DCA order');
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
}

/**
 * Get DCA orders for a wallet
 */
export async function getDCAOrders(publicKey: string): Promise<DCAOrder[]> {
  try {
    const response = await api.get<ApiResponse<DCAOrder[]>>(`/api/dca-orders/${publicKey}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get DCA orders');
    }
    return response.data.data || [];
  } catch (error) {
    console.error('Error getting DCA orders:', error);
    return [];
  }
}

/**
 * Get specific DCA order by ID
 */
export async function getDCAOrder(orderId: string): Promise<DCAOrder | null> {
  try {
    const response = await api.get<ApiResponse<DCAOrder>>(`/api/dca-orders/order/${orderId}`);
    if (!response.data.success || !response.data.data) {
      return null;
    }
    return response.data.data;
  } catch (error) {
    console.error('Error getting DCA order:', error);
    return null;
  }
}

/**
 * Pause a DCA order
 */
export async function pauseDCAOrder(orderId: string): Promise<boolean> {
  try {
    const response = await api.put<ApiResponse>(`/api/dca-orders/${orderId}/pause`);
    return response.data.success;
  } catch (error) {
    console.error('Error pausing DCA order:', error);
    return false;
  }
}

/**
 * Resume a DCA order
 */
export async function resumeDCAOrder(orderId: string): Promise<boolean> {
  try {
    const response = await api.put<ApiResponse>(`/api/dca-orders/${orderId}/resume`);
    return response.data.success;
  } catch (error) {
    console.error('Error resuming DCA order:', error);
    return false;
  }
}

/**
 * Cancel a DCA order
 */
export async function cancelDCAOrder(orderId: string): Promise<boolean> {
  try {
    const response = await api.delete<ApiResponse>(`/api/dca-orders/${orderId}`);
    return response.data.success;
  } catch (error) {
    console.error('Error cancelling DCA order:', error);
    return false;
  }
}

/**
 * Get all pending DCA buys
 */
export async function getAllPendingDCABuys(): Promise<PendingDCABuy[]> {
  try {
    const response = await api.get<ApiResponse<PendingDCABuy[]>>('/api/dca-pending-buys');
    if (!response.data.success) {
      return [];
    }
    return response.data.data || [];
  } catch (error) {
    console.error('Error getting pending DCA buys:', error);
    return [];
  }
}

/**
 * Get pending DCA buys for a wallet
 */
export async function getPendingDCABuys(publicKey: string): Promise<PendingDCABuy[]> {
  try {
    const response = await api.get<ApiResponse<PendingDCABuy[]>>(`/api/dca-pending-buys/${publicKey}`);
    if (!response.data.success) {
      return [];
    }
    return response.data.data || [];
  } catch (error) {
    console.error('Error getting pending DCA buys:', error);
    return [];
  }
}

/**
 * Execute a pending DCA buy
 */
export async function executeDCABuy(params: {
  orderId: string;
  buyNumber: number;
  signature: string;
  actualTokenAmount: number;
  actualSolSpent: number;
  actualPrice: number;
}): Promise<boolean> {
  try {
    const response = await api.post<ApiResponse>('/api/dca-pending-buys/execute', params);
    return response.data.success;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
}

/**
 * Get DCA statistics
 */
export async function getDCAStats(): Promise<{ orders: DCAStatistics; executor: any } | null> {
  try {
    const response = await api.get<ApiResponse>('/api/dca-stats');
    if (!response.data.success) {
      return null;
    }
    return response.data.data;
  } catch (error) {
    console.error('Error getting DCA stats:', error);
    return null;
  }
}

// ===== Pending Sells API Functions (Auto-Exit) =====

/**
 * Get pending sells for a wallet
 */
export async function getPendingSells(publicKey: string): Promise<PendingSell[]> {
  try {
    const response = await api.get<ApiResponse<PendingSell[]>>(`/api/pending-sells/${publicKey}`);
    if (!response.data.success) {
      return [];
    }
    return response.data.data || [];
  } catch (error) {
    console.error('Error getting pending sells:', error);
    return [];
  }
}

/**
 * Execute a pending sell
 */
export async function executePendingSell(params: {
  id: string;
  signedTransaction: string;
}): Promise<{ signature: string }> {
  try {
    const response = await api.post<ApiResponse>(`/api/pending-sells/${params.id}/execute`, {
      signedTransaction: params.signedTransaction
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to execute pending sell');
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
}

/**
 * Cancel a pending sell
 */
export async function cancelPendingSell(id: string): Promise<boolean> {
  try {
    const response = await api.delete<ApiResponse>(`/api/pending-sells/${id}`);
    return response.data.success;
  } catch (error) {
    console.error('Error cancelling pending sell:', error);
    return false;
  }
}