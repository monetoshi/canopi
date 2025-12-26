'use client';

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { AlertCircle, TrendingDown, X, Clock } from 'lucide-react';
import type { PendingSell } from '@/types';
import { executePendingSell, cancelPendingSell } from '@/lib/api';
import { VersionedTransaction } from '@solana/web3.js';

interface PendingSellsProps {
  pendingSells: PendingSell[];
  onUpdate: () => void;
}

export default function PendingSells({ pendingSells, onUpdate }: PendingSellsProps) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [executing, setExecuting] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExecuteSell = async (sell: PendingSell) => {
    console.log('[PendingSell] ========== EXECUTE SELL STARTED ==========');
    console.log('[PendingSell] Sell ID:', sell.id);
    console.log('[PendingSell] Token:', sell.tokenMint.slice(0, 8));
    console.log('[PendingSell] Percentage:', sell.sellPercentage);
    console.log('[PendingSell] Reason:', sell.reason);

    if (!publicKey || !signTransaction) {
      console.log('[PendingSell] ❌ Wallet not connected');
      setError('Wallet not connected');
      return;
    }

    setExecuting(sell.id);
    setError(null);

    try {
      // Deserialize the prepared transaction
      console.log('[PendingSell] Step 1: Deserializing prepared transaction...');
      const txBuffer = Buffer.from(sell.preparedTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);
      console.log('[PendingSell] ✓ Transaction deserialized');

      // Sign transaction
      console.log('[PendingSell] Step 2: Requesting wallet signature...');
      const signedTx = await signTransaction(transaction);
      console.log('[PendingSell] ✓ Transaction signed');

      // Serialize signed transaction
      console.log('[PendingSell] Step 3: Serializing signed transaction...');
      const signedTxBase64 = Buffer.from(signedTx.serialize()).toString('base64');
      console.log('[PendingSell] ✓ Transaction serialized');

      // Execute via API
      console.log('[PendingSell] Step 4: Executing sell via API...');
      const result = await executePendingSell({
        id: sell.id,
        signedTransaction: signedTxBase64
      });
      console.log('[PendingSell] ✓ Sell executed. Signature:', result.signature);

      // Refresh data
      console.log('[PendingSell] Step 5: Refreshing UI data...');
      onUpdate();
      console.log('[PendingSell] ========== EXECUTE SELL COMPLETED ==========');
    } catch (err: any) {
      console.error('[PendingSell] ❌ ERROR at some step:');
      console.error('[PendingSell] Error message:', err.message);
      console.error('[PendingSell] Error details:', err);
      console.error('[PendingSell] Error stack:', err.stack);
      setError(err.message || 'Failed to execute sell');
    } finally {
      setExecuting(null);
    }
  };

  const handleCancelSell = async (sell: PendingSell) => {
    console.log('[PendingSell] Cancelling sell:', sell.id);

    setCancelling(sell.id);
    setError(null);

    try {
      const success = await cancelPendingSell(sell.id);
      if (!success) {
        throw new Error('Failed to cancel sell');
      }
      console.log('[PendingSell] ✓ Sell cancelled');
      onUpdate();
    } catch (err: any) {
      console.error('[PendingSell] ❌ Error cancelling sell:', err);
      setError(err.message || 'Failed to cancel sell');
    } finally {
      setCancelling(null);
    }
  };

  const formatTimeRemaining = (expiresAt: number) => {
    const now = Date.now();
    const remaining = expiresAt - now;

    if (remaining <= 0) return 'Expired';

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const getTransactionAge = (createdAt: number) => {
    const age = Date.now() - createdAt;
    return Math.floor(age / 1000); // Age in seconds
  };

  const isTransactionStale = (createdAt: number) => {
    const age = getTransactionAge(createdAt);
    return age > 90; // Solana blockhash lifetime is ~90 seconds
  };

  // Filter only pending sells
  const activeSells = pendingSells.filter(sell => sell.status === 'pending');

  if (activeSells.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 backdrop-blur-md rounded-xl p-4 border border-purple-700/50">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-5 h-5 text-purple-400 animate-pulse" />
        <h3 className="text-lg font-semibold text-white">
          Auto-Exit Ready ({activeSells.length})
        </h3>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-400 bg-red-900/20 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        {activeSells.map((sell) => {
          const isExecuting = executing === sell.id;
          const isCancelling = cancelling === sell.id;
          const isStale = isTransactionStale(sell.createdAt);
          const txAge = getTransactionAge(sell.createdAt);

          return (
            <div
              key={sell.id}
              className={`bg-black/40 rounded-lg p-3 border ${isStale ? 'border-yellow-600' : 'border-gray-700'}`}
            >
              {isStale && (
                <div className="mb-2 text-xs text-yellow-400 bg-yellow-900/20 p-2 rounded flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" />
                  Stale transaction ({txAge}s old). Backend will refresh automatically...
                </div>
              )}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">
                      {sell.tokenSymbol || `${sell.tokenMint.slice(0, 8)}...`}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      sell.currentProfit >= 0
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}>
                      {sell.currentProfit >= 0 ? '+' : ''}{sell.currentProfit.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {sell.reason}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {formatTimeRemaining(sell.expiresAt)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div>
                  <p className="text-gray-400">Sell Amount</p>
                  <p className="text-white font-semibold">{sell.sellPercentage}%</p>
                </div>
                <div>
                  <p className="text-gray-400">Current Price</p>
                  <p className="text-white font-semibold">${sell.currentPrice.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Est. SOL</p>
                  <p className="text-white font-semibold">~{sell.estimatedSolReceived.toFixed(4)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <p className="text-gray-400">Entry Price</p>
                  <p className="text-white">${sell.entryPrice.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Strategy</p>
                  <p className="text-white capitalize">{sell.strategy}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleExecuteSell(sell)}
                  disabled={isExecuting || isCancelling || !publicKey}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {isExecuting ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4" />
                      Execute Sell
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleCancelSell(sell)}
                  disabled={isExecuting || isCancelling || !publicKey}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {isCancelling ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Auto-exit conditions met. Click "Execute Sell" to approve or cancel if you prefer manual control.
      </p>
    </div>
  );
}
