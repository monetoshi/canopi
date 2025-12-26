'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface TaxSummary {
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  shortTermGains: number;
  shortTermLosses: number;
  netShortTerm: number;
  longTermGains: number;
  longTermLosses: number;
  netLongTerm: number;
  totalNetGainLoss: number;
  washSalesDisallowed: number;
  taxYear: number;
}

interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  tokenMint: string;
  tokenAmount: string;
  priceUsd: string;
  realizedGainLossUsd?: string;
  timestamp: string;
  isShortTerm?: boolean;
  isWashSale?: boolean;
}

export function TaxDashboard() {
  const { publicKey } = useWallet();
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (publicKey) {
      fetchData();
    }
  }, [publicKey, selectedYear]);

  const fetchData = async () => {
    if (!publicKey) return;

    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Fetch summary
      const summaryRes = await fetch(
        `${apiUrl}/api/tax/summary/${publicKey.toString()}?year=${selectedYear}`
      );
      const summaryData = await summaryRes.json();
      if (summaryData.success) {
        setSummary(summaryData.data);
      }

      // Fetch trades
      const tradesRes = await fetch(
        `${apiUrl}/api/tax/trades/${publicKey.toString()}?year=${selectedYear}`
      );
      const tradesData = await tradesRes.json();
      if (tradesData.success) {
        setTrades(tradesData.data);
      }
    } catch (error) {
      console.error('Error fetching tax data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!publicKey) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    window.open(
      `${apiUrl}/api/tax/export/${publicKey.toString()}?year=${selectedYear}`,
      '_blank'
    );
  };

  if (!publicKey) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Connect your wallet to view tax data</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-gray-400 mt-2">Loading tax data...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header with Year Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Tax Dashboard</h3>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-3 py-1 bg-gray-800 text-white rounded-lg border border-gray-700 text-sm"
        >
          {[2025, 2024, 2023].map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="space-y-2">
          {/* Total Gain/Loss */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Total Net Gain/Loss</div>
            <div
              className={`text-2xl font-bold ${
                summary.totalNetGainLoss >= 0 ? 'text-green-500' : 'text-red-500'
              }`}
            >
              ${summary.totalNetGainLoss.toFixed(2)}
            </div>
          </div>

          {/* Short-term */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Short-term (&lt;1 year)</div>
            <div className="flex justify-between text-sm">
              <span className="text-green-500">+${summary.shortTermGains.toFixed(2)}</span>
              <span className="text-red-500">-${summary.shortTermLosses.toFixed(2)}</span>
              <span
                className={`font-bold ${
                  summary.netShortTerm >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                ${summary.netShortTerm.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Long-term */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Long-term (&gt;1 year)</div>
            <div className="flex justify-between text-sm">
              <span className="text-green-500">+${summary.longTermGains.toFixed(2)}</span>
              <span className="text-red-500">-${summary.longTermLosses.toFixed(2)}</span>
              <span
                className={`font-bold ${
                  summary.netLongTerm >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                ${summary.netLongTerm.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Wash Sales */}
          {summary.washSalesDisallowed > 0 && (
            <div className="bg-yellow-900/30 rounded-lg p-3 border border-yellow-700">
              <div className="text-xs text-yellow-400 mb-1">Wash Sales Disallowed</div>
              <div className="text-sm font-bold text-yellow-500">
                ${summary.washSalesDisallowed.toFixed(2)}
              </div>
            </div>
          )}

          {/* Trade Count */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Trades</div>
            <div className="flex gap-4 text-sm">
              <span className="text-white">{summary.totalTrades} total</span>
              <span className="text-green-500">{summary.buyTrades} buys</span>
              <span className="text-red-500">{summary.sellTrades} sells</span>
            </div>
          </div>
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        Export 1099-B (CSV)
      </button>

      {/* Recent Trades */}
      <div className="mt-4">
        <h4 className="text-sm font-bold text-white mb-2">Recent Trades</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {trades.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No trades for {selectedYear}</p>
          ) : (
            trades.slice(0, 10).map((trade) => (
              <div
                key={trade.id}
                className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-xs"
              >
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={`font-bold ${
                      trade.type === 'BUY' ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {trade.type}
                  </span>
                  <span className="text-gray-400">
                    {new Date(trade.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-gray-300">
                  {parseFloat(trade.tokenAmount).toFixed(2)} tokens @ $
                  {parseFloat(trade.priceUsd).toFixed(6)}
                </div>
                {trade.type === 'SELL' && trade.realizedGainLossUsd && (
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`font-medium ${
                        parseFloat(trade.realizedGainLossUsd) >= 0
                          ? 'text-green-500'
                          : 'text-red-500'
                      }`}
                    >
                      ${parseFloat(trade.realizedGainLossUsd).toFixed(2)}
                    </span>
                    {trade.isShortTerm && (
                      <span className="text-xs text-gray-500">short-term</span>
                    )}
                    {trade.isWashSale && (
                      <span className="text-xs text-yellow-500">wash sale</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
