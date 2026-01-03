import React, { useState } from 'react';
import { X, Send, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface WithdrawModalProps {
  onClose: () => void;
  onSuccess: () => void;
  maxAmount: number;
}

export default function WithdrawModal({ onClose, onSuccess, maxAmount }: WithdrawModalProps) {
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (parseFloat(amount) > maxAmount) {
      setError('Insufficient funds');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/wallet/withdraw', { 
        password,
        destination,
        amount: parseFloat(amount)
      });
      
      if (response.data.success) {
        setTxSignature(response.data.signature);
        setTimeout(() => {
           onSuccess();
           onClose();
        }, 3000);
      } else {
        setError(response.data.error || 'Withdrawal failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMax = () => {
    // Leave 0.002 SOL for gas
    const max = Math.max(0, maxAmount - 0.002);
    setAmount(max.toFixed(4));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Withdraw Funds</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {txSignature ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Withdrawal Sent!</h3>
            <a 
              href={`https://solscan.io/tx/${txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline text-sm"
            >
              View Transaction
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Recipient Address
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono text-sm"
                placeholder="Solana Address"
                required
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="block text-sm font-medium text-slate-300">
                  Amount (SOL)
                </label>
                <button 
                  type="button"
                  onClick={handleMax}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  Max: {maxAmount.toFixed(4)}
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.000000001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="0.00"
                  required
                />
                <div className="absolute right-4 top-3 text-slate-500 text-sm">SOL</div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Wallet Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="text-rose-400 text-sm bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <Send className="w-4 h-4" />
                  Send Funds
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
