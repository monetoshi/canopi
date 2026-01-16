import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Position } from '@/types';
import { executeBotTrade, getWalletBalance } from '@/lib/api';

interface AddToPositionModalProps {
  position: Position;
  isOpen: boolean;
  onClose: () => void;
  onPositionUpdate: () => void;
}

const AddToPositionModal: React.FC<AddToPositionModalProps> = ({
  position,
  isOpen,
  onClose,
  onPositionUpdate,
}) => {
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { publicKey } = useWallet();

  const handleAddToPosition = async () => {
    if (!publicKey || !amount) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const walletBalance = await getWalletBalance(publicKey.toBase58());
      if (parseFloat(amount) > walletBalance.sol) {
        setError('Insufficient SOL balance.');
        setIsSubmitting(false);
        return;
      }

      await executeBotTrade({
        tokenMint: position.mint,
        solAmount: parseFloat(amount),
      });

      onPositionUpdate();
      onClose();
    } catch (err) {
      setError('Failed to add to position.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add to Position: {position.mint.slice(0, 6)}...</h2>
        <p className="mb-2">Current Size: {position.tokenAmount.toFixed(2)} tokens</p>
        <p className="mb-4">Current Value: ${((position.currentPrice || 0) * position.tokenAmount).toFixed(2)}</p>

        <div className="mb-4">
          <label htmlFor="amount" className="block text-sm font-medium text-gray-300">
            Amount to Add (SOL)
          </label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="e.g., 0.5"
          />
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleAddToPosition}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:bg-indigo-400"
            disabled={isSubmitting || !amount}
          >
            {isSubmitting ? 'Adding...' : 'Add to Position'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToPositionModal;