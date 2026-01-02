'use client';

/**
 * Wallet Provider
 * Provides Phantom wallet integration to the app
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import UnlockWalletModal from './UnlockWalletModal';
import { getBotStatus } from '@/lib/api';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

export default function WalletProvider({ children }: { children: React.ReactNode }) {
  // Use mainnet by default
  const network = WalletAdapterNetwork.Mainnet;
  const [isLocked, setIsLocked] = useState(false);
  const [checkTrigger, setCheckTrigger] = useState(0);

  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_RPC_URL) {
      return process.env.NEXT_PUBLIC_RPC_URL;
    }
    return clusterApiUrl(network);
  }, [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    []
  );

  const checkStatus = useCallback(async () => {
    try {
      const status = await getBotStatus();
      setIsLocked(!!status.isLocked);
    } catch (e) {
      console.error('Failed to check wallet status:', e);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    // Poll every 5 seconds just in case, but rely mostly on initial load
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus, checkTrigger]);

  const handleUnlock = () => {
    setIsLocked(false);
    setCheckTrigger(prev => prev + 1); // Force re-check
  };

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {isLocked && <UnlockWalletModal onUnlock={handleUnlock} />}
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
