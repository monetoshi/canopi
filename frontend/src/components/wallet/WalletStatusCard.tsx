'use client';

import { Wallet, RefreshCw } from 'lucide-react';
import type { WalletBalance } from '@/types';

interface WalletStatusCardProps {
  balance: WalletBalance | null;
  loading: boolean;
  error: string | null;
}

export default function WalletStatusCard({ balance, loading, error }: WalletStatusCardProps) {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Wallet</h3>
        </div>
        {loading && <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />}
      </div>

      {error ? (
        <div className="text-red-400 text-sm">{error}</div>
      ) : balance ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-400">Address</p>
            <p className="text-sm font-mono text-white">
              {balance.publicKey.slice(0, 8)}...{balance.publicKey.slice(-8)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">SOL Balance</p>
            <p className="text-2xl font-bold text-white">{balance.sol.toFixed(4)}</p>
            <p className="text-sm text-gray-400">${balance.solUsd.toFixed(2)} USD</p>
          </div>
        </div>
      ) : (
        <div className="text-gray-400 text-sm">Loading wallet data...</div>
      )}
    </div>
  );
}
