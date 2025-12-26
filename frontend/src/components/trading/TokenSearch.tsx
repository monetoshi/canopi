'use client';

import { useState, useEffect } from 'react';
import { Search, TrendingUp, Droplets, DollarSign, ExternalLink, Copy, Check, AlertTriangle, Shield, Lock, Star, Users, X } from 'lucide-react';
import { addToWatchlist, removeFromWatchlist, getWatchlist } from '@/lib/api';

interface TokenResult {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  pairCreatedAt?: number;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    symbol: string;
  };
  priceUsd: string;
  volume: {
    h24: number;
  };
  priceChange: {
    h24: number;
  };
  liquidity: {
    usd: number;
    base?: number;
    quote?: number;
  };
  fdv: number;
  marketCap: number;
  boosts?: any;
  info?: {
    imageUrl?: string;
    header?: string;
    openGraph?: string;
    websites?: any[];
    socials?: any[];
  };
  locks?: {
    locked: boolean;
    lockDuration?: number;
    unlockDate?: number;
  };
  holderCount?: number;
}

interface TokenSearchProps {
  onSelectToken: (mint: string, symbol: string) => void;
  activeWalletKey?: string | null;
}

export default function TokenSearch({ onSelectToken, activeWalletKey }: TokenSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TokenResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [watchlistMints, setWatchlistMints] = useState<Set<string>>(new Set());
  const [loadingHolders, setLoadingHolders] = useState(false);
  const [holderCache, setHolderCache] = useState<Map<string, number>>(new Map());
  const [mounted, setMounted] = useState(false);
  const [sortBy, setSortBy] = useState<'liquidity' | 'volume' | 'marketCap' | 'safety'>('liquidity');
  const [autoSearch, setAutoSearch] = useState(false);

  // Load watchlist mints from API or localStorage
  useEffect(() => {
    setMounted(true);
    if (activeWalletKey) {
      getWatchlist(activeWalletKey).then(items => {
        setWatchlistMints(new Set(items.map(i => i.mint)));
      }).catch(console.error);
    } else {
      try {
        const saved = localStorage.getItem('solana-watchlist');
        if (saved) {
          const tokens = JSON.parse(saved);
          const mints = new Set<string>(tokens.map((t: any) => t.mint));
          setWatchlistMints(mints);
        }
      } catch (error) {
        console.error('Failed to load watchlist:', error);
      }
    }
  }, [activeWalletKey]);

  // Debounced auto-search when query changes
  useEffect(() => {
    if (!autoSearch || !query.trim()) {
      return;
    }

    const debounceTimer = setTimeout(() => {
      searchTokens();
    }, 500); // 500ms debounce

    return () => clearTimeout(debounceTimer);
  }, [query, autoSearch]);

  // Re-sort results when sort criteria changes
  useEffect(() => {
    if (results.length > 0) {
      setResults(sortResults(results));
    }
  }, [sortBy]);

  // Fetch holder counts from Solscan API
  const fetchHolderCount = async (tokenAddress: string) => {
    if (holderCache.has(tokenAddress)) {
      return holderCache.get(tokenAddress)!;
    }

    try {
      const url = `https://public-api.solscan.io/token/holders?tokenAddress=${tokenAddress}&offset=0&limit=1`;
      const response = await fetch(url);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const holderCount = data.total || 0;

      setHolderCache(prev => new Map(prev).set(tokenAddress, holderCount));
      return holderCount;
    } catch (error) {
      return null;
    }
  };

  const enrichWithHolderCounts = async (tokens: TokenResult[]) => {
    setLoadingHolders(true);
    const enrichedTokens = [...tokens];

    for (let i = 0; i < enrichedTokens.length; i++) {
      const token = enrichedTokens[i];
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      const holderCount = await fetchHolderCount(token.baseToken.address);
      if (holderCount !== null) {
        enrichedTokens[i] = { ...token, holderCount };
      }
    }

    setLoadingHolders(false);
    return enrichedTokens;
  };

  const searchTokens = async () => {
    if (!query.trim()) {
      setError('Enter a token name or address');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error('Failed to search tokens');
      }

      const data = await response.json();
      const allPairs = data.pairs || [];
      const solanaPairs = filterAndSortTokens(allPairs);

      if (solanaPairs.length === 0) {
        setError('No Solana tokens found matching your criteria');
      } else {
        setResults(solanaPairs);
        enrichWithHolderCounts(solanaPairs).then(enriched => {
          setResults(enriched);
        });
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to search tokens');
    } finally {
      setLoading(false);
    }
  };

  const getLiquidityLockStatus = (token: TokenResult): { isLocked: boolean; lockInfo: string } => {
    if (token.locks?.locked === true) {
      if (token.locks.unlockDate) {
        const unlockDate = new Date(token.locks.unlockDate);
        const now = new Date();
        if (unlockDate > now) {
          const daysUntilUnlock = Math.ceil((unlockDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return {
            isLocked: true,
            lockInfo: `Liquidity locked until ${unlockDate.toLocaleDateString()} (${daysUntilUnlock} days)`
          };
        }
      } else if (token.locks.lockDuration) {
        return {
          isLocked: true,
          lockInfo: `Liquidity locked for ${token.locks.lockDuration} days`
        };
      } else {
        return { isLocked: true, lockInfo: 'Liquidity is locked' };
      }
    }
    return { isLocked: false, lockInfo: 'Lock status unknown' };
  };

  const getTokenSafety = (token: TokenResult): { safetyLevel: 'high' | 'medium' | 'low' | 'none'; reason: string; isLocked: boolean; lockInfo: string } => {
    const liq = token.liquidity?.usd || 0;
    const volume = token.volume?.h24 || 0;
    const mcap = token.marketCap || 0;
    const lockStatus = getLiquidityLockStatus(token);

    const hasProfile = token.info !== undefined;
    const hasBoosts = token.boosts !== undefined;
    const liquidityToMcapRatio = mcap > 0 ? (liq / mcap) : 0;

    if (lockStatus.isLocked && liq >= 25000) {
      return {
        safetyLevel: 'high',
        reason: `VERIFIED: ${lockStatus.lockInfo}`,
        isLocked: true,
        lockInfo: lockStatus.lockInfo
      };
    }

    if (liq >= 100000 && mcap >= 500000 && hasProfile) {
      return {
        safetyLevel: 'high',
        reason: 'High liquidity ($100K+) + Large market cap + Verified',
        isLocked: lockStatus.isLocked,
        lockInfo: lockStatus.lockInfo
      };
    } else if (liq >= 50000 && volume >= 50000 && liquidityToMcapRatio >= 0.1) {
      return {
        safetyLevel: 'high',
        reason: 'Strong liquidity/volume metrics - difficult to rug',
        isLocked: lockStatus.isLocked,
        lockInfo: lockStatus.lockInfo
      };
    } else if (hasBoosts && liq >= 30000) {
      return {
        safetyLevel: 'medium',
        reason: 'Promoted token with decent liquidity ($30K+)',
        isLocked: lockStatus.isLocked,
        lockInfo: lockStatus.lockInfo
      };
    } else if (liq >= 25000 && mcap >= 100000) {
      return {
        safetyLevel: 'medium',
        reason: 'Fair liquidity ($25K+) and market cap',
        isLocked: lockStatus.isLocked,
        lockInfo: lockStatus.lockInfo
      };
    } else if (liq >= 10000 && volume >= 5000) {
      return {
        safetyLevel: 'low',
        reason: 'Minimal liquidity - higher rug risk',
        isLocked: lockStatus.isLocked,
        lockInfo: lockStatus.lockInfo
      };
    } else {
      return {
        safetyLevel: 'none',
        reason: 'Insufficient safety metrics - high risk',
        isLocked: lockStatus.isLocked,
        lockInfo: lockStatus.lockInfo
      };
    }
  };

  const sortResults = (tokens: TokenResult[]): TokenResult[] => {
    const sorted = [...tokens];

    switch (sortBy) {
      case 'liquidity':
        sorted.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        break;
      case 'volume':
        sorted.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
        break;
      case 'marketCap':
        sorted.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
        break;
      case 'safety':
        // Sort by safety level (high > medium > low > none), then by liquidity
        sorted.sort((a, b) => {
          const safetyA = getTokenSafety(a);
          const safetyB = getTokenSafety(b);
          const safetyOrder = { high: 3, medium: 2, low: 1, none: 0 };
          const safetyDiff = safetyOrder[safetyB.safetyLevel] - safetyOrder[safetyA.safetyLevel];
          if (safetyDiff !== 0) return safetyDiff;
          return (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0);
        });
        break;
    }

    return sorted;
  };

  const filterAndSortTokens = (pairs: TokenResult[]): TokenResult[] => {
    // Filter for Solana tokens only with some volume
    let filtered = pairs.filter((pair: TokenResult) => {
      if (pair.chainId !== 'solana') {
        return false;
      }
      const hasVolume = pair.volume?.h24 > 0;
      return hasVolume;
    });

    // Remove duplicates (same token, keep highest liquidity)
    const uniqueTokens = new Map<string, TokenResult>();
    filtered.forEach(pair => {
      const existing = uniqueTokens.get(pair.baseToken.address);
      if (!existing || pair.liquidity.usd > existing.liquidity.usd) {
        uniqueTokens.set(pair.baseToken.address, pair);
      }
    });

    filtered = Array.from(uniqueTokens.values());
    filtered.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

    return filtered.slice(0, 20);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchTokens();
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setError(null);
  };

  const copyToClipboard = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleWatchlist = async (token: TokenResult) => {
    // API Mode (Authenticated)
    if (activeWalletKey) {
      const isSaved = watchlistMints.has(token.baseToken.address);
      
      try {
        if (isSaved) {
          await removeFromWatchlist(activeWalletKey, token.baseToken.address);
          setWatchlistMints(prev => {
            const next = new Set(prev);
            next.delete(token.baseToken.address);
            return next;
          });
        } else {
          await addToWatchlist(activeWalletKey, token.baseToken.address, token.baseToken.symbol);
          setWatchlistMints(prev => new Set([...prev, token.baseToken.address]));
        }
        
        console.log('[TokenSearch] Dispatching watchlist-updated event (API)');
        window.dispatchEvent(new Event('watchlist-updated'));
      } catch (error) {
        console.error('[TokenSearch] Failed to update watchlist via API:', error);
      }
      return;
    }

    // LocalStorage Mode (Unauthenticated Fallback)
    try {
      const saved = localStorage.getItem('solana-watchlist');
      let watchlist = saved ? JSON.parse(saved) : [];
      console.log('[TokenSearch] Current watchlist before toggle:', watchlist.length, 'items');

      const isInWatchlist = watchlist.some((t: any) => t.mint === token.baseToken.address);

      if (isInWatchlist) {
        console.log('[TokenSearch] Removing', token.baseToken.symbol, 'from watchlist');
        watchlist = watchlist.filter((t: any) => t.mint !== token.baseToken.address);
        setWatchlistMints(prev => {
          const next = new Set(prev);
          next.delete(token.baseToken.address);
          return next;
        });
      } else {
        console.log('[TokenSearch] Adding', token.baseToken.symbol, 'to watchlist');
        watchlist.push({
          mint: token.baseToken.address,
          symbol: token.baseToken.symbol,
          name: token.baseToken.name,
          addedAt: Date.now(),
          currentPrice: token.priceUsd ? parseFloat(token.priceUsd) : undefined,
          priceChange24h: token.priceChange?.h24 || 0,
          liquidity: token.liquidity?.usd || 0
        });
        setWatchlistMints(prev => new Set([...prev, token.baseToken.address]));
      }

      console.log('[TokenSearch] Saving watchlist with', watchlist.length, 'items');
      localStorage.setItem('solana-watchlist', JSON.stringify(watchlist));
      console.log('[TokenSearch] Dispatching watchlist-updated event');
      window.dispatchEvent(new Event('watchlist-updated'));
    } catch (error) {
      console.error('[TokenSearch] Failed to update watchlist:', error);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const getRiskLevel = (token: TokenResult): { level: string; color: string; reason: string } => {
    const liq = token.liquidity?.usd || 0;
    const mcap = token.marketCap || 0;
    const holders = token.holderCount || 0;

    const hasGoodHolderDistribution = holders >= 100;
    const hasExcellentHolderDistribution = holders >= 1000;

    if (liq < 5000) {
      return { level: 'VERY HIGH', color: 'text-red-500', reason: 'Very low liquidity - high rug risk' };
    } else if (liq < 20000) {
      return { level: 'HIGH', color: 'text-orange-500', reason: 'Low liquidity - proceed with caution' };
    } else if (liq < 50000) {
      return { level: 'MEDIUM', color: 'text-yellow-500', reason: 'Moderate liquidity' };
    } else if (liq >= 100000 && mcap > 1000000) {
      if (hasExcellentHolderDistribution) {
        return { level: 'LOW', color: 'text-green-500', reason: 'High liquidity, market cap, and 1000+ holders' };
      }
      return { level: 'LOW', color: 'text-green-500', reason: 'Good liquidity and market cap' };
    } else if (liq >= 50000 && hasGoodHolderDistribution) {
      return { level: 'MEDIUM', color: 'text-yellow-500', reason: 'Fair liquidity with 100+ holders' };
    } else {
      return { level: 'MEDIUM', color: 'text-yellow-500', reason: 'Fair liquidity' };
    }
  };

  const getTokenAge = (createdAt?: number): string => {
    if (!createdAt) return 'Unknown';
    const ageMs = Date.now() - createdAt;
    const hours = Math.floor(ageMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just launched';
  };

  if (!mounted) {
    return (
      <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Search Tokens</h3>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Determine if we should show the collapsed view
  const showCollapsedView = !loading && results.length === 0 && !error;

  return (
    <div className={`bg-black/40 backdrop-blur-md rounded-xl border border-gray-800 ${showCollapsedView ? 'p-4' : 'p-6'}`}>
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Search Tokens</h3>
      </div>

      {/* Search Input */}
      <div className={`flex gap-2 ${showCollapsedView ? '' : 'mb-3'}`}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search Solana token name or address..."
          className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={searchTokens}
          disabled={loading}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
        {(query || results.length > 0 || error) && (
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-1"
            title="Clear search"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Search Options */}
      {!showCollapsedView && (
        <div className="flex gap-3 mb-4 items-center">
          {/* Auto-search toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSearch}
              onChange={(e) => setAutoSearch(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900"
            />
            <span>Auto-search as you type</span>
          </label>

          {/* Sort dropdown */}
          {results.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'liquidity' | 'volume' | 'marketCap' | 'safety')}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="liquidity">Liquidity (Highest)</option>
                <option value="volume">Volume 24h (Highest)</option>
                <option value="marketCap">Market Cap (Highest)</option>
                <option value="safety">Safety Score (Best)</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Only show content below if not in collapsed view */}
      {!showCollapsedView && (
        <>
          {/* Results count */}
          {results.length > 0 && (
            <div className="mb-4">
              <div className="p-2 bg-purple-900/20 rounded-lg border border-purple-700/30 text-xs">
                <span className="text-purple-300">
                  Showing {results.length} Solana tokens
                  {loadingHolders && ' • Fetching holder counts...'}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-gray-400">Searching tokens...</p>
            </div>
          )}

          {/* Results */}
          {!loading && (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {results.map((token) => {
                const risk = getRiskLevel(token);
                const safety = getTokenSafety(token);
                return (
                  <div
                    key={token.pairAddress}
                    className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 hover:border-purple-500/50 transition-all"
                  >
                    {/* Token Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-white font-semibold">{token.baseToken.symbol}</h4>
                          <span className="text-xs text-gray-400">{token.baseToken.name}</span>
                          {safety.isLocked && (
                            <span className="flex items-center gap-1 text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded font-semibold">
                              <Lock className="w-3 h-3" />
                              LOCKED ✓
                            </span>
                          )}
                          {token.pairCreatedAt && (
                            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                              {getTokenAge(token.pairCreatedAt)}
                            </span>
                          )}
                          <a
                            href={token.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-gray-500">
                            {token.baseToken.address.slice(0, 6)}...{token.baseToken.address.slice(-4)}
                          </code>
                          <button
                            onClick={() => copyToClipboard(token.baseToken.address)}
                            className="text-gray-500 hover:text-purple-400 transition-colors"
                          >
                            {copiedAddress === token.baseToken.address ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">
                          ${parseFloat(token.priceUsd).toFixed(parseFloat(token.priceUsd) < 0.01 ? 8 : 4)}
                        </p>
                        {token.priceChange?.h24 !== undefined ? (
                          <p className={`text-sm font-semibold ${token.priceChange.h24 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {token.priceChange.h24 >= 0 ? '+' : ''}{token.priceChange.h24.toFixed(2)}%
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500">N/A</p>
                        )}
                      </div>
                    </div>

                    {/* Safety & Risk Indicators */}
                    <div className="mb-3 space-y-2">
                      {safety.isLocked && (
                        <div className="p-2 bg-green-900/30 rounded border-l-4 border-green-500">
                          <div className="flex items-center gap-2 text-xs">
                            <Lock className="w-4 h-4 text-green-400" />
                            <span className="font-bold text-green-400">LIQUIDITY LOCKED:</span>
                            <span className="text-white font-semibold">{safety.lockInfo}</span>
                          </div>
                        </div>
                      )}

                      {safety.safetyLevel === 'high' && (
                        <div className="p-2 bg-green-900/20 rounded border-l-2 border-green-500">
                          <div className="flex items-center gap-2 text-xs">
                            <Shield className="w-3 h-3 text-green-400" />
                            <span className="font-semibold text-green-400">High Safety:</span>
                            <span className="text-gray-300">{safety.reason}</span>
                          </div>
                        </div>
                      )}

                      <div className={`p-2 bg-gray-800/50 rounded border-l-2 ${
                        risk.level === 'LOW' ? 'border-green-500' :
                        risk.level === 'MEDIUM' ? 'border-yellow-500' :
                        risk.level === 'HIGH' ? 'border-orange-500' :
                        'border-red-500'
                      }`}>
                        <div className="flex items-center gap-2 text-xs">
                          <AlertTriangle className={`w-3 h-3 ${risk.color}`} />
                          <span className={`font-semibold ${risk.color}`}>Risk: {risk.level}</span>
                          <span className="text-gray-400">- {risk.reason}</span>
                        </div>
                      </div>
                    </div>

                    {/* Token Metrics */}
                    <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-blue-400" />
                        <div>
                          <p className="text-gray-500">Liquidity</p>
                          <p className="text-white font-semibold text-[10px]">
                            {token.liquidity?.usd ? formatNumber(token.liquidity.usd) : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-400" />
                        <div>
                          <p className="text-gray-500">Volume 24h</p>
                          <p className="text-white font-semibold text-[10px]">
                            {token.volume?.h24 ? formatNumber(token.volume.h24) : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-yellow-400" />
                        <div>
                          <p className="text-gray-500">MCap</p>
                          <p className="text-white font-semibold text-[10px]">
                            {token.marketCap ? formatNumber(token.marketCap) : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-purple-400" />
                        <div>
                          <p className="text-gray-500">Holders</p>
                          <p className="text-white font-semibold text-[10px]">
                            {token.holderCount ? token.holderCount.toLocaleString() : (loadingHolders ? '...' : 'N/A')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* DEX Info */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                      <span className="text-xs text-gray-500">
                        {token.dexId.toUpperCase()} • {token.quoteToken.symbol} Pair
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleWatchlist(token)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                            watchlistMints.has(token.baseToken.address)
                              ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          <Star className={`w-3 h-3 ${watchlistMints.has(token.baseToken.address) ? 'fill-yellow-400' : ''}`} />
                          {watchlistMints.has(token.baseToken.address) ? 'Saved' : 'Save'}
                        </button>
                        <button
                          onClick={() => onSelectToken(token.baseToken.address, token.baseToken.symbol)}
                          className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-semibold rounded-lg transition-all"
                        >
                          Trade {token.baseToken.symbol}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
