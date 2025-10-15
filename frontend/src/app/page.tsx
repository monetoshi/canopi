'use client';

/**
 * Main Dashboard Page
 * Trading bot dashboard with wallet connection, positions, and trading interface
 */

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Activity, TrendingUp, Wallet, Settings } from 'lucide-react';
import { getWalletBalance, getPositions, getStrategies, getDCAOrders, getPendingDCABuys } from '@/lib/api';
import type { WalletBalance, Position, StrategyConfig, ExitStrategy, DCAOrder, PendingDCABuy } from '@/types';
import PositionCard from '@/components/trading/PositionCard';
import QuickSnipe from '@/components/trading/QuickSnipe';
import WalletStatusCard from '@/components/wallet/WalletStatusCard';
import TokenSearch from '@/components/trading/TokenSearch';
import Watchlist from '@/components/trading/Watchlist';
import DCAOrdersList from '@/components/trading/DCAOrdersList';
import PendingDCABuys from '@/components/trading/PendingDCABuys';

export default function Home() {
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [strategies, setStrategies] = useState<Record<ExitStrategy, StrategyConfig> | null>(null);
  const [selectedToken, setSelectedToken] = useState<{ mint: string; symbol: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dcaOrders, setDcaOrders] = useState<DCAOrder[]>([]);
  const [pendingBuys, setPendingBuys] = useState<PendingDCABuy[]>([]);

  // Prevent hydration errors by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch wallet data when connected
  useEffect(() => {
    if (mounted && connected && publicKey) {
      fetchWalletData();
      fetchStrategies();

      // Refresh every 10 seconds
      const interval = setInterval(fetchWalletData, 10000);
      return () => clearInterval(interval);
    } else {
      setBalance(null);
      setPositions([]);
    }
  }, [mounted, connected, publicKey]);

  const fetchWalletData = async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const [balanceData, positionsData, dcaOrdersData, pendingBuysData] = await Promise.all([
        getWalletBalance(publicKey.toString()),
        getPositions(publicKey.toString()),
        getDCAOrders(publicKey.toString()),
        getPendingDCABuys(publicKey.toString())
      ]);

      setBalance(balanceData);
      setPositions(positionsData);
      setDcaOrders(dcaOrdersData);
      setPendingBuys(pendingBuysData);
    } catch (err: any) {
      console.error('Error fetching wallet data:', err);
      setError(err.message || 'Failed to fetch wallet data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStrategies = async () => {
    try {
      const data = await getStrategies();
      setStrategies(data);
    } catch (err) {
      console.error('Error fetching strategies:', err);
    }
  };

  const handleSelectToken = (mint: string, symbol: string) => {
    setSelectedToken({ mint, symbol });
    // Scroll to Quick Snipe section (only on client-side)
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const element = document.getElementById('quick-snipe');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  const activePositions = positions.filter(p => p.status === 'active');

  // Calculate total value in SOL
  // Token prices are in USD, so we need to convert the USD value to SOL
  const totalValue = activePositions.reduce((sum, p) => {
    // Since we bought with SOL, the value is essentially the SOL we spent
    // adjusted by the profit/loss percentage
    const profitMultiplier = 1 + (p.currentProfit / 100);
    const currentValueInSol = p.solSpent * profitMultiplier;
    return sum + currentValueInSol;
  }, 0);

  const totalProfit = activePositions.reduce((sum, p) => {
    const profitMultiplier = 1 + (p.currentProfit / 100);
    const currentValueInSol = p.solSpent * profitMultiplier;
    const cost = p.solSpent;
    return sum + (currentValueInSol - cost);
  }, 0);

  const profitPercent = balance ? (totalProfit / (balance.sol > 0 ? balance.sol * 100 : 1)) * 100 : 0;

  // Prevent hydration errors by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-emerald-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-emerald-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/20 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/canopi-icon.svg"
                alt="Canopi"
                className="w-10 h-10"
              />
              <div>
                <h1 className="text-xl font-bold text-white">Canopi</h1>
                <p className="text-sm text-gray-400">Algorithmic trading, elevated</p>
              </div>
            </div>
            <WalletMultiButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!connected ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <img
              src="/canopi-logo.svg"
              alt="Canopi Logo"
              className="w-32 h-32 mb-6 opacity-90"
            />
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to Canopi</h2>
            <p className="text-gray-400 mb-8 max-w-md">
              Algorithmic trading, elevated. Connect your wallet to start growing your portfolio with intelligent entry and exit strategies for Solana.
            </p>
            <WalletMultiButton />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Wallet & Stats */}
            <div className="space-y-6">
              {/* Pending DCA Buys Notification */}
              {pendingBuys.length > 0 && (
                <PendingDCABuys pendingBuys={pendingBuys} onUpdate={fetchWalletData} />
              )}

              {/* Wallet Status */}
              <WalletStatusCard balance={balance} loading={loading} error={error} />

              {/* Portfolio Stats */}
              <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold text-white mb-4">Portfolio</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-400">Total Value</p>
                    <p className="text-2xl font-bold text-white">
                      {totalValue.toFixed(4)} SOL
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total P&L</p>
                    <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(4)} SOL
                      <span className="text-sm ml-2">
                        ({profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%)
                      </span>
                    </p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Active Positions</span>
                    <span className="text-white font-semibold">{activePositions.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Positions</span>
                    <span className="text-white font-semibold">{positions.length}</span>
                  </div>
                </div>
              </div>

              {/* Quick Snipe */}
              <div id="quick-snipe">
                <QuickSnipe
                  strategies={strategies}
                  onSuccess={fetchWalletData}
                  selectedToken={selectedToken}
                />
              </div>
            </div>

            {/* Right Column - Active Positions, Token Search & Watchlist */}
            <div className="lg:col-span-2 space-y-6">
              {/* Active Positions */}
              <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Active Positions</h3>
                  <button
                    onClick={fetchWalletData}
                    disabled={loading}
                    className="text-sm text-emerald-500 hover:text-emerald-400 disabled:opacity-50"
                  >
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>

                {activePositions.length === 0 ? (
                  <div className="text-center py-12">
                    <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No active positions</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Start trading to see your positions here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activePositions.map((position) => (
                      <PositionCard
                        key={`${position.mint}-${position.entryTime}`}
                        position={position}
                        onSell={fetchWalletData}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* DCA Orders */}
              <DCAOrdersList orders={dcaOrders} onUpdate={fetchWalletData} />

              {/* Token Search */}
              <TokenSearch onSelectToken={handleSelectToken} />

              {/* Watchlist */}
              <Watchlist onSelectToken={handleSelectToken} />

              {/* Closed Positions */}
              {positions.filter(p => p.status === 'closed').length > 0 && (
                <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800 mt-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Recent Closed Positions</h3>
                  <div className="space-y-3">
                    {positions
                      .filter(p => p.status === 'closed')
                      .slice(0, 5)
                      .map((position) => (
                        <div
                          key={`${position.mint}-${position.entryTime}`}
                          className="flex justify-between items-center p-3 bg-gray-900/50 rounded-lg"
                        >
                          <div>
                            <p className="text-sm text-gray-400">Token: {position.mint.slice(0, 8)}...</p>
                            <p className="text-xs text-gray-500">Strategy: {position.strategy}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${(position.currentProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {(position.currentProfit || 0) >= 0 ? '+' : ''}{(position.currentProfit || 0).toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-black/20 backdrop-blur-md mt-12">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-gray-400">
            Canopi - Algorithmic trading, elevated
          </p>
        </div>
      </footer>
    </div>
  );
}
