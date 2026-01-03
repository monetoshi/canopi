import React, { useState } from 'react';
import { X, Lock, Key, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface CreateWalletModalProps {
  onCreated: () => void;
  onCancel: () => void;
}

export default function CreateWalletModal({ onCreated, onCancel }: CreateWalletModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/wallet/setup', { password });
      if (response.data.success) {
        onCreated();
      } else {
        setError(response.data.error || 'Failed to create wallet');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-emerald-400">
            <Key className="w-6 h-6" />
            <h2 className="text-xl font-bold text-white">Create Trading Wallet</h2>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <Lock className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-sm text-emerald-100">
              This password will encrypt your new wallet file locally. 
              <br/>
              <strong>Do not lose it.</strong> There is no recovery.
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              New Password
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

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Wallet...
                </>
              ) : (
                'Create & Encrypt Wallet'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
