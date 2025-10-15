/**
 * Solana Trading Bot - Chart API
 * Endpoints for price data and charting
 */

import { Router, Request, Response } from 'express';
import { priceService } from '../services/price.service';
import { logger } from '../utils/logger.util';
import { ApiResponse } from '../types';

const router = Router();

/**
 * Get OHLCV data for charting
 * GET /api/chart/ohlcv/:mint
 * Query params: timeframe (1m, 5m, 15m, 1h, 4h, 1d), limit (number of candles)
 */
router.get('/ohlcv/:mint', async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;
    const timeframe = (req.query.timeframe as string) || '15m';
    const limit = parseInt(req.query.limit as string) || 100;

    if (!mint) {
      return res.status(400).json({
        success: false,
        error: 'Missing token mint'
      });
    }

    const ohlcvData = await priceService.getOHLCVData(mint, timeframe, limit);

    res.json({
      success: true,
      data: {
        mint,
        timeframe,
        candles: ohlcvData
      },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting OHLCV data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get OHLCV data'
    });
  }
});

/**
 * Get current price for a token
 * GET /api/chart/price/:mint
 */
router.get('/price/:mint', async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;

    if (!mint) {
      return res.status(400).json({
        success: false,
        error: 'Missing token mint'
      });
    }

    const price = await priceService.getCurrentPrice(mint);

    if (price === null) {
      return res.status(404).json({
        success: false,
        error: 'Price not found for token'
      });
    }

    res.json({
      success: true,
      data: {
        mint,
        price,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting price:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get price'
    });
  }
});

/**
 * Get prices for multiple tokens
 * POST /api/chart/prices
 * Body: { mints: string[] }
 */
router.post('/prices', async (req: Request, res: Response) => {
  try {
    const { mints } = req.body;

    if (!Array.isArray(mints) || mints.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mints array'
      });
    }

    const prices = await priceService.getPrices(mints);

    res.json({
      success: true,
      data: prices,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting prices:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get prices'
    });
  }
});

/**
 * Get cache statistics
 * GET /api/chart/cache-stats
 */
router.get('/cache-stats', (req: Request, res: Response) => {
  try {
    const stats = priceService.getCacheStats();

    res.json({
      success: true,
      data: stats,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get cache stats'
    });
  }
});

/**
 * Clear price cache (admin only)
 * POST /api/chart/clear-cache
 */
router.post('/clear-cache', (req: Request, res: Response) => {
  try {
    priceService.clearCache();

    res.json({
      success: true,
      data: { message: 'Cache cleared successfully' },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear cache'
    });
  }
});

export { router as chartRouter };
