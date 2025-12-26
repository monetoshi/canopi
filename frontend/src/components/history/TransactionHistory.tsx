'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, ArrowUpRight, ArrowDownLeft, Shield, Clock } from 'lucide-react';
import { getTrades } from '@/lib/api';
import type { Trade } from '@/types';

interface TransactionHistoryProps {
  activeWalletKey: string;
}

export default function TransactionHistory({ activeWalletKey }: TransactionHistoryProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeWalletKey) {
      fetchTrades();
    }
  }, [activeWalletKey]);

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const data = await getTrades(activeWalletKey);
      setTrades(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-900/20 rounded-xl border border-red-500/20 text-red-400">
        <p>{error}</p>
        <button 
          onClick={fetchTrades}
          className="mt-4 px-4 py-2 bg-red-900/40 hover:bg-red-900/60 rounded-lg text-sm transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center p-12 bg-gray-900/30 rounded-xl border border-gray-800">
        <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-300">No Transactions Yet</h3>
        <p className="text-sm text-gray-500 mt-2">
          Your buy and sell history will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Transaction History</h2>
        <div className="text-sm text-gray-400">
          Total: {trades.length} trades
        </div>
      </div>

      <div className="bg-black/40 backdrop-blur-md rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-900/50 text-xs text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Token</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Total Value</th>
                <th className="px-6 py-4 text-right">Transaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {trades.map((trade) => {
                const isBuy = trade.type === 'BUY';
                const isPrivate = false; // Todo: add isPrivate flag to Trade schema if needed, or infer from logic
                // Currently privacy is tracked on Position, not Trade explicitly in current schema, 
                // but we can infer or just link normally. Solscan handles the privacy view.
                
                return (
                  <tr key={trade.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {new Date(trade.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        isBuy 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {isBuy ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {trade.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <img 
                          src={`https://dd.dexscreener.com/ds-data/tokens/solana/${trade.tokenMint}.png`}
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                          className="w-5 h-5 rounded-full"
                          alt=""
                        />
                        <span className="text-sm font-mono text-gray-300">
                          {trade.tokenMint.slice(0, 4)}...{trade.tokenMint.slice(-4)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                      {parseFloat(trade.tokenAmount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      ${parseFloat(trade.priceUsd).toFixed(6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {parseFloat(trade.solAmount).toFixed(4)} SOL
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <a
                        href={`https://solscan.io/tx/${trade.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
