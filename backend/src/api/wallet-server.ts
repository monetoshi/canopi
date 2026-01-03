/**
 * Solana Trading Bot - Main API Server
 * Express server with wallet and trading endpoints
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { positionManager } from '../core/position-manager';
import { limitOrderManager } from '../core/limit-order-manager';
import { dcaOrderManager } from '../core/dca-order-manager';
import { pendingSellsManager } from '../core/pending-sells-manager';
import { dcaExecutor } from '../services/dca-executor';
import { jupiterService } from '../services/jupiter.service';
import { priceService } from '../services/price.service';
import { taxService } from '../services/tax.service';
import { getConnection, getSOLBalance, isValidPublicKey, getWalletKeypair } from '../utils/blockchain.util';
import { loadEncryptedWallet, decrypt } from '../utils/security.util';
import { getWalletPath } from '../utils/paths.util';
import { configUtil } from '../utils/config.util';
import { logger } from '../utils/logger.util';
import { ApiResponse, ExitStrategy, Position } from '../types';
import { getAllStrategies, isValidStrategy, getStrategy } from '../core/strategies';
import { getMint } from '@solana/spl-token';

import { watchlistManager } from '../core/watchlist-manager';
import { privacyService } from '../services/privacy.service';
import { ephemeralWalletManager } from '../core/ephemeral-wallet-manager';
import { telegramNotifier } from '../services/telegram-notifier';
import { db } from '../db/index';
import { telegramUsers } from '../db/schema';
import { eq } from 'drizzle-orm';

const app = express();
const connection = getConnection();

/**
 * Authentication Middleware
 * Simple API key check for admin operations and sensitive data
 */
export const authenticateAdmin = (req: Request, res: Response, next: any) => {
  const adminKey = process.env.ADMIN_API_KEY;
  
  // If no admin key is configured in .env, we allow all requests (Dev mode)
  // In production, an admin key MUST be set.
  if (!adminKey) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('CRITICAL: ADMIN_API_KEY not set in production. Blocking sensitive route.');
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }
    return next();
  }

  const providedKey = req.headers['x-admin-key'];
  if (!providedKey || providedKey !== adminKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  next();
};

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
 * Setup New Wallet
 */
app.post('/api/wallet/setup', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const walletPath = getWalletPath();
    if (fs.existsSync(walletPath)) {
      return res.status(400).json({ success: false, error: 'Wallet already exists' });
    }

    // Generate new keypair
    const Keypair = require('@solana/web3.js').Keypair;
    const bs58 = require('bs58');
    const wallet = Keypair.generate();
    const privateKey = bs58.encode(wallet.secretKey);

    // Encrypt
    const { encrypt } = require('../utils/security.util');
    const encryptedData = encrypt(privateKey, password);

    // Save to disk
    fs.writeFileSync(walletPath, JSON.stringify(encryptedData, null, 2));

    // Set env var to unlock immediately
    process.env.WALLET_PASSWORD = password;
    
    logger.info(`✅ New wallet created: ${wallet.publicKey.toString()}`);

    res.json({ 
      success: true, 
      message: 'Wallet created successfully',
      publicKey: wallet.publicKey.toString() 
    });

  } catch (error: any) {
    logger.error('Error creating wallet:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Reset/Delete Wallet
 * DANGER: This deletes the private key file!
 */
app.delete('/api/wallet/reset', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const walletPath = getWalletPath();
    if (fs.existsSync(walletPath)) {
      fs.unlinkSync(walletPath);
      delete process.env.WALLET_PASSWORD;
      logger.info('⚠️ Wallet deleted/reset by user');
    }
    res.json({ success: true, message: 'Wallet reset' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Unlock Wallet
 */
app.post('/api/wallet/unlock', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password required' });
    }

    const walletPath = getWalletPath();
    if (!fs.existsSync(walletPath)) {
      return res.status(404).json({ success: false, error: 'No encrypted wallet found' });
    }

    const encryptedData = loadEncryptedWallet(walletPath);
    if (!encryptedData) {
      return res.status(500).json({ success: false, error: 'Failed to load wallet data' });
    }

    try {
      // Attempt to decrypt to verify password
      const decryptedKey = decrypt(encryptedData, password);
      if (!decryptedKey) throw new Error('Decryption failed');
      
      // If successful, set env var
      process.env.WALLET_PASSWORD = password;
      logger.info('✅ Wallet unlocked successfully via API');

      res.json({ success: true, message: 'Wallet unlocked' });
    } catch (error) {
      logger.warn('❌ Failed unlock attempt: Invalid password');
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Export Private Key
 */
app.post('/api/wallet/export', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password required' });
    }

    const walletPath = getWalletPath();
    if (!fs.existsSync(walletPath)) {
      return res.status(404).json({ success: false, error: 'No wallet found' });
    }

    const encryptedData = loadEncryptedWallet(walletPath);
    if (!encryptedData) {
      return res.status(500).json({ success: false, error: 'Failed to load wallet data' });
    }

    try {
      const decryptedKey = decrypt(encryptedData, password);
      if (!decryptedKey) throw new Error('Decryption failed');
      
      // If key is array format, convert to base58
      let privateKeyBase58 = decryptedKey;
      if (decryptedKey.startsWith('[') && decryptedKey.endsWith(']')) {
         const { Keypair } = require('@solana/web3.js');
         const bs58 = require('bs58');
         const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(decryptedKey)));
         privateKeyBase58 = bs58.encode(kp.secretKey);
      }

      res.json({ success: true, privateKey: privateKeyBase58 });
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Withdraw Funds
 */
app.post('/api/wallet/withdraw', async (req: Request, res: Response) => {
  try {
    const { password, destination, amount } = req.body;
    
    if (!password || !destination || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    if (!isValidPublicKey(destination)) {
      return res.status(400).json({ success: false, error: 'Invalid destination address' });
    }

    const walletPath = getWalletPath();
    const encryptedData = loadEncryptedWallet(walletPath);
    
    if (!encryptedData) {
      return res.status(404).json({ success: false, error: 'Wallet not found' });
    }

    // 1. Decrypt Wallet
    let signer;
    try {
      const decryptedKey = decrypt(encryptedData, password);
      const { Keypair } = require('@solana/web3.js');
      const bs58 = require('bs58');
      
      if (decryptedKey.startsWith('[') && decryptedKey.endsWith(']')) {
         signer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(decryptedKey)));
      } else {
         signer = Keypair.fromSecretKey(bs58.decode(decryptedKey));
      }
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }

    // 2. Prepare Transaction
    const { SystemProgram, Transaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
    const transferAmount = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
    
    // Check balance
    const currentBalance = await connection.getBalance(signer.publicKey);
    if (currentBalance < transferAmount + 5000) { // 5000 lamports for fee
       return res.status(400).json({ success: false, error: 'Insufficient balance' });
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: new PublicKey(destination),
        lamports: transferAmount,
      })
    );

    // 3. Send
    const signature = await connection.sendTransaction(transaction, [signer]);
    
    logger.info(`Withdrawal successful: ${signature}`);
    
    res.json({ success: true, signature });

  } catch (error: any) {
    logger.error('Withdrawal failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Execute trade using Bot Wallet (Server-Side Signing)
 */
app.post('/api/bot/trade', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { tokenMint, solAmount, strategy, slippageBps, isPrivate } = req.body;
    
    // 1. Load Server Wallet
    const wallet = getWalletKeypair();
    
    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Server wallet not configured'
      });
    }
    
    const walletPublicKey = wallet.publicKey.toString();
    const existingPosition = positionManager.getPosition(walletPublicKey, tokenMint);

    // EPHEMERAL WALLET FLOW (Privacy Phase 2)
    let executionKeypair = wallet;
    if (isPrivate) {
      logger.info(`[BotTrade] Initiating PRIVATE trade for ${walletPublicKey.slice(0, 8)}...`);
      
      if (existingPosition && !existingPosition.isPrivate) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cannot add privately to an existing PUBLIC position. Please exit the current position first.' 
        });
      }

      // Check Shielded Balance
      const shieldStatus = await privacyService.getShieldedBalance(walletPublicKey);
      if (shieldStatus.available < solAmount + 0.01) {
         return res.status(400).json({ 
           success: false, 
           error: `Insufficient shielded balance (${shieldStatus.available.toFixed(4)} SOL). Please shield at least ${(solAmount + 0.01).toFixed(4)} SOL first.` 
         });
      }

      // Get or Create Ephemeral Wallet
      const password = process.env.WALLET_PASSWORD || '';
      
      if (existingPosition && existingPosition.isPrivate && existingPosition.executionWallet) {
        logger.info(`[BotTrade] Reusing existing ephemeral wallet for ${tokenMint}`);
        const existingWallet = ephemeralWalletManager.getWallet(existingPosition.executionWallet, password);
        if (existingWallet) {
          executionKeypair = existingWallet;
        } else {
          executionKeypair = ephemeralWalletManager.createWallet(password);
        }
      } else {
        executionKeypair = ephemeralWalletManager.createWallet(password);
      }
      
      // Fund Ephemeral Wallet (Shield -> Public)
      await privacyService.fundEphemeralWallet(executionKeypair.publicKey.toString(), solAmount + 0.005);
      
      // Wait for funding to land
      logger.info(`[BotTrade] Waiting for ephemeral wallet funding (8s)...`);
      await new Promise(resolve => setTimeout(resolve, 8000));
    } else {
      if (existingPosition && existingPosition.isPrivate) {
        return res.status(400).json({ 
          success: false, 
          error: 'This is a PRIVATE position. You must trade it privately.' 
        });
      }
      logger.info(`[BotTrade] Executing instant buy for ${walletPublicKey.slice(0, 8)}...`);
    }

    const executionPublicKey = executionKeypair.publicKey.toString();

    // 2. Prepare Transaction (Jupiter)
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const lamports = Math.floor(solAmount * 1e9);
    
    const quote = await jupiterService.getQuote(
      SOL_MINT,
      tokenMint,
      lamports,
      slippageBps || 200
    );
    
    const swapData = await jupiterService.getSwapTransaction(quote, executionPublicKey);
    
    if (!swapData || !swapData.swapTransaction) {
       throw new Error('Failed to prepare swap transaction');
    }

    // 3. Sign & Send
    const txBuffer = Buffer.from(swapData.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);
    
    transaction.sign([executionKeypair]);
    
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3
    });
    
    logger.info(`[BotTrade] Transaction sent: ${signature}`);
    
    // 4. Update Position & Tax
    const entryPrice = await priceService.getCurrentPrice(tokenMint);
    const solPrice = await priceService.getCurrentPrice(SOL_MINT) || 100;
    const tokenAmount = Number(quote.outAmount) / 1e9; // Todo: precise decimals
    
    // Record Tax
    try {
      const recorded = await taxService.recordBuyTrade({
        walletPublicKey,
        tokenMint,
        solAmount,
        tokenAmount,
        priceUsd: entryPrice || 0,
        priceSol: solPrice,
        feeSol: 0.000005,
        signature,
        entryStrategy: (strategy as ExitStrategy) || 'manual'
      });
      
      // Notify Telegram
      if (recorded && recorded.trade) {
        await telegramNotifier.notifyTrade(recorded.trade);
      }
    } catch (e: any) { logger.error('[BotTrade] Tax/Telegram error:', e.message); }
    
    // Update Position Manager
    const strategyName = (strategy as ExitStrategy) || 'manual';
    const strategyConfig = getStrategy(strategyName);
    
    if (existingPosition && existingPosition.status === 'active') {
      await positionManager.addToPosition(walletPublicKey, tokenMint, tokenAmount, solAmount, entryPrice || 0);
    } else {
      await positionManager.addPosition({
        mint: tokenMint,
        walletPublicKey,
        entryTime: Date.now(),
        entryPrice: entryPrice || 0,
        tokenAmount: tokenAmount,
        solSpent: solAmount,
        exitStagesCompleted: 0,
        strategy: strategyName,
        isPercentageBased: strategyConfig.isPercentageBased,
        highestProfit: 0,
        status: 'active',
        currentPrice: entryPrice || 0,
        currentProfit: 0,
        isPrivate: !!isPrivate,
        executionWallet: executionPublicKey
      });
    }
    
    res.json({
      success: true,
      data: {
        signature,
        position: positionManager.getPosition(walletPublicKey, tokenMint),
        isPrivate: !!isPrivate,
        executionWallet: executionPublicKey
      },
      timestamp: Date.now()
    } as ApiResponse);

  } catch (error: any) {
    logger.error('[BotTrade] Error executing trade:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute bot trade'
    });
  }
});

/**
 * Execute sell using Bot Wallet or Ephemeral Wallet (Server-Side Signing)
 */
app.post('/api/bot/exit', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { tokenMint, walletPublicKey, percentage, slippageBps } = req.body;

    // 1. Get position
    const position = positionManager.getPosition(walletPublicKey, tokenMint);
    if (!position) {
      return res.status(404).json({ success: false, error: 'Position not found' });
    }

    // 2. Identify Signer
    const botWallet = getWalletKeypair();
    let signer = botWallet;

    if (position.isPrivate && position.executionWallet) {
      const password = process.env.WALLET_PASSWORD || '';
      signer = ephemeralWalletManager.getWallet(position.executionWallet, password);
    }

    if (!signer) {
      return res.status(400).json({ success: false, error: 'Signer wallet not found or configured' });
    }

    const executionPublicKey = signer.publicKey.toString();
    logger.info(`[BotExit] Executing ${percentage}% exit for ${tokenMint} via ${executionPublicKey.slice(0, 8)}...`);

    // DEBUG: Check balances
    try {
      const solBalance = await getSOLBalance(connection, executionPublicKey);
      logger.info(`[BotExit] Signer SOL Balance: ${solBalance} SOL`);

      // Check Token Balance
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(signer.publicKey, {
        mint: new PublicKey(tokenMint)
      });
      
      const tokenBalance = tokenAccounts.value[0]?.account.data.parsed.info.tokenAmount.uiAmount || 0;
      logger.info(`[BotExit] Signer Token Balance: ${tokenBalance} (Mint: ${tokenMint})`);

      if (tokenBalance === 0) {
         return res.status(400).json({ success: false, error: 'Signer has 0 balance of this token. Trade cannot proceed.' });
      }
    } catch (e: any) {
      logger.error(`[BotExit] Failed to check balances: ${e.message}`);
    }

    // 3. Prepare Transaction
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    
    // Get token decimals
    let decimals = 9; // Default for SOL
    if (tokenMint !== SOL_MINT) {
      try {
        const mintInfo = await getMint(connection, new PublicKey(tokenMint));
        decimals = mintInfo.decimals;
      } catch (e) {
        logger.warn(`[BotExit] Failed to get decimals for ${tokenMint}, assuming 6`);
        decimals = 6;
      }
    }

    const amountToSell = position.tokenAmount * (percentage / 100);
    const amountAtomic = Math.floor(amountToSell * Math.pow(10, decimals));
    
    logger.info(`[BotExit] Selling ${amountToSell} tokens (${amountAtomic} atomic units, decimals: ${decimals})`);

    const quote = await jupiterService.getQuote(
      tokenMint,
      SOL_MINT,
      amountAtomic,
      slippageBps || 200
    );

    const swapData = await jupiterService.getSwapTransaction(quote, executionPublicKey);
    if (!swapData || !swapData.swapTransaction) {
      throw new Error('Failed to prepare swap transaction');
    }

    // 4. Sign & Send
    const txBuffer = Buffer.from(swapData.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);
    transaction.sign([signer]);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3
    });

    logger.info(`[BotExit] Transaction sent: ${signature}`);

    // Update or close position
    if (percentage >= 100) {
      await positionManager.closePosition(walletPublicKey, tokenMint);
    } else {
      await positionManager.incrementExitStage(walletPublicKey, tokenMint);
    }

    const expectedOutput = Number(quote.outAmount) / 1e9;

    // 6. Private Reclaim (ShadowWire)
    if (position.isPrivate) {
      try {
        // Wait for sell transaction to confirm and balance to update
        logger.info(`[BotExit] Waiting for sell to settle before reclaiming...`);
        
        setTimeout(async () => {
          try {
            // Get actual balance
            const currentBalance = await getSOLBalance(connection, executionPublicKey);
            const reclaimAmount = currentBalance - 0.002; // Keep 0.002 for gas/rent
            
            logger.info(`[BotExit] 🛡️ Reclaiming ${reclaimAmount.toFixed(4)} SOL (Balance: ${currentBalance.toFixed(4)})`);
            
            if (reclaimAmount > 0.001) { // Min shield amount
              await privacyService.shieldFunds(reclaimAmount, signer!);
              logger.info(`[BotExit] ✅ Reclaimed to shield`);
              
              // NEW: Consolidate to Main Bot Wallet
              // The shielded funds are currently owned by the Ephemeral Wallet.
              // We must transfer them internally to the Main Bot Wallet so the user can see/use them.
              try {
                 logger.info(`[BotExit] Consolidating funds to main wallet...`);
                 const mainWallet = getWalletKeypair();
                 if (mainWallet) {
                    // Wait a moment for shield to be indexed
                    await new Promise(r => setTimeout(r, 2000));
                    
                    const amountLamports = Math.floor(reclaimAmount * 1e9);
                    await privacyService.transferShieldedBalance(
                      signer!, 
                      mainWallet.publicKey.toString(), 
                      amountLamports
                    );
                    logger.info(`[BotExit] ✅ Funds consolidated to main wallet`);
                 }
              } catch (consolidationError: any) {
                 logger.error(`[BotExit] Consolidation failed: ${consolidationError.message}. Funds are safe in ephemeral shield.`);
              }

              // Optional: Mark wallet as drained if nearly empty
              if (reclaimAmount > currentBalance * 0.9) {
                 await ephemeralWalletManager.markDrained(executionPublicKey);
              }
            } else {
              logger.warn(`[BotExit] Balance too low to shield (${reclaimAmount.toFixed(4)} SOL)`);
            }
          } catch (e: any) { 
            logger.error(`[BotExit] Reclaim failed: ${e.message}`); 
          }
        }, 10000); // 10s delay to be safe
      } catch (e: any) { logger.error(`[BotExit] Reclaim setup failed: ${e.message}`); }
    }

    // 7. Record Tax
    try {
      const solPrice = await priceService.getCurrentPrice(SOL_MINT) || 100;
      const recorded = await taxService.recordSellTrade({
        walletPublicKey,
        tokenMint,
        solAmount: expectedOutput,
        tokenAmount: amountToSell,
        priceUsd: position.currentPrice || 0,
        priceSol: solPrice,
        feeSol: 0.000005,
        signature,
        exitStrategy: position.strategy
      });

      // Notify Telegram
      if (recorded && recorded.trade) {
        await telegramNotifier.notifyTrade(recorded.trade);
      }
    } catch (e: any) { logger.error('[BotExit] Tax/Telegram error:', e.message); }

    res.json({
      success: true,
      data: { signature },
      timestamp: Date.now()
    } as ApiResponse);

  } catch (error: any) {
    logger.error('[BotExit] Error executing exit:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute bot exit'
    });
  }
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
app.get('/api/wallet/balance/:publicKey', authenticateAdmin, async (req: Request, res: Response) => {
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
app.get('/api/wallet/positions/:publicKey', authenticateAdmin, async (req: Request, res: Response) => {
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
    console.log('[Snipe-Execute-API] ========== REGULAR BUY ENDPOINT CALLED ==========');
    console.log('[Snipe-Execute-API] Token:', req.body.tokenMint?.slice(0, 8), 'SOL:', req.body.solAmount);

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

    // Get entry price and SOL price
    const entryPrice = await priceService.getCurrentPrice(tokenMint);
    const solPrice = await priceService.getCurrentPrice('So11111111111111111111111111111111111111112') || 100;

    // Use expected output from quote, or fallback to calculating from price
    let tokenAmount = 0;
    if (expectedOutput) {
      // expectedOutput is in raw token units, need to convert to decimal
      // Most Solana tokens have 9 decimals
      tokenAmount = Number(expectedOutput) / 1e9;
      logger.info(`Using expected output from quote: ${tokenAmount} tokens`);
    } else if (entryPrice && entryPrice > 0 && solPrice > 0) {
      // Fallback: estimate tokens from SOL spent and prices
      // USD spent = SOL * SOL price
      // Tokens = USD spent / token price
      const usdSpent = solAmount * solPrice;
      tokenAmount = usdSpent / entryPrice;
      logger.warn(`No expected output provided, estimated ${tokenAmount} tokens from price (${usdSpent} USD / ${entryPrice} USD per token)`);
    }

    // Check if position already exists
    const existingPosition = positionManager.getPosition(walletPublicKey, tokenMint);
    let positionId: string | undefined = undefined;

    // Record buy trade in database for tax tracking
    try {
      const estimatedFee = 0.000005; // Estimated transaction fee in SOL
      const recorded = await taxService.recordBuyTrade({
        walletPublicKey,
        tokenMint,
        // Omit positionId - positions are in-memory only, not in database yet
        solAmount,
        tokenAmount,
        priceUsd: entryPrice || 0,
        priceSol: solPrice,
        feeSol: estimatedFee,
        signature,
        entryStrategy: strategy
      });

      // Notify Telegram
      if (recorded && recorded.trade) {
        await telegramNotifier.notifyTrade(recorded.trade);
      }
    } catch (taxError: any) {
      // Log error but don't fail the transaction
      logger.error('[TaxService] Failed to record buy trade:', taxError.message);
    }

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

    // Get position data before selling
    const position = positionManager.getPosition(walletPublicKey, tokenMint);
    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Position not found'
      });
    }

    // Send transaction
    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3
    });

    logger.info(`Sell transaction sent: ${signature}`);

    // Calculate amounts sold
    const tokenAmount = position.tokenAmount * (percentage / 100);
    const exitPrice: number = position.currentPrice ?? 0;
    const solReceived = exitPrice * tokenAmount; // Approximate SOL received

    // Get SOL price for USD calculations
    const solPrice: number = await priceService.getCurrentPrice('So11111111111111111111111111111111111111112') ?? 100;

    // Record sell trade in database for tax tracking
    try {
      const estimatedFee = 0.000005; // Estimated transaction fee in SOL
      const recorded = await taxService.recordSellTrade({
        walletPublicKey,
        tokenMint,
        // Omit positionId - positions are in-memory only, not in database yet
        solAmount: solReceived,
        tokenAmount,
        priceUsd: exitPrice,
        priceSol: solPrice,
        feeSol: estimatedFee,
        signature,
        exitStrategy: position.strategy
      });

      // Notify Telegram
      if (recorded && recorded.trade) {
        await telegramNotifier.notifyTrade(recorded.trade);
      }
    } catch (taxError: any) {
      // Log error but don't fail the transaction
      logger.error('[TaxService] Failed to record sell trade:', taxError.message);
    }

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

    if (!isValidPublicKey(mint)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token mint'
      });
    }

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
app.post('/api/limit-orders', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { walletPublicKey, tokenMint, type, tokenSymbol, targetPrice, solAmount, exitStrategy, slippageBps, expiresIn, isPrivate } = req.body;

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

    if (type && type !== 'BUY' && type !== 'SELL') {
      return res.status(400).json({
        success: false,
        error: 'Invalid order type (must be BUY or SELL)'
      });
    }

    if (exitStrategy && !isValidStrategy(exitStrategy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid exit strategy'
      });
    }

    const order = await limitOrderManager.createOrder({
      walletPublicKey,
      tokenMint,
      type: type || 'BUY',
      tokenSymbol,
      targetPrice,
      solAmount,
      exitStrategy: exitStrategy || 'manual',
      slippageBps,
      expiresIn,
      isPrivate
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
app.get('/api/limit-orders/:walletPublicKey', authenticateAdmin, (req: Request, res: Response) => {
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
app.delete('/api/limit-orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const success = await limitOrderManager.cancelOrder(orderId);

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
app.post('/api/dca-orders', authenticateAdmin, async (req: Request, res: Response) => {
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

    const order = await dcaOrderManager.createOrder({
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
app.get('/api/dca-orders/:walletPublicKey', authenticateAdmin, (req: Request, res: Response) => {
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
app.put('/api/dca-orders/:orderId/pause', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const success = await dcaOrderManager.pauseOrder(orderId);

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
app.put('/api/dca-orders/:orderId/resume', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const success = await dcaOrderManager.resumeOrder(orderId);

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
app.delete('/api/dca-orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const success = await dcaOrderManager.cancelOrder(orderId);

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
    console.log('[DCA-Execute-API] ========== ENDPOINT CALLED ==========');
    console.log('[DCA-Execute-API] Request body:', req.body);

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

    // Get DCA order details for tax recording
    console.log('[DCA-Execute-API] Looking up DCA order:', orderId);
    const dcaOrder = dcaOrderManager.getOrder(orderId);
    console.log('[DCA-Execute-API] DCA order found:', dcaOrder ? 'YES' : 'NO');

    if (dcaOrder) {
      console.log('[DCA-Execute] ========== STARTING TAX RECORDING ==========');
      console.log('[DCA-Execute] Order:', {
        orderId,
        buyNumber,
        wallet: dcaOrder.walletPublicKey.slice(0, 8),
        token: dcaOrder.tokenMint.slice(0, 8),
        actualSolSpent,
        actualTokenAmount,
        actualPrice
      });

      // Record buy trade in database for tax tracking
      try {
        const estimatedFee = 0.000005; // Estimated transaction fee in SOL
        const solPrice = await priceService.getCurrentPrice('So11111111111111111111111111111111111111112') || 100;

        await taxService.recordBuyTrade({
          walletPublicKey: dcaOrder.walletPublicKey,
          tokenMint: dcaOrder.tokenMint,
          // Omit positionId - positions are in-memory only, not in database yet
          solAmount: actualSolSpent,
          tokenAmount: actualTokenAmount,
          priceUsd: actualPrice,
          priceSol: solPrice,
          feeSol: estimatedFee,
          signature,
          entryStrategy: `DCA-${dcaOrder.strategyType}`
        });
        console.log('[DCA-Execute] ✓ Tax recording completed successfully');
      } catch (taxError: any) {
        // Log error but don't fail the transaction
        console.error('[DCA-Execute] ❌ Tax recording FAILED');
        console.error('[DCA-Execute] Error details:', {
          message: taxError.message,
          stack: taxError.stack?.substring(0, 500),
          name: taxError.name
        });
        logger.error('[TaxService] Failed to record DCA buy trade:', taxError.message);
      }
    } else {
      console.log('[DCA-Execute-API] ⚠️  Skipping tax recording - DCA order not found for orderId:', orderId);
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

/**
 * Get pending sells for a specific wallet
 */
app.get('/api/pending-sells/:walletPublicKey', (req: Request, res: Response) => {
  try {
    const { walletPublicKey } = req.params;

    if (!isValidPublicKey(walletPublicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet public key'
      });
    }

    const pendingSells = pendingSellsManager.getPendingSellsByWallet(walletPublicKey);

    res.json({
      success: true,
      data: pendingSells,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting pending sells:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pending sells'
    });
  }
});

/**
 * Execute a pending sell
 */
app.post('/api/pending-sells/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { signedTransaction } = req.body;

    const pendingSell = pendingSellsManager.getPendingSell(id);
    if (!pendingSell) {
      return res.status(404).json({
        success: false,
        error: 'Pending sell not found'
      });
    }

    if (pendingSell.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Pending sell is not in pending status'
      });
    }

    if (!signedTransaction) {
      return res.status(400).json({
        success: false,
        error: 'Missing signed transaction'
      });
    }

    // Mark as executing
    await pendingSellsManager.markExecuting(id);

    // Send transaction
    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3
    });

    logger.info(`Pending sell executed: ${signature}`);

    // Mark as executed
    await pendingSellsManager.markExecuted(id, signature);

    // Update or close position
    if (pendingSell.sellPercentage >= 100) {
      await positionManager.closePosition(pendingSell.walletPublicKey, pendingSell.tokenMint);
    } else {
      await positionManager.incrementExitStage(pendingSell.walletPublicKey, pendingSell.tokenMint);
    }

    // Record sell trade for tax tracking
    try {
      const solPrice = await priceService.getCurrentPrice('So11111111111111111111111111111111111111112') || 100;
      const estimatedFee = 0.000005;

      await taxService.recordSellTrade({
        walletPublicKey: pendingSell.walletPublicKey,
        tokenMint: pendingSell.tokenMint,
        solAmount: pendingSell.estimatedSolReceived,
        tokenAmount: pendingSell.tokenAmount,
        priceUsd: pendingSell.currentPrice,
        priceSol: solPrice,
        feeSol: estimatedFee,
        signature,
        exitStrategy: pendingSell.strategy
      });
    } catch (taxError: any) {
      logger.error('[TaxService] Failed to record sell trade:', taxError.message);
    }

    res.json({
      success: true,
      data: { signature },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error executing pending sell:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute pending sell'
    });
  }
});

/**
 * Cancel a pending sell
 */
app.delete('/api/pending-sells/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = await pendingSellsManager.cancel(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Pending sell not found or cannot be cancelled'
      });
    }

    logger.info(`Cancelled pending sell ${id}`);

    res.json({
      success: true,
      data: { message: 'Pending sell cancelled successfully' },
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error cancelling pending sell:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel pending sell'
    });
  }
});

/**
 * Get watchlist
 */
app.get('/api/watchlist/:walletPublicKey', (req: Request, res: Response) => {
  try {
    const { walletPublicKey } = req.params;
    const watchlist = watchlistManager.getWatchlist(walletPublicKey);
    
    res.json({
      success: true,
      data: watchlist,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting watchlist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get watchlist'
    });
  }
});

/**
 * Add to watchlist
 */
app.post('/api/watchlist', (req: Request, res: Response) => {
  try {
    const { walletPublicKey, mint, symbol } = req.body;
    
    if (!walletPublicKey || !mint) {
      return res.status(400).json({ success: false, error: 'Missing wallet or mint' });
    }

    const updatedList = watchlistManager.addToWatchlist(walletPublicKey, { mint, symbol: symbol || 'UNKNOWN' });
    
    res.json({
      success: true,
      data: updatedList,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error adding to watchlist:', error);
    res.status(500).json({ success: false, error: 'Failed to add to watchlist' });
  }
});

/**
 * Remove from watchlist
 */
app.delete('/api/watchlist/:walletPublicKey/:mint', (req: Request, res: Response) => {
  try {
    const { walletPublicKey, mint } = req.params;
    const updatedList = watchlistManager.removeFromWatchlist(walletPublicKey, mint);
    
    res.json({
      success: true,
      data: updatedList,
      timestamp: Date.now()
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error removing from watchlist:', error);
    res.status(500).json({ success: false, error: 'Failed to remove from watchlist' });
  }
});

/**
 * Get Bot Wallet Status
 */
app.get('/api/bot/status', async (req: Request, res: Response) => {
  try {
    const wallet = getWalletKeypair();
    let balance = 0;
    
    // Check if wallet exists but is locked
    const walletPath = getWalletPath();
    const isLocked = fs.existsSync(walletPath) && !process.env.WALLET_PASSWORD && !process.env.WALLET_PRIVATE_KEY;
    
    if (wallet) {
      const solBalance = await getSOLBalance(connection, wallet.publicKey.toString());
      balance = solBalance;
    }

    res.json({
      success: true,
      data: {
        configured: !!wallet,
        isLocked,
        publicKey: wallet ? wallet.publicKey.toString() : null,
        balance
      },
      timestamp: Date.now()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get bot status'
    });
  }
});

/**
 * Get transaction history
 */
app.get('/api/trades/:walletPublicKey', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { walletPublicKey } = req.params;
    
    if (!isValidPublicKey(walletPublicKey)) {
      return res.status(400).json({ success: false, error: 'Invalid wallet public key' });
    }

    const trades = await taxService.getTrades(walletPublicKey);
    
    res.json({
      success: true,
      data: trades,
      timestamp: Date.now()
    });
  } catch (error: any) {
    logger.error('Error getting trades:', error);
    res.status(500).json({ success: false, error: 'Failed to get transaction history' });
  }
});

/**
 * Save Telegram Bot Token
 */
app.post('/api/settings/telegram', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token required' });
    
    configUtil.set('telegramBotToken', token);
    await telegramNotifier.reload();
    
    res.json({ success: true, message: 'Telegram token saved and bot reloaded' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate Telegram Link Code
 */
app.post('/api/telegram/link', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { walletPublicKey } = req.body;
    
    if (!isValidPublicKey(walletPublicKey)) {
      return res.status(400).json({ success: false, error: 'Invalid wallet public key' });
    }

    const code = telegramNotifier.generateLinkCode(walletPublicKey);
    
    res.json({
      success: true,
      data: {
        code,
        botUsername: telegramNotifier.botUsername || process.env.TELEGRAM_BOT_USERNAME || 'CanopiTradingBot'
      },
      timestamp: Date.now()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get Telegram connection status
 */
app.get('/api/telegram/status/:walletPublicKey', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { walletPublicKey } = req.params;
    const [user] = await db.select().from(telegramUsers).where(eq(telegramUsers.walletPublicKey, walletPublicKey));
    
    res.json({
      success: true,
      data: {
        linked: !!user,
        username: user?.username || null,
        botUsername: telegramNotifier.botUsername || process.env.TELEGRAM_BOT_USERNAME || 'CanopiTradingBot'
      },
      timestamp: Date.now()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- PRIVACY ENDPOINTS (ShadowWire) ---

/**
 * Get shielded status and balance
 */
app.get('/api/privacy/status/:walletAddress', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const status = await privacyService.getShieldedBalance(walletAddress);
    
    res.json({
      success: true,
      data: status,
      timestamp: Date.now()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Shield funds (Deposit to ShadowWire)
 */
app.post('/api/privacy/shield', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Invalid amount' });
    
    const result = await privacyService.shieldFunds(amount);
    res.json({ success: true, data: result, timestamp: Date.now() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Unshield funds (Withdraw from ShadowWire)
 */
app.post('/api/privacy/unshield', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Invalid amount' });
    
    const result = await privacyService.unshieldFunds(amount);
    res.json({ success: true, data: result, timestamp: Date.now() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
