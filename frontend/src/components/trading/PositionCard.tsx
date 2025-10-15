'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TrendingUp, TrendingDown, Clock, Target } from 'lucide-react';
import type { Position } from '@/types';
import { prepareSellTransaction, executeSellTransaction } from '@/lib/api';
import { VersionedTransaction } from '@solana/web3.js';
import AddToPositionModal from './AddToPositionModal';

interface PositionCardProps {
  position: Position;
  onSell: () => void;
}

export default function PositionCard({ position, onSell }: PositionCardProps) {
  const { publicKey, signTransaction } = useWallet();
  const [selling, setSelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const profitPercent = position.currentProfit || 0;
  const isProfit = profitPercent >= 0;
  const timeHeld = Math.floor((Date.now() - position.entryTime) / 60000); // minutes

  const handleSell = async (percentage: number) => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected');
      return;
    }

    setSelling(true);
    setError(null);

    try {
      // Prepare sell transaction
      const data = await prepareSellTransaction({
        walletPublicKey: publicKey.toString(),
        tokenMint: position.mint,
        percentage,
        slippageBps: 200
      });

      // Deserialize transaction
      const txBuffer = Buffer.from(data.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);

      // Sign transaction
      const signedTx = await signTransaction(transaction);
      const signedTxBase64 = Buffer.from(signedTx.serialize()).toString('base64');

      // Execute sell
      await executeSellTransaction({
        walletPublicKey: publicKey.toString(),
        tokenMint: position.mint,
        signedTransaction: signedTxBase64,
        percentage
      });

      // Refresh positions
      onSell();
    } catch (err: any) {
      console.error('Error selling:', err);
      setError(err.message || 'Failed to sell position');
    } finally {
      setSelling(false);
    }
  };

  return (
    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden flex items-center justify-center flex-shrink-0">
            {!logoError ? (
              <img
                src={`https://dd.dexscreener.com/ds-data/tokens/solana/${position.mint}.png`}
                alt="Token logo"
                className="w-full h-full object-cover"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-xs font-bold">
                {position.mint.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="text-white font-semibold">Token Position</p>
            <p className="text-xs font-mono text-gray-400">
              {position.mint.slice(0, 8)}...{position.mint.slice(-8)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}{profitPercent.toFixed(2)}%
          </p>
          <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
            {isProfit ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {position.strategy.toUpperCase()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
        <div>
          <p className="text-gray-400">Entry Price</p>
          <p className="text-white">${position.entryPrice.toFixed(8)}</p>
        </div>
        <div>
          <p className="text-gray-400">Current Price</p>
          <p className="text-white">${(position.currentPrice || 0).toFixed(8)}</p>
        </div>
        <div>
          <p className="text-gray-400">Amount</p>
          <p className="text-white">{position.tokenAmount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-400">Invested</p>
          <p className="text-white">{position.solSpent.toFixed(4)} SOL</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeHeld}m held
        </span>
        <span className="flex items-center gap-1">
          <Target className="w-3 h-3" />
          Stage {position.exitStagesCompleted + 1}
        </span>
        <span className="flex items-center gap-1 text-purple-400 font-medium">
          <TrendingUp className="w-3 h-3" />
          {position.strategy.toUpperCase()} Strategy
        </span>
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-400 bg-red-900/20 p-2 rounded">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {/* Sell Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleSell(25)}
            disabled={selling}
            className="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            Sell 25%
          </button>
          <button
            onClick={() => handleSell(50)}
            disabled={selling}
            className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            Sell 50%
          </button>
          <button
            onClick={() => handleSell(100)}
            disabled={selling}
            className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            Sell All
          </button>
        </div>

        {/* Add to Position Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Add to Position
        </button>
      </div>

      {selling && (
        <p className="text-xs text-purple-400 mt-2 text-center">Processing transaction...</p>
      )}

      {/* Add to Position Modal */}
      <AddToPositionModal
        position={position}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={onSell}
      />
    </div>
  );
}
