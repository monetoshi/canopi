/**
 * Solana Trading Bot - Watchlist Manager
 * Manages user watchlists for tracking tokens
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDataDir } from '../utils/paths.util';

const WATCHLIST_FILE = path.join(getDataDir(), 'watchlist.json');

export interface WatchlistItem {
  mint: string;
  symbol: string;
  addedAt: number;
}

interface WalletWatchlist {
  [walletPublicKey: string]: WatchlistItem[];
}

export class WatchlistManager {
  private watchlists: WalletWatchlist = {};

  constructor() {
    this.loadWatchlist();
  }

  private loadWatchlist() {
    try {
      const dataDir = path.dirname(WATCHLIST_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(WATCHLIST_FILE)) {
        const data = fs.readFileSync(WATCHLIST_FILE, 'utf-8');
        this.watchlists = JSON.parse(data);
        console.log(`[WatchlistManager] Loaded watchlists for ${Object.keys(this.watchlists).length} wallets`);
      }
    } catch (error) {
      console.error('[WatchlistManager] Error loading watchlist:', error);
    }
  }

  private saveWatchlist() {
    try {
      fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(this.watchlists, null, 2));
    } catch (error) {
      console.error('[WatchlistManager] Error saving watchlist:', error);
    }
  }

  getWatchlist(walletPublicKey: string): WatchlistItem[] {
    return this.watchlists[walletPublicKey] || [];
  }

  addToWatchlist(walletPublicKey: string, item: { mint: string; symbol: string }): WatchlistItem[] {
    if (!this.watchlists[walletPublicKey]) {
      this.watchlists[walletPublicKey] = [];
    }

    // Check if already exists
    if (!this.watchlists[walletPublicKey].some(i => i.mint === item.mint)) {
      this.watchlists[walletPublicKey].push({
        ...item,
        addedAt: Date.now()
      });
      this.saveWatchlist();
    }

    return this.watchlists[walletPublicKey];
  }

  removeFromWatchlist(walletPublicKey: string, mint: string): WatchlistItem[] {
    if (this.watchlists[walletPublicKey]) {
      this.watchlists[walletPublicKey] = this.watchlists[walletPublicKey].filter(i => i.mint !== mint);
      this.saveWatchlist();
    }
    return this.watchlists[walletPublicKey] || [];
  }
}

export const watchlistManager = new WatchlistManager();
