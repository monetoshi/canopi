'use client';

import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldAlert, ArrowUpRight, ArrowDownLeft, RefreshCw, Loader2 } from 'lucide-react';
import { getShieldedStatus, shieldFunds, unshieldFunds } from '@/lib/api';
import type { ShieldedStatus } from '@/lib/api';

interface PrivacyShieldProps {
  activeWalletKey?: string | null;
  onUpdate?: () => void;
}

export default function PrivacyShield({ activeWalletKey, onUpdate }: PrivacyShieldProps) {
  const [status, setStatus] = useState<ShieldedStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [amount, setAmount] = useState('0.1');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (activeWalletKey) {
      fetchStatus();
    }
  }, [activeWalletKey]);

  const fetchStatus = async () => {
    if (!activeWalletKey) return;
    setLoading(true);
    try {
      const data = await getShieldedStatus(activeWalletKey);
      setStatus(data);
    } catch (e) {
      console.error('Failed to fetch privacy status');
    } finally {
      setLoading(false);
    }
  };

  const handleShield = async () => {
    setError(null);
    setSuccess(null);
    setActionLoading(true);
    try {
      const result = await shieldFunds(parseFloat(amount));
      setSuccess(`Successfully shielded funds! Sig: ${result.signature.slice(0, 8)}...`);
      fetchStatus();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to shield funds');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnshield = async () => {
    setError(null);
    setSuccess(null);
    setActionLoading(true);
    try {
      const result = await unshieldFunds(parseFloat(amount));
      setSuccess(`Successfully unshielded funds! Sig: ${result.signature.slice(0, 8)}...`);
      fetchStatus();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to unshield funds');
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeWalletKey) return null;

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-emerald-900/30">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Privacy Shield</h3>
            <p className="text-xs text-gray-400">Powered by ShadowWire ZK-Proofs</p>
          </div>
        </div>
        <button 
          onClick={fetchStatus}
          disabled={loading}
          className="text-gray-500 hover:text-emerald-400 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Shielded Balance */}
        <div className="bg-emerald-950/20 rounded-xl p-4 border border-emerald-500/10">
          <p className="text-sm text-gray-400 mb-1">Shielded Balance</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-emerald-400">
              {status ? status.available.toFixed(4) : '0.0000'}
            </p>
            <p className="text-sm text-emerald-600 mb-1 font-semibold">SOL</p>
          </div>
          {status && (
            <p className="text-[10px] text-gray-500 mt-2 font-mono truncate">
              Pool: {status.poolAddress}
            </p>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col justify-center">
          <div className="flex items-start gap-2 text-xs text-gray-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p>Shielded funds are hidden on-chain. Move funds here before trading for maximum privacy.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Amount to Shield/Unshield</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.1"
              min="0.01"
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-600 pl-10"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">
              S
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleShield}
            disabled={actionLoading || parseFloat(amount) <= 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all text-sm"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
            Shield Funds
          </button>
          <button
            onClick={handleUnshield}
            disabled={actionLoading || !status || status.available < parseFloat(amount)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg border border-gray-700 transition-all text-sm"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4" />}
            Unshield
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-500/20 rounded-lg flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-lg flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-400">{success}</p>
          </div>
        )}
      </div>
    </div>
  );
}
