import { useState, useEffect } from 'react';
import { Send, CheckCircle2, XCircle, ExternalLink, MessageSquare, Loader2, Key, Copy, Check, Lock, Unlock, Bot } from 'lucide-react';
import { getTelegramStatus, generateTelegramLinkCode, saveTelegramToken } from '@/lib/api';

interface TelegramSetupProps {
  activeWalletKey: string;
}

export default function TelegramSetup({ activeWalletKey }: TelegramSetupProps) {
  const [status, setStatus] = useState<{ linked: boolean; username: string | null; botUsername: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<{ code: string; botUsername: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Admin Key State
  const [adminKey, setAdminKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);
  
  // Bot Token State
  const [botToken, setBotToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);

  useEffect(() => {
    // Load saved key
    const saved = localStorage.getItem('admin_api_key');
    if (saved) {
      setAdminKey(saved);
      setIsKeySaved(true);
    }

    if (activeWalletKey) {
      fetchStatus();
      setLinkData(null);
    }
  }, [activeWalletKey]);

  const handleSaveKey = () => {
    localStorage.setItem('admin_api_key', adminKey);
    setIsKeySaved(true);
    // Reload page to apply key to all API calls immediately
    window.location.reload();
  };

  const handleClearKey = () => {
    localStorage.removeItem('admin_api_key');
    setAdminKey('');
    setIsKeySaved(false);
    window.location.reload();
  };

  const handleSaveToken = async () => {
    setSavingToken(true);
    try {
      const success = await saveTelegramToken(botToken);
      if (success) {
        setBotToken('');
        fetchStatus();
      }
    } finally {
      setSavingToken(false);
    }
  };

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await getTelegramStatus(activeWalletKey);
      setStatus(data);
    } catch (e) {
      console.error('Failed to fetch Telegram status');
    } finally {
      setLoading(false);
    }
  };

  const generateLink = async () => {
    setGenerating(true);
    try {
      const data = await generateTelegramLinkCode(activeWalletKey);
      setLinkData(data);
    } catch (e) {
      console.error('Failed to generate link code');
    } finally {
      setGenerating(false);
    }
  };

  const copyCommand = () => {
    if (!linkData) return;
    navigator.clipboard.writeText(`/start ${linkData.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center">
        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 border-t border-gray-800 mt-4 pt-6">
      {/* Admin Access Section */}
      <div className="mb-6 pb-6 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          {isKeySaved ? <Lock className="w-5 h-5 text-emerald-500" /> : <Unlock className="w-5 h-5 text-red-400" />}
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Admin Access</h3>
        </div>
        
        <div className="flex gap-2">
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Enter Admin API Key"
            disabled={isKeySaved}
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-600 disabled:opacity-50"
          />
          {isKeySaved ? (
            <button
              onClick={handleClearKey}
              className="px-3 py-2 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg text-xs font-bold transition-all"
            >
              Clear
            </button>
          ) : (
            <button
              onClick={handleSaveKey}
              disabled={!adminKey}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              Save
            </button>
          )}
        </div>
        {!isKeySaved && (
          <p className="text-[10px] text-gray-500 mt-2">
            Required to view transaction history and move funds.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Bot className="w-5 h-5 text-purple-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Bot Configuration</h3>
      </div>
      
      <div className="mb-6 pb-6 border-b border-gray-800">
         <div className="flex gap-2">
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder={status?.botUsername && status.botUsername !== 'CanopiTradingBot' ? `Current: @${status.botUsername}` : "Enter Telegram Bot Token"}
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-600"
            />
            <button
              onClick={handleSaveToken}
              disabled={!botToken || savingToken}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              {savingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set Token'}
            </button>
         </div>
         <p className="text-[10px] text-gray-500 mt-2">
            Create a bot with @BotFather and paste the token here to enable notifications.
         </p>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Telegram Alerts</h3>
      </div>

      {status?.linked ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-semibold">Linked Successfully</span>
          </div>
          <p className="text-xs text-gray-400">
            Connected as <span className="text-white">@{status.username}</span>. You will receive real-time trade notifications.
          </p>
          <p className="text-[10px] text-gray-500 mt-2">
            Type <code className="bg-gray-800 px-1 rounded">/settings</code> in bot to configure alerts.
          </p>
        </div>
      ) : (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
            <XCircle className="w-4 h-4" />
            <span className="font-semibold">Not Linked</span>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Link your wallet to Telegram to get instant buy/sell alerts and automated trade notifications.
          </p>
          
          {!linkData ? (
            <button
              onClick={generateLink}
              disabled={generating}
              className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
              Generate Link Code
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-black/40 p-2 rounded border border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-400">Link Code:</span>
                <code className="text-lg font-mono font-bold text-white tracking-widest">{linkData.code}</code>
              </div>
              
              <div className="flex gap-2">
                <a
                  href={`https://t.me/${linkData.botUsername}?start=${linkData.code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
                >
                  <Send className="w-3 h-3" />
                  Open Bot
                </a>
                <button
                  onClick={copyCommand}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center"
                  title="Copy Start Command"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              
              <p className="text-[10px] text-gray-500 text-center">
                Link doesn't open? Copy command and send it to the bot.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button 
          onClick={fetchStatus}
          className="text-[10px] text-gray-500 hover:text-white transition-colors"
        >
          Refresh Status
        </button>
        <span className="text-[10px] text-gray-600">v1.1.1</span>
      </div>
    </div>
  );
}