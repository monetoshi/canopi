'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Zap, Bot } from 'lucide-react';
import type { StrategyConfig, ExitStrategy, DCAStrategyType } from '@/types';
import { prepareBuyTransaction, executeBuyTransaction, createDCAOrder, getCurrentPrice, executeBotTrade, createLimitOrder } from '@/lib/api';
import { VersionedTransaction } from '@solana/web3.js';

interface QuickSnipeProps {
  strategies: Record<ExitStrategy, StrategyConfig> | null;
  onSuccess: () => void;
  selectedToken?: { mint: string; symbol: string } | null;
  activeWalletKey?: string | null;
  isIntegrated?: boolean;
}

export default function QuickSnipe({ strategies, onSuccess, selectedToken, activeWalletKey, isIntegrated = false }: QuickSnipeProps) {
  const { signTransaction } = useWallet();
  const [tokenMint, setTokenMint] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [solAmount, setSolAmount] = useState('0.1');
  const [slippageBps, setSlippageBps] = useState(() => {
    // Load from localStorage or default to 200 BPS (2%)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('slippage_preference');
      return saved ? parseInt(saved) : 200;
    }
    return 200;
  });
  const [entryStrategy, setEntryStrategy] = useState('instant');
  const [strategy, setStrategy] = useState<ExitStrategy>('manual');
  const [isPrivate, setIsPrivate] = useState(false);
  const [buying, setBuying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Limit order specific fields
  const [targetPrice, setTargetPrice] = useState('');
  const [expiresIn, setExpiresIn] = useState('60'); // minutes

  // DCA specific fields
  const [dcaStrategy, setDcaStrategy] = useState<DCAStrategyType>('time-based');
  const [numberOfBuys, setNumberOfBuys] = useState('5');
  const [intervalMinutes, setIntervalMinutes] = useState('60');

  // Update token mint when selectedToken changes
  React.useEffect(() => {
    if (selectedToken) {
      setTokenMint(selectedToken.mint);
      setTokenSymbol(selectedToken.symbol);
    }
  }, [selectedToken]);

  // Save slippage preference to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('slippage_preference', slippageBps.toString());
    }
  }, [slippageBps]);

  const handleBuy = async () => {
    // Check for wallet connection (either Phantom or Integrated)
    if (!activeWalletKey) {
      setError('Wallet not connected');
      return;
    }
    
    // Check for signing capability if NOT integrated
    if (!isIntegrated && !signTransaction) {
      setError('Wallet not connected');
      return;
    }

    if (!tokenMint) {
      setError('Enter token mint address');
      return;
    }

    const amount = parseFloat(solAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Invalid SOL amount');
      return;
    }

    // Handle limit order
    if (entryStrategy === 'limit') {
      const price = parseFloat(targetPrice);
      if (isNaN(price) || price <= 0) {
        setError('Enter valid target price');
        return;
      }

      setBuying(true);
      setError(null);
      setSuccess(false);

      try {
        await createLimitOrder({
          walletPublicKey: activeWalletKey,
          tokenMint,
          tokenSymbol,
          targetPrice: price,
          solAmount: amount,
          exitStrategy: strategy,
          slippageBps: slippageBps,
          expiresIn: expiresIn ? parseInt(expiresIn) : undefined
        });

        setSuccess(true);
        setTokenMint('');
        setTargetPrice('');

        setTimeout(() => {
          onSuccess();
          setSuccess(false);
        }, 2000);
      } catch (err: any) {
        console.error('Error creating limit order:', err);
        setError(err.message || 'Failed to create limit order');
      } finally {
        setBuying(false);
      }
      return;
    }

    // Handle DCA order
    if (entryStrategy === 'dca') {
      const buys = parseInt(numberOfBuys);
      const interval = parseInt(intervalMinutes);

      if (isNaN(buys) || buys < 2) {
        setError('Number of buys must be at least 2');
        return;
      }

      if (isNaN(interval) || interval < 1) {
        setError('Interval must be at least 1 minute');
        return;
      }

      setBuying(true);
      setError(null);
      setSuccess(false);

      try {
        // Get current price for price-based DCA
        let referencePrice: number | undefined;
        if (dcaStrategy === 'price-based') {
          const price = await getCurrentPrice(tokenMint);
          if (price) {
            referencePrice = price;
          }
        }

        await createDCAOrder({
          walletPublicKey: activeWalletKey,
          tokenMint,
          tokenSymbol,
          totalSolAmount: amount,
          numberOfBuys: buys,
          intervalMinutes: interval,
          strategyType: dcaStrategy,
          exitStrategy: strategy,
          slippageBps: slippageBps,
          referencePrice,
          isPrivate
        });

        setSuccess(true);
        setTokenMint('');

        setTimeout(() => {
          onSuccess();
          setSuccess(false);
        }, 2000);
      } catch (err: any) {
        console.error('Error creating DCA order:', err);
        setError(err.message || 'Failed to create DCA order');
      } finally {
        setBuying(false);
      }
      return;
    }

    // Handle instant buy
    setBuying(true);
    setError(null);
    setSuccess(false);

    try {
      if (isIntegrated) {
         // --- INTEGRATED BOT WALLET FLOW ---
         await executeBotTrade({
            tokenMint,
            solAmount: amount,
            strategy,
            slippageBps,
            isPrivate
         });
      } else {
         // --- CONNECTED BROWSER WALLET FLOW ---
         if (!signTransaction) throw new Error("Wallet not connected"); // double check
         
         // Prepare buy transaction
         const data = await prepareBuyTransaction({
           walletPublicKey: activeWalletKey,
           tokenMint,
           solAmount: amount,
           slippageBps: slippageBps,
           strategy
         });
   
         // Deserialize transaction
         const txBuffer = Buffer.from(data.transaction, 'base64');
         const transaction = VersionedTransaction.deserialize(txBuffer);
   
         // Sign transaction
         const signedTx = await signTransaction(transaction);
         const signedTxBase64 = Buffer.from(signedTx.serialize()).toString('base64');
   
         // Execute buy
         await executeBuyTransaction({
           walletPublicKey: activeWalletKey,
           signedTransaction: signedTxBase64,
           tokenMint,
           solAmount: amount,
           strategy,
           expectedOutput: data.expectedOutput // Pass token amount from quote
         });
      }

      setSuccess(true);
      setTokenMint('');
      setSolAmount('0.1');

      // Refresh parent data
      setTimeout(() => {
        onSuccess();
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      console.error('Error buying:', err);
      setError(err.message || 'Failed to execute trade');
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-emerald-500" />
        <h3 className="text-lg font-semibold text-white">Trading Strategies</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Token Mint {tokenSymbol && <span className="text-emerald-500">({tokenSymbol})</span>}
          </label>
          <input
            type="text"
            value={tokenMint}
            onChange={(e) => {
              setTokenMint(e.target.value);
              setTokenSymbol('');
            }}
            placeholder="Enter token mint address or search above"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">SOL Amount</label>
          <input
            type="number"
            value={solAmount}
            onChange={(e) => setSolAmount(e.target.value)}
            step="0.1"
            min="0.01"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Slippage Tolerance</label>
          <select
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value))}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-600"
          >
            <option value={50}>0.5% (Low Risk - May Fail)</option>
            <option value={100}>1% (Recommended for Stable Tokens)</option>
            <option value={200}>2% (Default - Balanced)</option>
            <option value={300}>3% (Moderate Risk)</option>
            <option value={500}>5% (High Risk - Volatile Tokens)</option>
            <option value={1000}>10% (Extreme Risk - Meme Coins)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Max price impact: {((parseFloat(solAmount) * slippageBps) / 10000).toFixed(4)} SOL ({(slippageBps / 100).toFixed(1)}%)
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Entry Strategy</label>
          <select
            value={entryStrategy}
            onChange={(e) => setEntryStrategy(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-600"
          >
            <option value="instant">⚡ Instant - Buy full amount now</option>
            <option value="limit">📊 Limit Order - Buy at target price</option>
            <option value="dca">💵 DCA In - Split across multiple buys</option>
          </select>

          {entryStrategy === 'instant' && (
            <div className="mt-2 p-2 bg-gray-900/50 rounded border border-gray-700">
              <p className="text-xs text-gray-300">
                ⚡ <span className="text-emerald-500 font-semibold">Instant Entry:</span> Executes buy immediately at market price with your specified SOL amount.
              </p>
            </div>
          )}

          {entryStrategy === 'limit' && (
            <div className="mt-2 p-2 bg-gray-900/50 rounded border border-gray-700">
              <p className="text-xs text-gray-300 mb-3">
                📊 <span className="text-emerald-500 font-semibold">Limit Order:</span> Automatically buys when price reaches your target.
              </p>

              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Target Price (USD)</label>
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    step="0.00001"
                    min="0"
                    placeholder="e.g. 0.025"
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Order will execute when price drops to or below this value</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Expires In (minutes)</label>
                  <input
                    type="number"
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    step="15"
                    min="15"
                    placeholder="60"
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty for no expiration</p>
                </div>

                {isIntegrated && (
                  <div className="flex items-center justify-between p-2 bg-emerald-900/10 border border-emerald-900/30 rounded mt-2">
                    <div className="flex items-center gap-2">
                      <Bot className="w-3.5 h-3.5 text-emerald-400" />
                      <div>
                        <p className="text-xs font-semibold text-white">Stealth Limit Order</p>
                        <p className="text-[9px] text-gray-400">Funds moved privately on trigger</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsPrivate(!isPrivate)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isPrivate ? 'bg-emerald-600' : 'bg-gray-700'}`}
                    >
                      <span
                        className={`${isPrivate ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                      />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {entryStrategy === 'dca' && (
            <div className="mt-2 p-2 bg-gray-900/50 rounded border border-gray-700">
              <p className="text-xs text-gray-300 mb-3">
                💵 <span className="text-emerald-500 font-semibold">DCA (Dollar Cost Averaging):</span> Splits your purchase across multiple buys over time.
              </p>

              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">DCA Strategy</label>
                  <select
                    value={dcaStrategy}
                    onChange={(e) => setDcaStrategy(e.target.value as DCAStrategyType)}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="time-based">⏰ Time-based - Fixed amounts at intervals</option>
                    <option value="price-based">📊 Price-based - More when price drops</option>
                  </select>
                  {dcaStrategy === 'price-based' && (
                    <p className="text-xs text-gray-500 mt-1">Buys more when price drops, less when it rises</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Number of Buys</label>
                  <input
                    type="number"
                    value={numberOfBuys}
                    onChange={(e) => setNumberOfBuys(e.target.value)}
                    step="1"
                    min="2"
                    max="100"
                    placeholder="5"
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Total {solAmount} SOL ÷ {numberOfBuys} = {(parseFloat(solAmount) / parseInt(numberOfBuys || '1')).toFixed(4)} SOL per buy</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Interval (minutes)</label>
                  <input
                    type="number"
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(e.target.value)}
                    step="15"
                    min="1"
                    placeholder="60"
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Total duration: {Math.floor((parseInt(intervalMinutes || '0') * parseInt(numberOfBuys || '0')) / 60)}h {(parseInt(intervalMinutes || '0') * parseInt(numberOfBuys || '0')) % 60}m
                  </p>
                </div>

                {isIntegrated && (
                  <div className="flex items-center justify-between p-2 bg-emerald-900/10 border border-emerald-900/30 rounded mt-2">
                    <div className="flex items-center gap-2">
                      <Bot className="w-3.5 h-3.5 text-emerald-400" />
                      <div>
                        <p className="text-xs font-semibold text-white">Private DCA</p>
                        <p className="text-[9px] text-gray-400">Fresh burner wallet per buy</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsPrivate(!isPrivate)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isPrivate ? 'bg-emerald-600' : 'bg-gray-700'}`}
                    >
                      <span
                        className={`${isPrivate ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                      />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Exit Strategy</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as ExitStrategy)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-600"
          >
            <optgroup label="📋 MANUAL">
              <option value="manual">🎮 Manual - You control all exits</option>
            </optgroup>

            <optgroup label="⚡ FAST TRADING (Minutes)">
              <option value="scalping">⚡ Scalping - Quick 1-3min profit grabs</option>
              <option value="aggressive">⚡ Aggressive - Fast 8min momentum plays</option>
              <option value="moderate">⚖️ Moderate - Balanced 20min strategy</option>
              <option value="slow">🐢 Slow - Patient 50min accumulation</option>
            </optgroup>

            <optgroup label="💎 HODL (Days-Weeks)">
              <option value="hodl1">💎 HODL 1 - Hours to days hold</option>
              <option value="hodl2">💎 HODL 2 - Days to weeks hold</option>
              <option value="hodl3">💎 HODL 3 - Weeks to months hold</option>
              <option value="swing">📊 Swing - Multi-day trend capture</option>
            </optgroup>

            <optgroup label="🚀 ADVANCED">
              <option value="breakout">🚀 Breakout - Ride momentum spikes</option>
              <option value="trailing">📈 Trailing Stop - Follow price up</option>
              <option value="grid">⚙️ Grid - Automated buy/sell zones</option>
              <option value="conservative">🛡️ Conservative - Protect capital first</option>
              <option value="takeProfit">💰 Take Profit Only - No stop loss</option>
              <option value="dca">💵 DCA Exit - Staged selling over time</option>
            </optgroup>
          </select>

          {strategies && strategies[strategy] && (
            <div className="mt-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
              <p className="text-xs font-semibold text-emerald-500 mb-2">
                {strategies[strategy].description}
              </p>

              {strategies[strategy].details && strategies[strategy].details.length > 0 ? (
                <div className="mb-3 text-xs text-gray-300 space-y-1.5 p-2 bg-gray-800/50 rounded">
                  {strategies[strategy].details.map((detail, idx) => (
                    <p key={idx} className="flex gap-2">
                      <span className="text-emerald-500/70">•</span>
                      <span>{detail}</span>
                    </p>
                  ))}
                </div>
              ) : strategy === 'manual' ? (
                <div className="text-xs text-gray-300 space-y-2 mb-3">
                  <p className="text-white">• You control all sell decisions</p>
                  <p className="text-white">• Use sell buttons to exit position</p>
                  <p className="text-white">• No automated exits or stop loss</p>
                  <p className="text-white">• Monitor and sell at your discretion</p>
                </div>
              ) : null}

              {strategy !== 'manual' && (
                <>
                  <div className="space-y-1 text-xs text-gray-300">
                    <p className="font-semibold text-gray-200 mb-1">Exit Stages:</p>
                    {strategies[strategy].exitStages.map((stage, idx) => (
                      <div key={idx} className="flex justify-between pl-2">
                        <span className="text-gray-400">
                          Stage {idx + 1}:
                          {stage.timeMinutes !== undefined && ` ${stage.timeMinutes}min`}
                        </span>
                        <span className="text-white">
                          Sell {stage.sellPercent}% at +{stage.minProfitPercent}%
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between text-xs">
                    <span className="text-red-400">
                      Stop Loss: {strategies[strategy].stopLossPercent}%
                    </span>
                    <span className="text-gray-400">
                      Max Hold: {strategies[strategy].maxHoldTime >= 1440
                        ? `${Math.round(strategies[strategy].maxHoldTime / 1440)}d`
                        : strategies[strategy].maxHoldTime >= 60
                        ? `${Math.round(strategies[strategy].maxHoldTime / 60)}h`
                        : `${strategies[strategy].maxHoldTime}m`}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    {strategies[strategy].isPercentageBased
                      ? '📊 Percentage-based: Exits when profit targets hit (no time limit)'
                      : '⏰ Time-based: Exits at specified times IF profit target reached'}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {isIntegrated && entryStrategy === 'instant' && (
           <div className="flex items-center justify-between p-3 bg-emerald-900/10 border border-emerald-900/30 rounded-lg">
              <div className="flex items-center gap-2">
                 <Bot className="w-4 h-4 text-emerald-400" />
                 <div>
                    <p className="text-sm font-semibold text-white">Private Trade</p>
                    <p className="text-[10px] text-gray-400">Uses ShadowWire Shield & Ephemeral Wallet</p>
                 </div>
              </div>
              <button
                onClick={() => setIsPrivate(!isPrivate)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isPrivate ? 'bg-emerald-600' : 'bg-gray-700'}`}
              >
                <span
                  className={`${isPrivate ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </button>
           </div>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="text-sm text-green-400 bg-green-900/20 p-3 rounded-lg">
            Trade executed successfully!
          </div>
        )}

        <button
          onClick={handleBuy}
          disabled={buying || !activeWalletKey}
          className="w-full px-4 py-3 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
        >
          {buying
            ? 'Processing...'
            : !activeWalletKey
            ? 'Connect Wallet'
            : entryStrategy === 'limit'
            ? 'Create Limit Order'
            : entryStrategy === 'dca'
            ? 'Create DCA Order'
            : 'Buy Token'}
        </button>
      </div>
    </div>
  );
}
