/**
 * Session Service
 * Manages auto-lock functionality based on inactivity
 */

import { logger } from '../utils/logger.util';
import { configUtil } from '../utils/config.util';
import { wsManagerInstance } from '../api/websocket-server';

export class SessionService {
    private lastActivity: number = Date.now();
    private durationMinutes: number = 15;
    private isEnabled: boolean = true;
    private intervalId: NodeJS.Timeout | null = null;
    private isLocked: boolean = false;

    constructor() {
        this.loadSettings();
        this.start();
    }

    private loadSettings() {
        // Load from persistent config if available, otherwise default
        const config = configUtil.get();
        if (config.autoLock) {
            this.durationMinutes = config.autoLock.durationMinutes || 15;
            this.isEnabled = config.autoLock.enabled !== false; // Default true
        }
    }

    public saveSettings(enabled: boolean, durationMinutes: number) {
        this.isEnabled = enabled;
        this.durationMinutes = durationMinutes;
        this.touch(); // Reset timer on setting change

        // Persist
        configUtil.set('autoLock', {
            enabled,
            durationMinutes
        });

        logger.info(`[SessionService] Settings updated: Enabled=${enabled}, Duration=${durationMinutes}m`);
    }

    public getSettings() {
        return {
            enabled: this.isEnabled,
            durationMinutes: this.durationMinutes
        };
    }

    /**
     * Start the monitoring interval
     */
    public start() {
        if (this.intervalId) return;

        // Check every 1 minute
        this.intervalId = setInterval(() => {
            this.checkTimeout();
        }, 60 * 1000);

        logger.info('[SessionService] Monitoring started');
    }

    public stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Record activity (reset timer)
     */
    public touch() {
        this.lastActivity = Date.now();
        if (this.isLocked) {
            // Logic for unlocking is handled by the wallet unlock API, 
            // but we reset the flag here if we detect valid activity (though usually 
            // authenticated requests won't pass if locked, except unlock/status)
            // Actually, we should only reset 'isLocked' if password exists.
            if (process.env.WALLET_PASSWORD) {
                this.isLocked = false;
            }
        }
    }

    private checkTimeout() {
        if (!this.isEnabled) return;
        if (!process.env.WALLET_PASSWORD) return; // Already locked

        const now = Date.now();
        const elapsedMinutes = (now - this.lastActivity) / 1000 / 60;

        if (elapsedMinutes >= this.durationMinutes) {
            this.lockWallet();
        }
    }

    private lockWallet() {
        logger.info(`[SessionService] 🔒 Auto-locking wallet after ${this.durationMinutes}m inactivity`);

        // 1. Clear Password
        delete process.env.WALLET_PASSWORD;
        this.isLocked = true;

        // 2. Notify Frontend via WebSocket
        if (wsManagerInstance) {
            wsManagerInstance.broadcast({
                type: 'wallet_autolocked',
                data: {},
                timestamp: Date.now()
            });
        }
    }
}

export const sessionService = new SessionService();
