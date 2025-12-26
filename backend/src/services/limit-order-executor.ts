/**
 * Solana Trading Bot - Limit Order Executor Service
 * Monitors prices and executes limit orders when targets are hit
 */

import { limitOrderManager } from '../core/limit-order-manager';
import { positionManager } from '../core/position-manager';
import { LimitOrder } from '../types';
import axios from 'axios';

const PRICE_CHECK_INTERVAL = 30000; // 30 seconds
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

/**
 * Limit Order Executor Service
 * Monitors prices and executes limit orders automatically
 */
export class LimitOrderExecutor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private executeTransaction: Function | null = null;

  /**
   * Initialize with transaction executor function
   */
  constructor(executeTransactionFn?: Function) {
    this.executeTransaction = executeTransactionFn || null;
  }

  /**
   * Set the transaction executor function
   */
  setTransactionExecutor(fn: Function): void {
    this.executeTransaction = fn;
  }

  /**
   * Start monitoring limit orders
   */
  start(): void {
    if (this.isRunning) {
      console.log('[LimitOrderExecutor] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[LimitOrderExecutor] Starting price monitoring...');

    // Run immediately
    this.checkOrders();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.checkOrders();
    }, PRICE_CHECK_INTERVAL);
  }

  /**
   * Stop monitoring limit orders
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[LimitOrderExecutor] Stopped price monitoring');
  }

  /**
   * Check all pending limit orders
   */
  private async checkOrders(): Promise<void> {
    try {
      const allOrders = limitOrderManager.getAllOrders();
      const pendingOrders = allOrders.filter(o => o.status === 'pending');

      if (pendingOrders.length === 0) {
        return;
      }

      console.log(`[LimitOrderExecutor] Checking ${pendingOrders.length} pending orders...`);

      // Group orders by token mint to minimize API calls
      const ordersByToken = new Map<string, LimitOrder[]>();
      for (const order of pendingOrders) {
        const existing = ordersByToken.get(order.tokenMint) || [];
        existing.push(order);
        ordersByToken.set(order.tokenMint, existing);
      }

      // Check each token's price
      for (const [tokenMint, orders] of ordersByToken.entries()) {
        await this.checkTokenOrders(tokenMint, orders);
      }

      // Clean up old orders (weekly)
      const now = Date.now();
      const lastCleanup = (this as any).lastCleanup || 0;
      if (now - lastCleanup > 7 * 24 * 60 * 60 * 1000) {
        await limitOrderManager.cleanup();
        (this as any).lastCleanup = now;
      }
    } catch (error) {
      console.error('[LimitOrderExecutor] Error checking orders:', error);
    }
  }

  /**
   * Check orders for a specific token
   */
  private async checkTokenOrders(tokenMint: string, orders: LimitOrder[]): Promise<void> {
    try {
      // Fetch current price from DexScreener
      const currentPrice = await this.fetchTokenPrice(tokenMint);

      if (!currentPrice) {
        console.log(`[LimitOrderExecutor] No price data for ${tokenMint.slice(0, 8)}...`);
        return;
      }

      console.log(`[LimitOrderExecutor] ${tokenMint.slice(0, 8)}... current price: $${currentPrice}`);

      // Check each order for this token
      for (const order of orders) {
        if (await limitOrderManager.shouldExecuteOrder(order, currentPrice)) {
          await this.executeOrder(order, currentPrice);
        }
      }
    } catch (error) {
      console.error(`[LimitOrderExecutor] Error checking token ${tokenMint}:`, error);
    }
  }

  /**
   * Fetch current token price from DexScreener
   */
  private async fetchTokenPrice(tokenMint: string): Promise<number | null> {
    try {
      const response = await axios.get(`${DEXSCREENER_API}/${tokenMint}`, {
        timeout: 10000
      });

      if (response.data?.pairs && response.data.pairs.length > 0) {
        // Get the pair with highest liquidity
        const sortedPairs = response.data.pairs.sort((a: any, b: any) => {
          const liqA = parseFloat(a.liquidity?.usd || '0');
          const liqB = parseFloat(b.liquidity?.usd || '0');
          return liqB - liqA;
        });

        const price = parseFloat(sortedPairs[0].priceUsd);
        return isNaN(price) ? null : price;
      }

      return null;
    } catch (error: any) {
      if (error.code !== 'ECONNABORTED') {
        console.error(`[LimitOrderExecutor] Error fetching price for ${tokenMint}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Execute a limit order
   */
  private async executeOrder(order: LimitOrder, currentPrice: number): Promise<void> {
    console.log(`[LimitOrderExecutor] 🎯 LIMIT ORDER TRIGGERED!`);
    console.log(`[LimitOrderExecutor] Order ID: ${order.id}`);
    console.log(`[LimitOrderExecutor] Token: ${order.tokenSymbol || order.tokenMint.slice(0, 8)}...`);
    console.log(`[LimitOrderExecutor] Target Price: $${order.targetPrice}`);
    console.log(`[LimitOrderExecutor] Current Price: $${currentPrice}`);
    console.log(`[LimitOrderExecutor] Mode: ${order.isPrivate ? '🕵️ STEALTH (Private)' : '📢 PUBLIC'}`);
    
    // Import here to avoid circular dependencies
    const { getWalletKeypair, getConnection } = require('../utils/blockchain.util');
    const { jupiterService } = require('./jupiter.service');
    const { VersionedTransaction } = require('@solana/web3.js');
    const { positionManager } = require('../core/position-manager');
    const { taxService } = require('./tax.service');
    const { privacyService } = require('./privacy.service');
    const { ephemeralWalletManager } = require('../core/ephemeral-wallet-manager');

    const wallet = getWalletKeypair();
    
    if (!wallet) {
      console.log(`[LimitOrderExecutor] ⚠️ No server wallet configured - marking for manual approval`);
      return;
    }

    if (!order.isPrivate && wallet.publicKey.toString() !== order.walletPublicKey) {
      console.log(`[LimitOrderExecutor] ⚠️ Order wallet (${order.walletPublicKey}) does not match server wallet (${wallet.publicKey.toString()}) - skipping auto-exec`);
      return;
    }

    try {
      console.log(`[LimitOrderExecutor] 🤖 Auto-executing limit order...`);
      
      const connection = getConnection();
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      
      let signer = wallet;
      let executionWalletKey = wallet.publicKey.toString();

      // --- PRIVACY LAYER ---
      if (order.isPrivate && order.type === 'BUY') {
        const password = process.env.WALLET_PASSWORD || '';
        
        // 1. Check Shielded Balance
        const shieldStatus = await privacyService.getShieldedBalance(wallet.publicKey.toString());
        if (shieldStatus.available < order.solAmount + 0.01) {
           console.error(`[LimitOrderExecutor] ❌ Insufficient shielded balance for stealth trade. Needed: ${order.solAmount + 0.01}, Available: ${shieldStatus.available}`);
           return;
        }

        // 2. Create Ephemeral Wallet
        const ephemeralWallet = ephemeralWalletManager.createWallet(password);
        signer = ephemeralWallet;
        executionWalletKey = ephemeralWallet.publicKey.toString();
        console.log(`[LimitOrderExecutor] 🕵️ Created ephemeral wallet: ${executionWalletKey.slice(0, 8)}...`);

        // 3. Fund it privately
        console.log(`[LimitOrderExecutor] 🛡️ Funding ephemeral wallet from Shielded Pool...`);
        await privacyService.fundEphemeralWallet(executionWalletKey, order.solAmount + 0.005);
        
        // 4. Wait for funding
        console.log(`[LimitOrderExecutor] ⏳ Waiting for funding to confirm...`);
        await new Promise(resolve => setTimeout(resolve, 8000)); // Wait 8s for block propagation
      }
      
      let inputMint, outputMint, amount;
      
      if (order.type === 'BUY') {
         inputMint = SOL_MINT;
         outputMint = order.tokenMint;
         amount = Math.floor(order.solAmount * 1e9); // Lamports
      } else {
         // SELL logic (Private sells need to check if position is held in ephemeral wallet)
         inputMint = order.tokenMint;
         outputMint = SOL_MINT;
         
         const position = positionManager.getPosition(order.walletPublicKey, order.tokenMint);
         if (!position) {
            console.error(`[LimitOrderExecutor] Position not found for SELL order`);
            return;
         }

         // If position is private, we MUST use the execution wallet that holds the tokens
         if (position.isPrivate && position.executionWallet) {
            const password = process.env.WALLET_PASSWORD || '';
            const existingWallet = ephemeralWalletManager.getWallet(position.executionWallet, password);
            if (existingWallet) {
               signer = existingWallet;
               executionWalletKey = position.executionWallet;
               console.log(`[LimitOrderExecutor] 🕵️ Loaded existing execution wallet for private sell`);
            } else {
               console.error(`[LimitOrderExecutor] ❌ Could not load execution wallet for private position`);
               return;
            }
         }

         amount = Math.floor(position.tokenAmount * 10 ** 6); // Assuming 6 decimals, Todo: fetch real decimals
      }

      // 1. Get Quote
      const quote = await jupiterService.getQuote(
        inputMint,
        outputMint,
        amount,
        200 // 2% slippage for auto-orders
      );
      
      // 2. Get Swap Transaction
      // Important: Use executionWalletKey as the userPublicKey for the swap
      const swapData = await jupiterService.getSwapTransaction(quote, executionWalletKey);
      
      if (!swapData || !swapData.swapTransaction) {
         throw new Error('Failed to get swap transaction');
      }
      
      // 3. Sign Transaction
      const txBuffer = Buffer.from(swapData.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);
      transaction.sign([signer]);
      
      // 4. Send Transaction
      const signature = await connection.sendRawTransaction(transaction.serialize(), {
         skipPreflight: false,
         maxRetries: 3
      });
      
      console.log(`[LimitOrderExecutor] ✅ Transaction sent: ${signature}`);
      
      // 5. Update Order Status
      await limitOrderManager.markFilled(order.id, signature, order.tokenMint);
      
      // 6. Update Position / Tax
      if (order.type === 'BUY') {
         // Create/Update position
         const tokenAmount = Number(quote.outAmount) / 1e9; // Approx
         const position = positionManager.getPosition(order.walletPublicKey, order.tokenMint);
         
         if (position) {
            await positionManager.addToPosition(order.walletPublicKey, order.tokenMint, tokenAmount, order.solAmount, currentPrice);
         } else {
             await positionManager.addPosition({
               mint: order.tokenMint,
               walletPublicKey: order.walletPublicKey,
               entryTime: Date.now(),
               entryPrice: currentPrice,
               tokenAmount: tokenAmount,
               solSpent: order.solAmount,
               exitStagesCompleted: 0,
               strategy: order.exitStrategy || 'manual',
               isPercentageBased: false,
               highestProfit: 0,
               status: 'active',
               currentPrice: currentPrice,
               currentProfit: 0,
               isPrivate: order.isPrivate,
               executionWallet: order.isPrivate ? executionWalletKey : undefined
             });
         }
         
         // Record Tax
         try {
            await taxService.recordBuyTrade({
              walletPublicKey: order.walletPublicKey,
              tokenMint: order.tokenMint,
              solAmount: order.solAmount,
              tokenAmount: tokenAmount,
              priceUsd: currentPrice,
              priceSol: 0, 
              feeSol: 0.000005,
              signature,
              entryStrategy: 'limit'
            });
         } catch(e) { console.error('Tax error', e); }
         
      } else {
         // Handle SELL logic (close position)
         await positionManager.closePosition(order.walletPublicKey, order.tokenMint);
         
         // Private Sell: Reclaim funds to Shield
         if (order.isPrivate || (signer !== wallet)) {
            setTimeout(async () => {
               try {
                  const balance = await connection.getBalance(signer.publicKey);
                  const balanceSol = balance / 1e9;
                  if (balanceSol > 0.002) {
                     console.log(`[LimitOrderExecutor] 🛡️ Reclaiming ${balanceSol} SOL to shield...`);
                     await privacyService.shieldFunds(balanceSol - 0.002, signer);
                  }
               } catch(e: any) { console.error('Reclaim failed', e.message); }
            }, 10000);
         }
      }

    } catch (error: any) {
      console.error(`[LimitOrderExecutor] Error executing order ${order.id}:`, error.message);
      // Reset to pending so it can be retried
      await limitOrderManager.updateOrderStatus(order.id, 'pending');
    }
  }

  /**
   * Get executor status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: PRICE_CHECK_INTERVAL,
      hasExecutor: this.executeTransaction !== null
    };
  }
}

// Singleton instance
export const limitOrderExecutor = new LimitOrderExecutor();
