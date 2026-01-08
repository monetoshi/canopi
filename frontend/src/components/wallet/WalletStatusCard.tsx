'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet, RefreshCw, Bot, Smartphone, LogOut, Plus, Lock, Key, ArrowUpRight, Download, Copy, Check } from 'lucide-react';
import type { WalletBalance, BotStatus } from '@/types';
import { getBotStatus, api } from '@/lib/api';
import CreateWalletModal from './CreateWalletModal';
import UnlockWalletModal from './UnlockWalletModal';
import ExportWalletModal from './ExportWalletModal';
import WithdrawModal from './WithdrawModal';
import RecoveryModal from './RecoveryModal';

interface WalletStatusCardProps {
  balance: WalletBalance | null;
  loading: boolean;
  error: string | null;
  initialViewMode?: ViewMode;
  botStatus: BotStatus | null;
  onStatusChange: () => void;
}

type ViewMode = 'connected' | 'bot';

export default function WalletStatusCard({ 
  balance, 
  loading, 
  error, 
  initialViewMode = 'connected',
  botStatus,
  onStatusChange
}: WalletStatusCardProps) {
  const { disconnect } = useWallet();
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Check for locked status when botStatus updates
  useEffect(() => {
    if (botStatus?.isLocked) {
      setShowUnlockModal(true);
    }
  }, [botStatus?.isLocked]);

  const handleCopyAddress = (address: string) => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleWalletCreated = () => {
    setShowCreateModal(false);
    onStatusChange(); // Refresh parent
  };

  const handleUnlocked = () => {
    setShowUnlockModal(false);
    onStatusChange();
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure? This will DELETE your bot wallet file. Make sure you have exported your key first if it has funds!')) return;
    
    try {
      await api.delete('/api/wallet/reset');
      onStatusChange();
    } catch (e) {
      console.error('Failed to reset wallet');
    }
  };

  return (
    <>
      {showCreateModal && (
        <CreateWalletModal 
          onCreated={handleWalletCreated} 
          onCancel={() => setShowCreateModal(false)} 
        />
      )}
      {showUnlockModal && (
        <UnlockWalletModal 
          onUnlock={handleUnlocked} 
        />
      )}
      {showExportModal && (
        <ExportWalletModal 
          onClose={() => setShowExportModal(false)} 
        />
      )}
      {showWithdrawModal && botStatus && (
        <WithdrawModal 
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={onStatusChange}
          maxAmount={botStatus.balance}
        />
      )}
      {showRecoveryModal && (
        <RecoveryModal 
          onClose={() => setShowRecoveryModal(false)}
          onSuccess={onStatusChange}
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-mono text-white">
                          {balance.publicKey.slice(0, 8)}...{balance.publicKey.slice(-8)}
                        </p>
                        <button
                          onClick={() => handleCopyAddress(balance.publicKey)}
                          className="text-gray-500 hover:text-white transition-colors"
                          title="Copy Address"
                        >
                          {copiedAddress ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
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
              {botStatus && botStatus.isLocked ? (
                <div className="space-y-3 animate-fadeIn">
                   <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-200 text-sm flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Wallet Locked
                   </div>
                   <button 
                     onClick={() => setShowUnlockModal(true)}
                     className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                   >
                     <Key className="w-4 h-4" />
                     Unlock Wallet
                   </button>
                </div>
              ) : botStatus && botStatus.configured ? (
                <div className="space-y-3 animate-fadeIn">
                  <div>
                    <p className="text-sm text-gray-400 flex items-center gap-2">
                      Bot Address
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">ACTIVE</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono text-white">
                        {botStatus.publicKey?.slice(0, 8)}...{botStatus.publicKey?.slice(-8)}
                      </p>
                      <button
                        onClick={() => handleCopyAddress(botStatus.publicKey || '')}
                        className="text-gray-500 hover:text-white transition-colors"
                        title="Copy Address"
                      >
                        {copiedAddress ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Bot Balance</p>
                    <p className="text-2xl font-bold text-emerald-400">{botStatus.balance.toFixed(4)} SOL</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button 
                      onClick={() => setShowWithdrawModal(true)}
                      className="py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors border border-emerald-500/20"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Withdraw
                    </button>
                    <button 
                      onClick={() => setShowExportModal(true)}
                      className="py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export Key
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => setShowRecoveryModal(true)}
                    className="w-full mt-2 py-1 text-xs text-yellow-500/70 hover:text-yellow-400 hover:underline flex items-center justify-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Recover Stuck Funds
                  </button>
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
                   
                   {/* Reset Option for corrupted states */}
                   <button 
                     onClick={handleReset}
                     className="w-full py-1 text-xs text-red-400 hover:text-red-300 underline"
                   >
                     Reset / Delete Wallet
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
