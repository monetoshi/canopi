'use client';

/**
 * Main Dashboard Page
 * Trading bot dashboard with wallet connection, positions, and trading interface
 */

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Activity, TrendingUp, Wallet, Settings, Wifi, WifiOff, Receipt, Home as HomeIcon, Bot, ChevronRight } from 'lucide-react';
import { getWalletBalance, getPositions, getStrategies, getDCAOrders, getPendingDCABuys, getPendingSells, getBotStatus } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { WalletBalance, Position, StrategyConfig, ExitStrategy, DCAOrder, PendingDCABuy, PendingSell, BotStatus } from '@/types';
import PositionCard from '@/components/trading/PositionCard';
import QuickSnipe from '@/components/trading/QuickSnipe';
import WalletStatusCard from '@/components/wallet/WalletStatusCard';
import TokenSearch from '@/components/trading/TokenSearch';
import Watchlist from '@/components/trading/Watchlist';
import PrivacyShield from '@/components/trading/PrivacyShield';
import DCAOrdersList from '@/components/trading/DCAOrdersList';
import PendingDCABuys from '@/components/trading/PendingDCABuys';
import PendingSells from '@/components/trading/PendingSells';
import BackgroundTrees from '@/components/ui/BackgroundTrees';
import { Drawer, DrawerItem } from '@/components/layout/Drawer';
import TransactionHistory from '@/components/history/TransactionHistory';
import TelegramSetup from '@/components/settings/TelegramSetup';

export default function Home() {
  const { publicKey, connected, signMessage } = useWallet();
  const [isElectron, setIsElectron] = useState(false);
  const [showIntegrated, setShowIntegrated] = useState(false);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [strategies, setStrategies] = useState<Record<ExitStrategy, StrategyConfig> | null>(null);
  const [selectedToken, setSelectedToken] = useState<{ mint: string; symbol: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dcaOrders, setDcaOrders] = useState<DCAOrder[]>([]);
  const [pendingBuys, setPendingBuys] = useState<PendingDCABuy[]>([]);
  const [pendingSells, setPendingSells] = useState<PendingSell[]>([]);
  const [drawerView, setDrawerView] = useState<'dashboard' | 'history'>('dashboard');

  // Use either the connected Phantom wallet OR the server wallet public key if in integrated mode
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  
  useEffect(() => {
    const checkBot = async () => {
      try {
        const status = await getBotStatus();
        setBotStatus(status);
      } catch (e) {}
    };
    checkBot();
  }, []);

  const activeWalletKey = connected ? publicKey?.toString() : (showIntegrated ? botStatus?.publicKey : null);

  // WebSocket for real-time position updates
  const {
    positions: wsPositions,
    isConnected: wsConnected,
    error: wsError,
    reconnect: wsReconnect
  } = useWebSocket(activeWalletKey || null, signMessage);

  // Prevent hydration errors by only rendering after mount
  useEffect(() => {
    setMounted(true);
    setIsElectron(typeof window !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron'));
  }, []);

  // Sync WebSocket positions to state
  useEffect(() => {
    if (wsPositions.length > 0) {
      setPositions(wsPositions);
    }
  }, [wsPositions]);

  // Fetch wallet data when connected
  useEffect(() => {
    if (mounted && (connected || showIntegrated) && activeWalletKey) {
      fetchWalletData();
      fetchStrategies();

      // Refresh balance, DCA, and pending buys every 30 seconds
      // (Positions updated via WebSocket in real-time)
      const interval = setInterval(() => {
        fetchBalanceAndOrders();
      }, 30000);
      return () => clearInterval(interval);
    } else {
      setBalance(null);
      setPositions([]);
    }
  }, [mounted, connected, showIntegrated, activeWalletKey]);

  const fetchBalanceAndOrders = async () => {
    if (!activeWalletKey) return;

    try {
      const [balanceData, dcaOrdersData, pendingBuysData, pendingSellsData] = await Promise.all([
        getWalletBalance(activeWalletKey),
        getDCAOrders(activeWalletKey),
        getPendingDCABuys(activeWalletKey),
        getPendingSells(activeWalletKey)
      ]);

      setBalance(balanceData);
      setDcaOrders(dcaOrdersData);
      setPendingBuys(pendingBuysData);
      setPendingSells(pendingSellsData);
    } catch (err: any) {
      console.error('Error fetching balance and orders:', err);
    }
  };

  const fetchWalletData = async () => {
    if (!activeWalletKey) return;

    setLoading(true);
    setError(null);

    try {
      // Always fetch balance, DCA orders, pending buys, and pending sells
      const [balanceData, dcaOrdersData, pendingBuysData, pendingSellsData, positionsData] = await Promise.all([
        getWalletBalance(activeWalletKey),
        getDCAOrders(activeWalletKey),
        getPendingDCABuys(activeWalletKey),
        getPendingSells(activeWalletKey),
        // Fetch positions as fallback if WebSocket not connected
        wsConnected ? Promise.resolve([]) : getPositions(activeWalletKey)
      ]);

      setBalance(balanceData);
      setDcaOrders(dcaOrdersData);
      setPendingBuys(pendingBuysData);
      setPendingSells(pendingSellsData);

      // Only update positions from API if WebSocket is not connected
      if (!wsConnected && positionsData.length > 0) {
        setPositions(positionsData);
      }
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
    // Scroll to Trading Strategies section (only on client-side)
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
  const totalValue = activePositions.reduce((sum, p) => {
    const profitMultiplier = 1 + ((p.currentProfit || 0) / 100);
    const currentValueInSol = p.solSpent * profitMultiplier;
    return sum + currentValueInSol;
  }, 0);

  const totalProfit = activePositions.reduce((sum, p) => {
    const profitMultiplier = 1 + ((p.currentProfit || 0) / 100);
    const currentValueInSol = p.solSpent * profitMultiplier;
    const cost = p.solSpent;
    return sum + (currentValueInSol - cost);
  }, 0);

  const profitPercent = balance ? (totalProfit / (balance.sol > 0 ? balance.sol : 1)) * 100 : 0;

  // Prevent hydration errors by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-emerald-950 to-slate-900 relative flex items-center justify-center">
        <BackgroundTrees />
        <div className="relative z-10 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-emerald-950 to-slate-900 relative">
      {/* Animated Background */}
      <BackgroundTrees />

      {/* Drawer Navigation */}
      <Drawer>
        <div className={isElectron ? 'pt-8' : ''}>
          <DrawerItem
            icon={<HomeIcon />}
            label="Dashboard"
            onClick={() => setDrawerView('dashboard')}
            active={drawerView === 'dashboard'}
          />
          <DrawerItem
            icon={<Receipt />}
            label="Transaction History"
            onClick={() => setDrawerView('history')}
            active={drawerView === 'history'}
          />
        </div>

        {/* Drawer Content */}
        <div className="mt-4 border-t border-gray-700">
          {drawerView === 'history' && activeWalletKey && (
            <TransactionHistory activeWalletKey={activeWalletKey} />
          )}
        </div>

        {/* Settings Footer */}
        {activeWalletKey && (
          <TelegramSetup activeWalletKey={activeWalletKey} />
        )}
      </Drawer>

      {/* Header */}
      <header className={`relative border-b border-gray-800 bg-black/20 backdrop-blur-md z-10 ${isElectron ? 'pt-8 drag-region' : ''}`}>
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
          </div>
        </div>
      </header>

      <main className="relative container mx-auto px-4 py-8 z-10">
        {(!connected && !showIntegrated) ? (
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
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <WalletMultiButton>Select External Wallet</WalletMultiButton>
              
              <button
                onClick={() => setShowIntegrated(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg border border-emerald-600/30 transition-all font-semibold"
              >
                <Bot className="w-5 h-5" />
                Access Integrated Wallet
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>
            </div>
            
            {!botStatus?.configured && showIntegrated && (
               <p className="mt-4 text-xs text-yellow-500/70">
                 ⚠️ Warning: No bot wallet configured in backend.
               </p>
            )}
          </div>
        ) : (
          <>
            {/* Top Row - Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 animate-fadeIn">
              {/* Wallet Status */}
              <WalletStatusCard 
                balance={balance} 
                loading={loading} 
                error={error} 
                initialViewMode={(!connected && showIntegrated) ? 'bot' : 'connected'}
              />

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

              {/* Privacy Shield (Phase 1) */}
              <PrivacyShield 
                activeWalletKey={activeWalletKey} 
                onUpdate={fetchWalletData} 
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              {/* Left Column - Trading */}
              <div className="space-y-6">
                {/* Manual mode exit */}
                {!connected && showIntegrated && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between">
                     <div className="flex items-center gap-2 text-emerald-400 text-sm">
                        <Bot className="w-4 h-4" />
                        <span>Viewing Integrated Bot</span>
                     </div>
                     <button 
                       onClick={() => setShowIntegrated(false)}
                       className="text-xs text-gray-400 hover:text-white underline"
                     >
                       Switch to Phantom
                     </button>
                  </div>
                )}

                {/* Pending DCA Buys Notification */}
                {pendingBuys.length > 0 && (
                  <PendingDCABuys pendingBuys={pendingBuys} onUpdate={fetchWalletData} />
                )}

                {/* Pending Sells (Auto-Exit) Notification */}
                {pendingSells.length > 0 && (
                  <PendingSells pendingSells={pendingSells} onUpdate={fetchWalletData} />
                )}

                {/* Trading Strategies */}
                <div id="quick-snipe">
                  <QuickSnipe
                    strategies={strategies}
                    onSuccess={fetchWalletData}
                    selectedToken={selectedToken}
                    activeWalletKey={activeWalletKey}
                    isIntegrated={!connected && showIntegrated}
                  />
                </div>
              </div>

              {/* Right Column - Active Positions, Token Search & Watchlist */}
              <div className="lg:col-span-2 space-y-6">
                {/* Active Positions */}
                <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">Active Positions</h3>
                      {/* WebSocket Connection Status */}
                      {wsConnected ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-900/30 rounded-full">
                          <Wifi className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-green-400">Live</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded-full">
                          <WifiOff className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">Offline</span>
                          <button
                            onClick={wsReconnect}
                            className="ml-1 text-xs text-emerald-500 hover:text-emerald-400"
                          >
                            Reconnect
                          </button>
                        </div>
                      )}
                    </div>
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
                          dcaOrders={dcaOrders}
                          isIntegrated={!connected && showIntegrated}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* DCA Orders */}
                <DCAOrdersList orders={dcaOrders} onUpdate={fetchWalletData} />

                {/* Token Search */}
                <TokenSearch onSelectToken={handleSelectToken} activeWalletKey={activeWalletKey} />

                {/* Watchlist */}
                <Watchlist onSelectToken={handleSelectToken} activeWalletKey={activeWalletKey} />

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
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-gray-800 bg-black/20 backdrop-blur-md mt-12 z-10">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-gray-400">
            Canopi - Algorithmic trading, elevated - A Monetoshi project
          </p>
        </div>
      </footer>

      {/* Drawer Navigation */}
      <Drawer>
        <div className={isElectron ? 'pt-8' : ''}>
          <DrawerItem
            icon={<HomeIcon />}
            label="Dashboard"
            onClick={() => setDrawerView('dashboard')}
            active={drawerView === 'dashboard'}
          />
          <DrawerItem
            icon={<Receipt />}
            label="Transaction History"
            onClick={() => setDrawerView('history')}
            active={drawerView === 'history'}
          />
        </div>

        {/* Drawer Content */}
        <div className="mt-4 border-t border-gray-700">
          {drawerView === 'history' && activeWalletKey && (
            <TransactionHistory activeWalletKey={activeWalletKey} />
          )}
        </div>

        {/* Settings Footer */}
        {activeWalletKey && (
          <TelegramSetup activeWalletKey={activeWalletKey} />
        )}
      </Drawer>
    </div>
  );
}
