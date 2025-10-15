/**
 * Solana Trading Bot - Main API Server
 * Express server with wallet and trading endpoints
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { positionManager } from '../core/position-manager';
import { limitOrderManager } from '../core/limit-order-manager';
import { dcaOrderManager } from '../core/dca-order-manager';
import { dcaExecutor } from '../services/dca-executor';
import { jupiterService } from '../services/jupiter.service';
import { priceService } from '../services/price.service';
import { getConnection, getSOLBalance, isValidPublicKey } from '../utils/blockchain.util';
import { logger } from '../utils/logger.util';
import { ApiResponse, ExitStrategy, Position } from '../types';
import { getAllStrategies, isValidStrategy } from '../core/strategies';

const app = express();
const connection = getConnection();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime()
    }
  });
});

/**
 * Get wallet balance
 */
app.get('/api/wallet/balance/:publicKey', async (req: Request, res: Response) => {
  try {
    const { publicKey } = req.params;

    if (!isValidPublicKey(publicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid public key'
      });
    }

    const solBalance = await getSOLBalance(connection, publicKey);

    // Get SOL price from PriceService (uses DexScreener)
    const solPrice = await priceService.getCurrentPrice('So11111111111111111111111111111111111111112');

    // Use fallback SOL price if API unavailable (approximate $100 for demo)
    const effectiveSolPrice = solPrice || 100;

    res.json({
      success: true,
      data: {
        publicKey,
        sol: solBalance,
        solUsd: solBalance * effectiveSolPrice,
        timestamp: Date.now()
      }
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting wallet balance:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get wallet balance'
    });
  }
});

/**
 * Get user positions
 */
app.get('/api/wallet/positions/:publicKey', async (req: Request, res: Response) => {
  try {
    const { publicKey } = req.params;

    if (!isValidPublicKey(publicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid public key'
      });
    }

    const positions = positionManager.getPositions(publicKey);

    // Update positions with current prices - but ONLY use real DexScreener prices
    // This prevents positions from getting stuck with mock/fallback prices
    const updatedPositions = await Promise.all(
      positions.map(async (position) => {
        // Use getRealPriceFromDexScreener to avoid mock prices
        const realPrice = await priceService.getRealPriceFromDexScreener(position.mint);
        if (realPrice) {
          console.log(`[API] Updating position ${position.mint.slice(0, 8)} with REAL price: $${realPrice}`);
          positionManager.updatePositionPrice(publicKey, position.mint, realPrice);
        } else {
          console.log(`[API] No real price available for ${position.mint.slice(0, 8)}, keeping last known price: $${position.currentPrice}`);
        }
        return position;
      })
    );

    res.json({
      success: true,
      data: updatedPositions,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting positions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get positions'
    });
  }
});

/**
 * Get all available strategies
 */
app.get('/api/strategies', (req: Request, res: Response) => {
  try {
    const strategies = getAllStrategies();

    res.json({
      success: true,
      data: strategies,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting strategies:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get strategies'
    });
  }
});

/**
 * Prepare buy transaction
 */
app.post('/api/snipe/prepare', async (req: Request, res: Response) => {
  try {
    const { walletPublicKey, tokenMint, solAmount, slippageBps, strategy } = req.body;

    // Validation
    if (!isValidPublicKey(walletPublicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet public key'
      });
    }

    if (!isValidPublicKey(tokenMint)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token mint'
      });
    }

    if (!solAmount || solAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid SOL amount'
      });
    }

    if (strategy && !isValidStrategy(strategy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid strategy'
      });
    }

    // Convert SOL to lamports
    const lamports = Math.floor(solAmount * 1e9);

    // Get quote from Jupiter
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const quote = await jupiterService.getQuote(
      SOL_MINT,
      tokenMint,
      lamports,
      slippageBps || 200
    );

    // Get swap transaction
    const swapData = await jupiterService.getSwapTransaction(quote, walletPublicKey);

    logger.info(`Prepared buy transaction for ${walletPublicKey.slice(0, 8)}...`);

    res.json({
      success: true,
      data: {
        transaction: swapData.swapTransaction,
        quote,
        expectedOutput: quote.outAmount,
        priceImpact: quote.priceImpactPct
      },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error preparing buy transaction:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to prepare transaction'
    });
  }
});

/**
 * Execute signed transaction and create position
 */
app.post('/api/snipe/execute', async (req: Request, res: Response) => {
  try {
    const { walletPublicKey, signedTransaction, tokenMint, solAmount, strategy, expectedOutput } = req.body;

    if (!signedTransaction) {
      return res.status(400).json({
        success: false,
        error: 'Missing signed transaction'
      });
    }

    // Deserialize and send transaction
    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3
    });

    logger.info(`Transaction sent: ${signature}`);

    // Get entry price
    const entryPrice = await priceService.getCurrentPrice(tokenMint);

    // Use expected output from quote, or fallback to calculating from price
    let tokenAmount = 0;
    if (expectedOutput) {
      tokenAmount = Number(expectedOutput);
      logger.info(`Using expected output from quote: ${tokenAmount} tokens`);
    } else if (entryPrice && entryPrice > 0) {
      // Fallback: estimate tokens from SOL spent and entry price
      tokenAmount = Math.floor(solAmount / entryPrice);
      logger.warn(`No expected output provided, estimated ${tokenAmount} tokens from price`);
    }

    // Check if position already exists
    const existingPosition = positionManager.getPosition(walletPublicKey, tokenMint);

    if (existingPosition && existingPosition.status === 'active') {
      // Add to existing position
      positionManager.addToPosition(
        walletPublicKey,
        tokenMint,
        tokenAmount,
        solAmount,
        entryPrice || 0
      );
      logger.info(`Added to existing position: ${tokenMint}`);
    } else {
      // Create new position
      const position: Position = {
        mint: tokenMint,
        walletPublicKey,
        entryTime: Date.now(),
        entryPrice: entryPrice || 0,
        tokenAmount: tokenAmount,
        solSpent: solAmount,
        exitStagesCompleted: 0,
        strategy: (strategy as ExitStrategy) || 'manual',
        isPercentageBased: strategy === 'hodl1' || strategy === 'hodl2' || strategy === 'hodl3' || strategy === 'swing' || strategy === 'trailing' || strategy === 'takeProfit' || strategy === 'dca',
        highestProfit: 0,
        status: 'active',
        currentPrice: entryPrice || 0,
        currentProfit: 0
      };

      positionManager.addPosition(position);
      logger.info(`Created new position: ${tokenMint}`);
    }

    // Get the updated position to return
    const updatedPosition = positionManager.getPosition(walletPublicKey, tokenMint);

    res.json({
      success: true,
      data: {
        signature,
        position: updatedPosition
      },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error executing transaction:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute transaction'
    });
  }
});

/**
 * Prepare sell transaction
 */
app.post('/api/exit/prepare', async (req: Request, res: Response) => {
  try {
    const { walletPublicKey, tokenMint, percentage, slippageBps } = req.body;

    if (!isValidPublicKey(walletPublicKey) || !isValidPublicKey(tokenMint)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid public key or token mint'
      });
    }

    if (!percentage || percentage <= 0 || percentage > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid percentage (must be 1-100)'
      });
    }

    // Get position
    const position = positionManager.getPosition(walletPublicKey, tokenMint);
    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Position not found'
      });
    }

    // Calculate amount to sell
    const amountToSell = Math.floor(position.tokenAmount * (percentage / 100));

    // Get quote from Jupiter
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const quote = await jupiterService.getQuote(
      tokenMint,
      SOL_MINT,
      amountToSell,
      slippageBps || 200
    );

    // Get swap transaction
    const swapData = await jupiterService.getSwapTransaction(quote, walletPublicKey);

    logger.info(`Prepared sell transaction for ${walletPublicKey.slice(0, 8)}...`);

    res.json({
      success: true,
      data: {
        transaction: swapData.swapTransaction,
        quote,
        expectedOutput: quote.outAmount,
        priceImpact: quote.priceImpactPct
      },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error preparing sell transaction:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to prepare sell transaction'
    });
  }
});

/**
 * Execute sell and update position
 */
app.post('/api/exit/execute', async (req: Request, res: Response) => {
  try {
    const { walletPublicKey, tokenMint, signedTransaction, percentage } = req.body;

    // Send transaction
    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3
    });

    logger.info(`Sell transaction sent: ${signature}`);

    // Update or close position
    if (percentage >= 100) {
      positionManager.closePosition(walletPublicKey, tokenMint);
    } else {
      positionManager.incrementExitStage(walletPublicKey, tokenMint);
    }

    res.json({
      success: true,
      data: {
        signature
      },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error executing sell:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute sell'
    });
  }
});

/**
 * Get statistics
 */
app.get('/api/stats', (req: Request, res: Response) => {
  try {
    const stats = positionManager.getStatistics();

    res.json({
      success: true,
      data: stats,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get statistics'
    });
  }
});

/**
 * Clear price cache - force fresh price fetches
 */
app.post('/api/cache/clear', (req: Request, res: Response) => {
  try {
    priceService.clearCache();
    logger.info('Price cache cleared');

    res.json({
      success: true,
      data: { message: 'Price cache cleared successfully' },
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

/**
 * Test price fetch for a specific token
 */
app.get('/api/test/price/:mint', async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;

    logger.info(`Testing price fetch for ${mint}`);

    // Test DexScreener directly
    const axios = require('axios');
    let dexError = null;
    let dexPrice = null;
    try {
      const dexResponse = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
        { timeout: 5000 }
      );
      if (dexResponse.data?.pairs && dexResponse.data.pairs.length > 0) {
        const bestPair = dexResponse.data.pairs
          .sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
        dexPrice = parseFloat(bestPair.priceUsd);
      }
    } catch (err: any) {
      dexError = err.message;
    }

    const price = await priceService.getCurrentPrice(mint);

    res.json({
      success: true,
      data: {
        mint,
        price,
        directDexScreenerTest: {
          price: dexPrice,
          error: dexError
        },
        cacheStats: priceService.getCacheStats(),
        codeVersion: '2.0-with-retries'
      },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error testing price:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test price'
    });
  }
});

/**
 * Create a new limit order
 */
app.post('/api/limit-orders', async (req: Request, res: Response) => {
  try {
    const { walletPublicKey, tokenMint, tokenSymbol, targetPrice, solAmount, exitStrategy, slippageBps, expiresIn } = req.body;

    // Validation
    if (!isValidPublicKey(walletPublicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet public key'
      });
    }

    if (!isValidPublicKey(tokenMint)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token mint'
      });
    }

    if (!targetPrice || targetPrice <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid target price'
      });
    }

    if (!solAmount || solAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid SOL amount'
      });
    }

    if (exitStrategy && !isValidStrategy(exitStrategy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid exit strategy'
      });
    }

    const order = limitOrderManager.createOrder({
      walletPublicKey,
      tokenMint,
      tokenSymbol,
      targetPrice,
      solAmount,
      exitStrategy: exitStrategy || 'manual',
      slippageBps,
      expiresIn
    });

    logger.info(`Created limit order ${order.id} for ${walletPublicKey.slice(0, 8)}...`);

    res.json({
      success: true,
      data: order,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error creating limit order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create limit order'
    });
  }
});

/**
 * Get limit orders for a wallet
 */
app.get('/api/limit-orders/:walletPublicKey', (req: Request, res: Response) => {
  try {
    const { walletPublicKey } = req.params;

    if (!isValidPublicKey(walletPublicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet public key'
      });
    }

    const orders = limitOrderManager.getOrdersByWallet(walletPublicKey);

    res.json({
      success: true,
      data: orders,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting limit orders:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get limit orders'
    });
  }
});

/**
 * Cancel a limit order
 */
app.delete('/api/limit-orders/:orderId', (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const success = limitOrderManager.cancelOrder(orderId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or cannot be cancelled'
      });
    }

    logger.info(`Cancelled limit order ${orderId}`);

    res.json({
      success: true,
      data: { message: 'Order cancelled successfully' },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error cancelling limit order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel limit order'
    });
  }
});

/**
 * Get limit order statistics
 */
app.get('/api/limit-orders-stats', (req: Request, res: Response) => {
  try {
    const stats = limitOrderManager.getStatistics();

    res.json({
      success: true,
      data: stats,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting limit order stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get statistics'
    });
  }
});

/**
 * Create a new DCA order
 */
app.post('/api/dca-orders', async (req: Request, res: Response) => {
  try {
    const {
      walletPublicKey,
      tokenMint,
      tokenSymbol,
      totalSolAmount,
      numberOfBuys,
      intervalMinutes,
      strategyType,
      exitStrategy,
      slippageBps,
      referencePrice
    } = req.body;

    // Validation
    if (!isValidPublicKey(walletPublicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet public key'
      });
    }

    if (!isValidPublicKey(tokenMint)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token mint'
      });
    }

    if (!totalSolAmount || totalSolAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid total SOL amount'
      });
    }

    if (!numberOfBuys || numberOfBuys < 2) {
      return res.status(400).json({
        success: false,
        error: 'Number of buys must be at least 2'
      });
    }

    if (!intervalMinutes || intervalMinutes <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid interval minutes'
      });
    }

    if (!strategyType || !['time-based', 'price-based', 'fixed-split'].includes(strategyType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid DCA strategy. Must be time-based, price-based, or fixed-split'
      });
    }

    if (exitStrategy && !isValidStrategy(exitStrategy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid exit strategy'
      });
    }

    const order = dcaOrderManager.createOrder({
      walletPublicKey,
      tokenMint,
      tokenSymbol,
      totalSolAmount,
      numberOfBuys,
      intervalMinutes,
      strategyType,
      exitStrategy: exitStrategy || 'manual',
      slippageBps: slippageBps || 200,
      referencePrice
    });

    logger.info(`Created DCA order ${order.id} for ${walletPublicKey.slice(0, 8)}...`);

    res.json({
      success: true,
      data: order,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error creating DCA order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create DCA order'
    });
  }
});

/**
 * Get DCA orders for a wallet
 */
app.get('/api/dca-orders/:walletPublicKey', (req: Request, res: Response) => {
  try {
    const { walletPublicKey } = req.params;

    if (!isValidPublicKey(walletPublicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet public key'
      });
    }

    const orders = dcaOrderManager.getOrdersByWallet(walletPublicKey);

    res.json({
      success: true,
      data: orders,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting DCA orders:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get DCA orders'
    });
  }
});

/**
 * Get specific DCA order by ID
 */
app.get('/api/dca-orders/order/:orderId', (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const order = dcaOrderManager.getOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'DCA order not found'
      });
    }

    res.json({
      success: true,
      data: order,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting DCA order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get DCA order'
    });
  }
});

/**
 * Pause a DCA order
 */
app.put('/api/dca-orders/:orderId/pause', (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const success = dcaOrderManager.pauseOrder(orderId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or cannot be paused'
      });
    }

    logger.info(`Paused DCA order ${orderId}`);

    res.json({
      success: true,
      data: { message: 'Order paused successfully' },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error pausing DCA order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to pause DCA order'
    });
  }
});

/**
 * Resume a DCA order
 */
app.put('/api/dca-orders/:orderId/resume', (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const success = dcaOrderManager.resumeOrder(orderId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or cannot be resumed'
      });
    }

    logger.info(`Resumed DCA order ${orderId}`);

    res.json({
      success: true,
      data: { message: 'Order resumed successfully' },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error resuming DCA order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resume DCA order'
    });
  }
});

/**
 * Cancel a DCA order
 */
app.delete('/api/dca-orders/:orderId', (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const success = dcaOrderManager.cancelOrder(orderId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or cannot be cancelled'
      });
    }

    logger.info(`Cancelled DCA order ${orderId}`);

    res.json({
      success: true,
      data: { message: 'Order cancelled successfully' },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error cancelling DCA order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel DCA order'
    });
  }
});

/**
 * Get all pending DCA buys
 */
app.get('/api/dca-pending-buys', (req: Request, res: Response) => {
  try {
    const pendingBuys = dcaExecutor.getPendingBuys();

    res.json({
      success: true,
      data: pendingBuys,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting pending DCA buys:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pending buys'
    });
  }
});

/**
 * Get pending DCA buys for a specific wallet
 */
app.get('/api/dca-pending-buys/:walletPublicKey', (req: Request, res: Response) => {
  try {
    const { walletPublicKey } = req.params;

    if (!isValidPublicKey(walletPublicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet public key'
      });
    }

    const allPendingBuys = dcaExecutor.getPendingBuys();
    const walletBuys = allPendingBuys.filter(buy => buy.walletPublicKey === walletPublicKey);

    res.json({
      success: true,
      data: walletBuys,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting pending DCA buys for wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pending buys'
    });
  }
});

/**
 * Execute a pending DCA buy
 */
app.post('/api/dca-pending-buys/execute', async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      buyNumber,
      signature,
      actualTokenAmount,
      actualSolSpent,
      actualPrice
    } = req.body;

    // Validation
    if (!orderId || !buyNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing orderId or buyNumber'
      });
    }

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing transaction signature'
      });
    }

    if (!actualTokenAmount || actualTokenAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token amount'
      });
    }

    if (!actualSolSpent || actualSolSpent <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid SOL spent amount'
      });
    }

    if (!actualPrice || actualPrice <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid execution price'
      });
    }

    const success = await dcaExecutor.executeBuy(
      orderId,
      buyNumber,
      signature,
      actualTokenAmount,
      actualSolSpent,
      actualPrice
    );

    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to execute DCA buy'
      });
    }

    logger.info(`Executed DCA buy ${buyNumber} for order ${orderId}`);

    res.json({
      success: true,
      data: { message: 'DCA buy executed successfully' },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error executing DCA buy:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute DCA buy'
    });
  }
});

/**
 * Get DCA order statistics
 */
app.get('/api/dca-stats', (req: Request, res: Response) => {
  try {
    const orderStats = dcaOrderManager.getStatistics();
    const executorStatus = dcaExecutor.getStatus();

    res.json({
      success: true,
      data: {
        orders: orderStats,
        executor: executorStatus
      },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting DCA stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get DCA statistics'
    });
  }
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: any) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

export { app };
