'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import { Position } from '@/types';
import { prepareBuyTransaction, executeBuyTransaction } from '@/lib/api';

interface AddToPositionModalProps {
  position: Position;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddToPositionModal({
  position,
  isOpen,
  onClose,
  onSuccess,
}: AddToPositionModalProps) {
  const { publicKey, signTransaction } = useWallet();
  const [solAmount, setSolAmount] = useState('0.1');
  const [slippageBps, setSlippageBps] = useState(300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddToPosition = async () => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected');
      return;
    }

    const amount = parseFloat(solAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Invalid SOL amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare transaction (uses instant buy with existing exit strategy)
      const data = await prepareBuyTransaction({
        walletPublicKey: publicKey.toString(),
        tokenMint: position.mint,
        solAmount: amount,
        slippageBps,
        strategy: position.strategy,
      });

      // Deserialize transaction
      const txBuffer = Buffer.from(data.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);

      // Sign transaction
      const signedTx = await signTransaction(transaction);
      const signedTxBase64 = Buffer.from(signedTx.serialize()).toString('base64');

      // Execute transaction
      await executeBuyTransaction({
        walletPublicKey: publicKey.toString(),
        signedTransaction: signedTxBase64,
        tokenMint: position.mint,
        solAmount: amount,
        strategy: position.strategy,
      });

      // Success
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error adding to position:', err);
      setError(err.message || 'Failed to add to position');
    } finally {
      setLoading(false);
    }
  };

  // Calculate estimated new average price
  const estimatedNewCost = position.solSpent + parseFloat(solAmount || '0');
  const estimatedNewTokens = position.tokenAmount + (parseFloat(solAmount || '0') / (position.currentPrice || position.entryPrice));
  const estimatedNewAvgPrice = estimatedNewCost / estimatedNewTokens;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-white mb-4">Add to Position</h3>

        {/* Current Position Info */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-400">Current Position</p>
          <p className="text-white font-semibold">
            {position.tokenAmount.toFixed(2)} tokens @ ${position.entryPrice.toFixed(4)}
          </p>
          <p className="text-sm text-gray-500">
            Total Cost: {position.solSpent.toFixed(4)} SOL
          </p>
        </div>

        {/* SOL Amount Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            SOL Amount to Add
          </label>
          <input
            type="number"
            value={solAmount}
            onChange={(e) => setSolAmount(e.target.value)}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-600"
            placeholder="0.1"
          />
        </div>

        {/* Slippage Tolerance */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Slippage Tolerance
          </label>
          <div className="flex gap-2">
            {[100, 300, 500, 1000].map((bps) => (
              <button
                key={bps}
                onClick={() => setSlippageBps(bps)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  slippageBps === bps
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {bps / 100}%
              </button>
            ))}
          </div>
        </div>

        {/* Estimated New Average */}
        {parseFloat(solAmount || '0') > 0 && (
          <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-3 mb-4">
            <p className="text-xs text-emerald-400 mb-1">Estimated New Average</p>
            <p className="text-emerald-300 font-semibold">
              ${estimatedNewAvgPrice.toFixed(4)} ({isNaN(estimatedNewAvgPrice) ? '0' : estimatedNewTokens.toFixed(2)} tokens)
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAddToPosition}
            disabled={loading || !solAmount || parseFloat(solAmount) <= 0}
            className="flex-1 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Add to Position'}
          </button>
        </div>
      </div>
    </div>
  );
}
