/**
 * Solana Trading Bot - Format Utilities
 * Helper functions for formatting numbers, dates, and strings
 */

/**
 * Format number as currency
 */
export function formatCurrency(amount: number, decimals: number = 2): string {
  return `$${amount.toFixed(decimals)}`;
}

/**
 * Format number as percentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers with K/M/B suffix
 */
export function formatCompact(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: number, decimals: number = 9): number {
  return amount / Math.pow(10, decimals);
}

/**
 * Format duration in minutes to human readable
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

/**
 * Format timestamp to ISO string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Format trade amount for display
 */
export function formatTradeAmount(amount: number, symbol: string): string {
  if (amount >= 1) return `${amount.toFixed(2)} ${symbol}`;
  if (amount >= 0.0001) return `${amount.toFixed(4)} ${symbol}`;
  return `${amount.toExponential(2)} ${symbol}`;
}
