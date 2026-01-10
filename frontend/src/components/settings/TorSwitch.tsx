'use client';
import { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Loader2, Network } from 'lucide-react';
import { api } from '@/lib/api';

export default function TorSwitch() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/api/settings/tor');
      if (res.data?.data) {
        setEnabled(res.data.data.enabled);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/api/settings/tor', { enabled: !enabled });
      if (res.data?.success) {
        setEnabled(res.data.data.enabled);
      } else {
        setError(res.data?.error || 'Failed to toggle Tor');
        // Revert if failed
        await fetchStatus();
      }
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Error toggling Tor');
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-4 border-t border-gray-700 bg-gray-900/30">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {enabled ? (
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
          ) : (
            <div className="p-2 bg-gray-700/50 rounded-lg">
              <Network className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-white flex items-center gap-2">
              Tor Network
              {enabled && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Protected</span>}
            </p>
            <p className="text-xs text-gray-400">Route via 127.0.0.1:9050</p>
          </div>
        </div>
        
        <button
          onClick={toggle}
          disabled={loading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            enabled ? 'bg-emerald-600' : 'bg-gray-700'
          } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-opacity-90'}`}
        >
          <span
            className={`${
              enabled ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm`}
          />
        </button>
      </div>
      
      {loading && (
        <p className="text-xs text-emerald-500 flex items-center gap-1.5 mt-2 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin"/> 
          {enabled ? 'Disconnecting...' : 'Configuring Proxy...'}
        </p>
      )}
      
      {error && (
        <div className="p-2 bg-red-900/20 border border-red-500/20 rounded text-xs text-red-400 mt-2 flex items-start gap-2">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
