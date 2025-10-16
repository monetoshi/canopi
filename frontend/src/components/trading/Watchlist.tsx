'use client';

import { useState, useEffect } from 'react';
import { Star, ExternalLink, TrendingUp, TrendingDown, Trash2, RefreshCw } from 'lucide-react';

interface WatchlistToken {
  mint: string;
  symbol: string;
  name: string;
  addedAt: number;
  currentPrice?: number;
  priceChange24h?: number;
  liquidity?: number;
}

interface WatchlistProps {
  onSelectToken: (mint: string, symbol: string) => void;
}

export default function Watchlist({ onSelectToken }: WatchlistProps) {
  const [watchlist, setWatchlist] = useState<WatchlistToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load watchlist from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('solana-watchlist');
    console.log('[Watchlist] Loading from localStorage:', saved ? `${JSON.parse(saved).length} tokens` : 'empty');
    loadWatchlist();

    // Listen for watchlist updates from other components
    const handleWatchlistUpdate = () => {
      console.log('[Watchlist] Received watchlist-updated event');
      loadWatchlist();
    };

    window.addEventListener('watchlist-updated', handleWatchlistUpdate);
    return () => window.removeEventListener('watchlist-updated', handleWatchlistUpdate);
  }, []);

  const loadWatchlist = () => {
    try {
      const saved = localStorage.getItem('solana-watchlist');
      console.log('[Watchlist] loadWatchlist called, raw data:', saved);
      if (saved) {
        const tokens = JSON.parse(saved) as WatchlistToken[];
        console.log('[Watchlist] Parsed tokens:', tokens.length, 'items');
        setWatchlist(tokens);
      } else {
        console.log('[Watchlist] No data in localStorage, setting empty array');
        setWatchlist([]);
      }
    } catch (error) {
      console.error('[Watchlist] Failed to load watchlist:', error);
    }
  };

  const saveWatchlist = (tokens: WatchlistToken[]) => {
    try {
      console.log('[Watchlist] saveWatchlist called with', tokens.length, 'tokens');
      localStorage.setItem('solana-watchlist', JSON.stringify(tokens));
      setWatchlist(tokens);
      console.log('[Watchlist] Successfully saved to localStorage');
    } catch (error) {
      console.error('[Watchlist] Failed to save watchlist:', error);
    }
  };

  const removeFromWatchlist = (mint: string) => {
    const updated = watchlist.filter(token => token.mint !== mint);
    saveWatchlist(updated);
    // Notify other components
    window.dispatchEvent(new Event('watchlist-updated'));
  };

  const refreshPrices = async () => {
    setLoading(true);
    try {
      // Fetch updated prices for all watchlist tokens
      const updatedTokens = await Promise.all(
        watchlist.map(async (token) => {
          try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.mint}`);
            if (response.ok) {
              const data = await response.json();
              const solanaPairs = data.pairs?.filter((p: any) => p.chainId === 'solana');

              if (solanaPairs && solanaPairs.length > 0) {
                // Get pair with highest liquidity
                const bestPair = solanaPairs.sort((a: any, b: any) =>
                  (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
                )[0];

                return {
                  ...token,
                  currentPrice: parseFloat(bestPair.priceUsd),
                  priceChange24h: bestPair.priceChange?.h24 || 0,
                  liquidity: bestPair.liquidity?.usd || 0
                };
              }
            }
          } catch (error) {
            console.error(`Failed to fetch price for ${token.symbol}:`, error);
          }
          return token;
        })
      );

      saveWatchlist(updatedTokens);
    } catch (error) {
      console.error('Failed to refresh prices:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  // Prevent hydration errors by not rendering until mounted
  if (!mounted) {
    return (
      <div className="bg-black/40 backdrop-blur-md rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <h3 className="text-base font-semibold text-white">Watchlist</h3>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-gray-400 text-sm">Loading watchlist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <h3 className="text-base font-semibold text-white">Watchlist</h3>
          <span className="text-xs text-gray-400">({watchlist.length})</span>
        </div>
        <button
          onClick={refreshPrices}
          disabled={loading || watchlist.length === 0}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {watchlist.length === 0 ? (
        <div className="text-center py-8">
          <Star className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No tokens in watchlist</p>
          <p className="text-xs text-gray-500 mt-1">
            Click the star icon on any token to add it
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {watchlist.map((token) => (
            <div
              key={token.mint}
              className="bg-gray-900/50 rounded-lg p-2.5 border border-gray-800 hover:border-purple-500/50 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-white font-semibold text-sm">{token.symbol}</h4>
                    <span className="text-xs text-gray-400">{token.name}</span>
                    <a
                      href={`https://dexscreener.com/solana/${token.mint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs font-mono text-gray-500 mt-0.5">
                    {token.mint.slice(0, 6)}...{token.mint.slice(-4)}
                  </p>
                </div>

                <div className="text-right">
                  {token.currentPrice !== undefined ? (
                    <>
                      <p className="text-white font-semibold text-sm">
                        ${token.currentPrice < 0.01
                          ? token.currentPrice.toFixed(8)
                          : token.currentPrice.toFixed(4)}
                      </p>
                      {token.priceChange24h !== undefined && (
                        <p className={`text-xs font-semibold flex items-center gap-1 justify-end ${
                          token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {token.priceChange24h >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500 text-xs">Price unavailable</p>
                  )}
                </div>
              </div>

              {token.liquidity !== undefined && (
                <div className="mb-2 text-xs text-gray-400">
                  Liquidity: <span className="text-white font-semibold">{formatNumber(token.liquidity)}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                <span className="text-xs text-gray-500">
                  {new Date(token.addedAt).toLocaleDateString()}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onSelectToken(token.mint, token.symbol)}
                    className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    Trade
                  </button>
                  <button
                    onClick={() => removeFromWatchlist(token.mint)}
                    className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
