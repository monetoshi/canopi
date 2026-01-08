import React, { useState } from 'react';
import { X, RefreshCw, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface RecoveryModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecoveryModal({ onClose, onSuccess }: RecoveryModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ recoveredCount: number, recoveredAmount: number, errors: string[] } | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/wallet/recover-ephemeral', { password });
      if (response.data.success) {
        setResult(response.data.data);
        setTimeout(() => {
           onSuccess();
        }, 2000);
      } else {
        setError(response.data.error || 'Recovery failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Recovery failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-emerald-400" />
            Recover Funds
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="text-center py-6 space-y-4">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">Recovery Complete</h3>
            <div className="bg-slate-800 rounded-lg p-4 text-sm text-left space-y-2">
              <p className="text-gray-400">Recovered Amount: <span className="text-white font-mono">{result.recoveredAmount.toFixed(4)} SOL</span></p>
              <p className="text-gray-400">Wallets Swept: <span className="text-white font-mono">{result.recoveredCount}</span></p>
              {result.errors.length > 0 && (
                <div className="text-red-400 text-xs mt-2">
                  <p className="font-bold">Errors:</p>
                  <ul className="list-disc pl-4">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <button 
              onClick={onClose}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
                <div className="text-sm text-yellow-100">
                  This will scan all temporary trading wallets and sweep any remaining SOL back to your main bot wallet.
                </div>
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
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Recovery'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
