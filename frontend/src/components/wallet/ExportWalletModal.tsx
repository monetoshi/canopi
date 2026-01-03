import React, { useState } from 'react';
import { X, Eye, EyeOff, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface ExportWalletModalProps {
  onClose: () => void;
}

export default function ExportWalletModal({ onClose }: ExportWalletModalProps) {
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/wallet/export', { password });
      if (response.data.success) {
        setPrivateKey(response.data.privateKey);
      } else {
        setError(response.data.error || 'Failed to export wallet');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to export wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (privateKey) {
      navigator.clipboard.writeText(privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Export Private Key</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!privateKey ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
                <div className="text-sm text-yellow-100">
                  Enter your password to reveal your private key. Never share this key with anyone.
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors"
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
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reveal Private Key'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div className="text-sm text-rose-100 font-bold">
                  WARNING: Anyone with this key can access your funds.
                </div>
              </div>
            </div>

            <div className="relative">
              <textarea
                readOnly
                value={showKey ? privateKey : '•'.repeat(privateKey.length)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-emerald-400 font-mono text-sm break-all h-32 focus:outline-none resize-none"
              />
              <button 
                onClick={() => setShowKey(!showKey)}
                className="absolute top-3 right-3 text-slate-500 hover:text-white"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy to Clipboard
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
