/**
 * API Client
 * Handles all API requests to the backend
 */

import axios, { AxiosError } from 'axios';
import type { ApiResponse, Position, WalletBalance, StrategyConfig, PriceData, ExitStrategy, DCAOrder, DCAStrategyType, PendingDCABuy, DCAStatistics } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
