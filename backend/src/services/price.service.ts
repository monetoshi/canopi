/**
 * Solana Trading Bot - Price Service
 * Fetches and caches token prices from multiple sources
 */

import axios from 'axios';
import NodeCache from 'node-cache';
import { PriceData } from '../types';
import { jupiterService } from './jupiter.service';
import { networkService } from './network.service';

// Cache with 10 second TTL for fresher prices
const priceCache = new NodeCache({ stdTTL: 10 });
const ohlcvCache = new NodeCache({ stdTTL: 60 });

/**
 * Price Service
 * Aggregates price data from multiple sources with caching
 */
export class PriceService {
  /**
   * Get current price for a token
   * @param mint - Token mint address
   * @returns Price in USD or null if not found
   */
  async getCurrentPrice(mint: string): Promise<number | null> {
    // Check cache first
    const cached = priceCache.get<number>(`price:${mint}`);
    if (cached !== undefined) {
      console.log(`[PriceService] Using cached price for ${mint.slice(0, 8)}: $${cached}`);
      return cached;
    }

    console.log(`[PriceService] Fetching price for ${mint.slice(0, 8)}...`);

    try {
      // Use DexScreener as primary source (Jupiter Price API requires auth)
      const dexPrice = await this.getPriceFromDexScreener(mint);
      if (dexPrice !== null) {
        console.log(`[PriceService] ✓ Got price from DexScreener: $${dexPrice}`);
        priceCache.set(`price:${mint}`, dexPrice);
        return dexPrice;
      }

      console.log(`[PriceService] ⚠️  DexScreener returned null, using mock price (NOT cached)`);

      // Fallback to Jupiter mock prices
      // NOTE: We don't cache mock prices - only real prices from DexScreener
      const price = await jupiterService.getPrice(mint);
      if (price !== null) {
        console.log(`[PriceService] Using fallback mock price: $${price} (not caching)`);
        return price;
      }

      return null;
    } catch (error) {
      console.error('[PriceService] Error in getCurrentPrice:', error);
      return null;
    }
  }

  /**
   * Get prices for multiple tokens
   * @param mints - Array of token mint addresses
   */
  async getPrices(mints: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};

    // Check cache for all mints
    const uncachedMints: string[] = [];
    for (const mint of mints) {
      const cached = priceCache.get<number>(`price:${mint}`);
      if (cached !== undefined) {
        prices[mint] = cached;
      } else {
        uncachedMints.push(mint);
      }
    }

    // Fetch uncached prices
    if (uncachedMints.length > 0) {
      try {
        const fetchedPrices = await jupiterService.getPrices(uncachedMints);

        for (const mint of uncachedMints) {
          const price = fetchedPrices[mint]?.price;
          if (price) {
            prices[mint] = price;
            // DON'T cache Jupiter mock prices - only real DexScreener prices should be cached
            // priceCache.set(`price:${mint}`, price);
            console.log(`[PriceService] Got Jupiter mock price for ${mint.slice(0, 8)}: $${price} (NOT caching)`);
          }
        }
      } catch (error) {
        console.error('[PriceService] getPrices error:', error);
      }
    }

    return prices;
  }

  /**
   * Get ONLY real price from DexScreener - no fallback to mock prices
   * Use this for updating positions so they don't get stuck with mock prices
   */
  async getRealPriceFromDexScreener(mint: string): Promise<number | null> {
    // Check cache first - but only return if it's a real cached price
    const cached = priceCache.get<number>(`price:${mint}`);
    if (cached !== undefined) {
      console.log(`[PriceService] Using cached REAL price for ${mint.slice(0, 8)}: $${cached}`);
      return cached;
    }

    // Fetch from DexScreener with retry logic
    return await this.getPriceFromDexScreener(mint);
  }

  /**
   * Get price from DexScreener (primary source now that Jupiter API requires auth)
   * Includes retry logic for better reliability
   */
  private async getPriceFromDexScreener(mint: string, retries = 2): Promise<number | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[PriceService] Retry ${attempt}/${retries} for ${mint.slice(0, 8)}...`);
          // Short delay before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.log(`[PriceService] Fetching from DexScreener: ${mint.slice(0, 8)}...`);
        }

        const response = await axios.get(
          `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
          { 
            timeout: 5000,
            ...networkService.getAxiosConfig()
          }
        );

        if (response.data?.pairs && response.data.pairs.length > 0) {
          // Get the pair with highest liquidity
          const bestPair = response.data.pairs
            .sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

          const price = parseFloat(bestPair.priceUsd);
          if (price && !isNaN(price)) {
            console.log(`[PriceService] DexScreener price for ${mint.slice(0, 8)}: $${price}`);
            return price;
          }
        }

        // If we got a response but no valid price, don't retry
        console.log(`[PriceService] No valid pairs found for ${mint.slice(0, 8)}`);
        return null;
      } catch (error) {
        if (error instanceof Error) {
          console.error(`[PriceService] DexScreener error (attempt ${attempt + 1}/${retries + 1}):`, error.message);
        }

        // If this was the last attempt, return null
        if (attempt === retries) {
          return null;
        }
        // Otherwise, continue to next retry
      }
    }

    return null;
  }

  /**
   * Get OHLCV data for charting
   * @param mint - Token mint address
   * @param timeframe - Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
   * @param limit - Number of candles to return
   */
  async getOHLCVData(
    mint: string,
    timeframe: string = '15m',
    limit: number = 100
  ): Promise<PriceData[]> {
    const cacheKey = `ohlcv:${mint}:${timeframe}:${limit}`;
    const cached = ohlcvCache.get<PriceData[]>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      // Try to fetch from Birdeye or DexScreener
      // For MVP, we'll generate mock data
      console.log(`[PriceService] Generating mock OHLCV for ${mint}`);
      const data = await this.generateMockOHLCV(mint, timeframe, limit);

      ohlcvCache.set(cacheKey, data, 60);
      return data;
    } catch (error) {
      console.error('[PriceService] getOHLCVData error:', error);
      return [];
    }
  }

  /**
   * Generate mock OHLCV data for testing
   * In production, replace with real API calls
   */
  private async generateMockOHLCV(
    mint: string,
    timeframe: string,
    count: number
  ): Promise<PriceData[]> {
    const data: PriceData[] = [];

    // Get current price as starting point
    let price = await this.getCurrentPrice(mint);
    if (!price) {
      price = 0.00015; // Fallback price
    }

    const now = Date.now();
    const timeframeMs = this.getTimeframeMs(timeframe);

    for (let i = count; i >= 0; i--) {
      const time = now - (i * timeframeMs);

      // Random walk with drift
      const change = (Math.random() - 0.48) * 0.02; // Slight upward bias
      price = price * (1 + change);

      const high = price * (1 + Math.random() * 0.015);
      const low = price * (1 - Math.random() * 0.015);
      const open = low + Math.random() * (high - low);
      const close = low + Math.random() * (high - low);

      data.push({
        time,
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000000 + 100000
      });
    }

    return data;
  }

  /**
   * Convert timeframe string to milliseconds
   */
  private getTimeframeMs(timeframe: string): number {
    const timeframes: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };

    return timeframes[timeframe] || timeframes['15m'];
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    priceCache.flushAll();
    ohlcvCache.flushAll();
    console.log('[PriceService] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      priceCache: priceCache.getStats(),
      ohlcvCache: ohlcvCache.getStats()
    };
  }
}

// Singleton instance
export const priceService = new PriceService();
