'use client';

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Bell, TrendingUp, AlertCircle } from 'lucide-react';
import type { PendingDCABuy } from '@/types';
import { prepareBuyTransaction, executeDCABuy, getCurrentPrice } from '@/lib/api';
import { VersionedTransaction } from '@solana/web3.js';

interface PendingDCABuysProps {
  pendingBuys: PendingDCABuy[];
  onUpdate: () => void;
}

export default function PendingDCABuys({ pendingBuys, onUpdate }: PendingDCABuysProps) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [executing, setExecuting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExecuteBuy = async (buy: PendingDCABuy) => {
    console.log('[PendingDCABuy] ========== EXECUTE BUY STARTED ==========');
    console.log('[PendingDCABuy] Order ID:', buy.orderId);
    console.log('[PendingDCABuy] Buy Number:', buy.buyNumber);
    console.log('[PendingDCABuy] Token:', buy.tokenMint.slice(0, 8));
    console.log('[PendingDCABuy] SOL Amount:', buy.solAmount);

    if (!publicKey || !signTransaction) {
      console.log('[PendingDCABuy] ❌ Wallet not connected');
      setError('Wallet not connected');
      return;
    }

    setExecuting(`${buy.orderId}-${buy.buyNumber}`);
    setError(null);

    try {
      // Prepare buy transaction
      console.log('[PendingDCABuy] Step 1: Preparing buy transaction...');
      const data = await prepareBuyTransaction({
        walletPublicKey: publicKey.toString(),
        tokenMint: buy.tokenMint,
        solAmount: buy.solAmount,
        slippageBps: buy.slippageBps,
        strategy: buy.exitStrategy as any
      });
      console.log('[PendingDCABuy] ✓ Transaction prepared. Expected output:', data.expectedOutput);

      // Deserialize transaction
      console.log('[PendingDCABuy] Step 2: Deserializing transaction...');
      const txBuffer = Buffer.from(data.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);
      console.log('[PendingDCABuy] ✓ Transaction deserialized');

      // Sign transaction
      console.log('[PendingDCABuy] Step 3: Requesting wallet signature...');
      const signedTx = await signTransaction(transaction);
      console.log('[PendingDCABuy] ✓ Transaction signed');

      // Send signed transaction
      console.log('[PendingDCABuy] Step 4: Sending transaction to blockchain...');
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3
      });
      console.log('[PendingDCABuy] ✓ Transaction sent. Signature:', signature);

      // Confirm transaction
      console.log('[PendingDCABuy] Step 5: Waiting for confirmation...');
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('[PendingDCABuy] ✓ Transaction confirmed');

      // Get actual price
      console.log('[PendingDCABuy] Step 6: Getting actual price...');
      const actualPrice = await getCurrentPrice(buy.tokenMint) || buy.currentPrice;
      console.log('[PendingDCABuy] ✓ Actual price:', actualPrice);

      // Calculate actual token amount from quote
      const actualTokenAmount = Number(data.expectedOutput) || buy.estimatedTokenAmount;
      console.log('[PendingDCABuy] Actual token amount:', actualTokenAmount);

      // Record DCA buy execution
      console.log('[PendingDCABuy] Step 7: Recording DCA buy execution in backend...');
      console.log('[PendingDCABuy] Calling executeDCABuy with:', {
        orderId: buy.orderId,
        buyNumber: buy.buyNumber,
        signature,
        actualTokenAmount,
        actualSolSpent: buy.solAmount,
        actualPrice
      });
      await executeDCABuy({
        orderId: buy.orderId,
        buyNumber: buy.buyNumber,
        signature,
        actualTokenAmount,
        actualSolSpent: buy.solAmount,
        actualPrice
      });
      console.log('[PendingDCABuy] ✓ DCA buy recorded in backend');

      // Refresh data
      console.log('[PendingDCABuy] Step 8: Refreshing UI data...');
      onUpdate();
      console.log('[PendingDCABuy] ========== EXECUTE BUY COMPLETED ==========');
    } catch (err: any) {
      console.error('[PendingDCABuy] ❌ ERROR at some step:');
      console.error('[PendingDCABuy] Error message:', err.message);
      console.error('[PendingDCABuy] Error details:', err);
      console.error('[PendingDCABuy] Error stack:', err.stack);
      setError(err.message || 'Failed to execute buy');
    } finally {
      setExecuting(null);
    }
  };

  if (pendingBuys.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 backdrop-blur-md rounded-xl p-4 border border-purple-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-5 h-5 text-purple-400 animate-pulse" />
        <h3 className="text-lg font-semibold text-white">
          DCA Buys Ready ({pendingBuys.length})
        </h3>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-400 bg-red-900/20 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        {pendingBuys.map((buy) => (
          <div
            key={`${buy.orderId}-${buy.buyNumber}`}
            className="bg-black/40 rounded-lg p-3 border border-gray-700"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">
                    {buy.tokenSymbol || `${buy.tokenMint.slice(0, 8)}...`}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-400">
                    Buy #{buy.buyNumber}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Order: {buy.orderId.slice(0, 8)}...
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
              <div>
                <p className="text-gray-400">SOL Amount</p>
                <p className="text-white font-semibold">{buy.solAmount.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-gray-400">Price</p>
                <p className="text-white font-semibold">${buy.currentPrice.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-gray-400">Est. Tokens</p>
                <p className="text-white font-semibold">~{buy.estimatedTokenAmount.toFixed(2)}</p>
              </div>
            </div>

            <button
              onClick={() => handleExecuteBuy(buy)}
              disabled={executing === `${buy.orderId}-${buy.buyNumber}` || !publicKey}
              className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {executing === `${buy.orderId}-${buy.buyNumber}` ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Executing...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  Execute Buy
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        DCA buys require manual approval for security. Click "Execute Buy" to approve each transaction.
      </p>
    </div>
  );
}
