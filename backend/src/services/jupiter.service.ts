/**
 * Solana Trading Bot - Jupiter Service
 * Integrates with Jupiter Aggregator V6 for DEX swaps
 */

import axios, { AxiosError } from 'axios';
import { networkService } from './network.service';

// Updated Jupiter API endpoints (October 2025)
// Old quote-api.jup.ag/v6 was deprecated, now using lite-api.jup.ag/swap/v1 for free tier
const JUPITER_API = 'https://lite-api.jup.ag/swap/v1';
const JUPITER_PRICE_API = 'https://lite-api.jup.ag/price/v2';

/**
 * Jupiter Service
 * Handles all Jupiter API interactions for token swaps
 */
export class JupiterService {
  private lastPriceError: number = 0;
  private errorSuppressionMs: number = 60000; // Only log errors once per minute
  /**
   * Get a swap quote from Jupiter
   * @param inputMint - Input token mint address
   * @param outputMint - Output token mint address
   * @param amount - Amount in smallest units (e.g., lamports for SOL)
   * @param slippageBps - Slippage in basis points (default: 200 = 2%)
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 200
  ) {
    try {
      console.log(`[Jupiter] Fetching quote: ${amount} ${inputMint.slice(0, 6)}... -> ${outputMint.slice(0, 6)}...`);

      const response = await axios.get(`${JUPITER_API}/quote`, {
        params: {
          inputMint,
          outputMint,
          amount: amount.toString(),
          slippageBps,
          onlyDirectRoutes: false,
          asLegacyTransaction: false
        },
        timeout: 10000,
        ...networkService.getAxiosConfig()
      });

      if (!response.data) {
        throw new Error('No quote data received from Jupiter');
      }

      console.log(`[Jupiter] Quote received: ${response.data.outAmount} out`);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        console.error('[Jupiter] Quote error:', error.response?.data || error.message);
        throw new Error(`Jupiter quote failed: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get swap transaction from Jupiter
   * @param quote - Quote response from getQuote()
   * @param userPublicKey - User's wallet public key
   * @param wrapUnwrapSOL - Auto wrap/unwrap SOL (default: true)
   */
  async getSwapTransaction(
    quote: any,
    userPublicKey: string,
    wrapUnwrapSOL: boolean = true
  ) {
    try {
      console.log(`[Jupiter] Creating swap transaction for ${userPublicKey.slice(0, 8)}...`);

      const response = await axios.post(
        `${JUPITER_API}/swap`,
        {
          quoteResponse: quote,
          userPublicKey,
          wrapAndUnwrapSol: wrapUnwrapSOL,
          prioritizationFeeLamports: 'auto' // Use prioritization fee (mutually exclusive with computeUnitPrice)
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          ...networkService.getAxiosConfig()
        }
      );

      if (!response.data || !response.data.swapTransaction) {
        throw new Error('No swap transaction received from Jupiter');
      }

      console.log('[Jupiter] Swap transaction created successfully');
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        console.error('[Jupiter] Swap transaction error:', error.response?.data || error.message);
        throw new Error(`Jupiter swap failed: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get token price from Jupiter Price API
   * @param mints - Array of token mint addresses
   */
  async getPrices(mints: string[]): Promise<Record<string, { price: number }>> {
    // Price API is currently disabled - use mock prices for development
    // Jupiter's Price API v2 requires authentication and v3+ endpoints are not yet stable
    // For production, integrate with DexScreener or Birdeye API

    console.log('[Jupiter] Price API disabled - using mock prices');

    const mockPrices: Record<string, { price: number }> = {};

    // Return mock price for SOL
    if (mints.includes('So11111111111111111111111111111111111111112')) {
      mockPrices['So11111111111111111111111111111111111111112'] = { price: 100 };
    }

    // Return mock prices for other tokens (for testing)
    mints.forEach(mint => {
      if (!mockPrices[mint]) {
        mockPrices[mint] = { price: 0.00015 }; // Mock price
      }
    });

    return mockPrices;
  }

  /**
   * Get single token price
   * @param mint - Token mint address
   */
  async getPrice(mint: string): Promise<number | null> {
    try {
      const prices = await this.getPrices([mint]);
      return prices[mint]?.price || null;
    } catch (error) {
      console.error('[Jupiter] Single price fetch error:', error);
      return null;
    }
  }

  /**
   * Get all supported tokens from Jupiter
   * @param chainId - Solana chain ID (default: 101 = mainnet)
   */
  async getTokenList(chainId: number = 101) {
    try {
      console.log('[Jupiter] Fetching token list');

      const response = await axios.get(`https://token.jup.ag/all`, {
        timeout: 10000,
        ...networkService.getAxiosConfig()
      });

      if (!response.data) {
        throw new Error('No token list received from Jupiter');
      }

      // Filter by chain if needed
      const tokens = response.data.filter((token: any) => token.chainId === chainId);
      console.log(`[Jupiter] Loaded ${tokens.length} tokens`);

      return tokens;
    } catch (error) {
      console.error('[Jupiter] Token list error:', error);
      return [];
    }
  }

  /**
   * Validate if a token is supported by Jupiter
   * @param mint - Token mint address
   */
  async isTokenSupported(mint: string): Promise<boolean> {
    try {
      const price = await this.getPrice(mint);
      return price !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate expected output for a swap
   * @param inputMint - Input token mint
   * @param outputMint - Output token mint
   * @param amount - Input amount
   * @param slippageBps - Slippage in basis points
   */
  async calculateOutput(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 200
  ): Promise<{
    inputAmount: number;
    outputAmount: number;
    minimumOutput: number;
    priceImpact: number;
  } | null> {
    try {
      const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);

      const minimumOutput = Math.floor(
        Number(quote.outAmount) * (1 - slippageBps / 10000)
      );

      return {
        inputAmount: Number(quote.inAmount),
        outputAmount: Number(quote.outAmount),
        minimumOutput,
        priceImpact: quote.priceImpactPct || 0
      };
    } catch (error) {
      console.error('[Jupiter] Calculate output error:', error);
      return null;
    }
  }
}

// Singleton instance
export const jupiterService = new JupiterService();
