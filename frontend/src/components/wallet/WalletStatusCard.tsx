'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet, RefreshCw, Bot, Smartphone, LogOut, Plus } from 'lucide-react';
import type { WalletBalance, BotStatus } from '@/types';
import { getBotStatus } from '@/lib/api';
import CreateWalletModal from './CreateWalletModal';

interface WalletStatusCardProps {
  balance: WalletBalance | null;
  loading: boolean;
  error: string | null;
  initialViewMode?: ViewMode;
}

type ViewMode = 'connected' | 'bot';

export default function WalletStatusCard({ balance, loading, error, initialViewMode = 'connected' }: WalletStatusCardProps) {
  const { disconnect } = useWallet();
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchBotStatus = async () => {
    setBotLoading(true);
    try {
      const status = await getBotStatus();
      setBotStatus(status);
    } catch (e) {
      console.error('Failed to fetch bot status');
    } finally {
      setBotLoading(false);
    }
  };

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const handleWalletCreated = () => {
    setShowCreateModal(false);
    fetchBotStatus(); // Refresh status immediately
  };

  return (
    <>
      {showCreateModal && (
        <CreateWalletModal 
          onCreated={handleWalletCreated} 
          onCancel={() => setShowCreateModal(false)} 
        />
      )}
      <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800">
      
      {/* Header with Toggle */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
           {viewMode === 'connected' ? (
             <Wallet className="w-5 h-5 text-purple-400" />
           ) : (
             <Bot className="w-5 h-5 text-emerald-400" />
           )}
           <h3 className="text-lg font-semibold text-white">
             {viewMode === 'connected' ? 'Connected Wallet' : 'Bot Wallet'}
           </h3>
        </div>
        
        <div className="flex bg-black/50 rounded-lg p-1 border border-gray-700">
           <button
             onClick={() => setViewMode('connected')}
             className={`p-1.5 rounded-md transition-all ${viewMode === 'connected' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
             title="Show Connected Wallet"
           >
             <Smartphone className="w-4 h-4" />
           </button>
           <button
             onClick={() => setViewMode('bot')}
             className={`p-1.5 rounded-md transition-all ${viewMode === 'bot' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
             title="Show Bot Wallet"
           >
             <Bot className="w-4 h-4" />
           </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[120px]">
        {viewMode === 'connected' ? (
           // CONNECTED WALLET VIEW
           <>
              {error ? (
                <div className="text-red-400 text-sm">{error}</div>
              ) : balance ? (
                <div className="space-y-3 animate-fadeIn">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-400">Address</p>
                      <p className="text-sm font-mono text-white">
                        {balance.publicKey.slice(0, 8)}...{balance.publicKey.slice(-8)}
                      </p>
                    </div>
                    <button
                      onClick={() => disconnect()}
                      className="p-1.5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-lg transition-all group"
                      title="Disconnect Wallet"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">SOL Balance</p>
                    <p className="text-2xl font-bold text-white">{balance.sol.toFixed(4)}</p>
                    <p className="text-sm text-gray-400">${balance.solUsd.toFixed(2)} USD</p>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 text-sm flex items-center gap-2">
                   <RefreshCw className="w-3 h-3 animate-spin" />
                   Loading wallet data...
                </div>
              )}
           </>
        ) : (
           // BOT WALLET VIEW
           <>
              {botLoading && !botStatus ? (
                 <div className="text-gray-400 text-sm flex items-center gap-2">
                   <RefreshCw className="w-3 h-3 animate-spin" />
                   Loading bot status...
                </div>
              ) : botStatus && botStatus.configured ? (
                <div className="space-y-3 animate-fadeIn">
                  <div>
                    <p className="text-sm text-gray-400 flex items-center gap-2">
                      Bot Address
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">ACTIVE</span>
                    </p>
                    <p className="text-sm font-mono text-white">
                      {botStatus.publicKey?.slice(0, 8)}...{botStatus.publicKey?.slice(-8)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Bot Balance</p>
                    <p className="text-2xl font-bold text-emerald-400">{botStatus.balance.toFixed(4)} SOL</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 animate-fadeIn">
                   <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm">
                      ⚠️ No Bot Wallet Configured
                   </div>
                   <button 
                     onClick={() => setShowCreateModal(true)}
                     className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                   >
                     <Plus className="w-4 h-4" />
                     Create Trading Wallet
                   </button>
                </div>
              )}
           </>
        )}
      </div>
    </div>
    </>
  );
}
