'use client';

import { useState, useEffect } from 'react';
import { Clock, ShieldCheck, Loader2 } from 'lucide-react';
import { getAutoLockSettings, setAutoLockSettings } from '@/lib/api';

export default function AutoLockSettings() {
    const [enabled, setEnabled] = useState(true);
    const [duration, setDuration] = useState(15);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const settings = await getAutoLockSettings();
            setEnabled(settings.enabled);
            setDuration(settings.durationMinutes);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async () => {
        const newState = !enabled;
        setEnabled(newState);
        await setAutoLockSettings(newState, duration);
    };

    const handleDurationChange = async (minutes: number) => {
        setDuration(minutes);
        if (enabled) {
            await setAutoLockSettings(enabled, minutes);
        }
    };

    return (
        <div className="px-4 py-4 border-t border-gray-700 bg-gray-900/30">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    {enabled ? (
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        </div>
                    ) : (
                        <div className="p-2 bg-gray-700/50 rounded-lg">
                            <Clock className="w-5 h-5 text-gray-400" />
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-medium text-white flex items-center gap-2">
                            Auto-Lock
                            {enabled && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Active</span>}
                        </p>
                        <p className="text-xs text-gray-400">Lock after inactivity</p>
                    </div>
                </div>

                <button
                    onClick={handleToggle}
                    disabled={loading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-emerald-600' : 'bg-gray-700'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-opacity-90'}`}
                >
                    <span
                        className={`${enabled ? 'translate-x-6' : 'translate-x-1'
                            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm`}
                    />
                </button>
            </div>

            {enabled && (
                <div className="grid grid-cols-4 gap-2 mt-2 animate-fadeIn">
                    {[5, 15, 30, 60].map((mins) => (
                        <button
                            key={mins}
                            onClick={() => handleDurationChange(mins)}
                            className={`py-1.5 text-xs rounded-md border transition-all ${duration === mins
                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-medium'
                                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                                }`}
                        >
                            {mins}m
                        </button>
                    ))}
                </div>
            )}

            {loading && (
                <p className="text-xs text-emerald-500 flex items-center gap-1.5 mt-2 justify-end">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Syncing...
                </p>
            )}
        </div>
    );
}
