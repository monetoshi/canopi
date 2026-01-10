/**
 * Network Service
 * Manages network configuration and Tor proxy integration
 */

import { SocksProxyAgent } from 'socks-proxy-agent';
import { logger } from '../utils/logger.util';
import http from 'http';
import https from 'https';
import net from 'net';

export class NetworkService {
  private _isTorEnabled: boolean = false;
  private torHost: string = '127.0.0.1';
  private torPort: number = 9050;
  private agent: SocksProxyAgent | null = null;

  constructor() {
    // Default to false, user must enable it
    this._isTorEnabled = false;
  }

  get isTorEnabled(): boolean {
    return this._isTorEnabled;
  }

  /**
   * Toggle Tor Mode
   * @param enabled Desired state
   * @returns Success boolean
   */
  async setTorEnabled(enabled: boolean): Promise<boolean> {
    if (enabled) {
      // Validate Tor connection first
      const isReachable = await this.checkTorConnection();
      if (!isReachable) {
        logger.error('[NetworkService] Cannot enable Tor: Proxy unreachable at 127.0.0.1:9050');
        return false;
      }

      this.agent = new SocksProxyAgent(`socks5://${this.torHost}:${this.torPort}`);
      this._isTorEnabled = true;
      logger.info('[NetworkService] 🧅 Tor Mode ENABLED');
    } else {
      this.agent = null;
      this._isTorEnabled = false;
      logger.info('[NetworkService] 🌐 Tor Mode DISABLED');
    }
    return true;
  }

  /**
   * Get the HTTP/HTTPS Agent for requests
   */
  getAgent(): http.Agent | https.Agent | undefined {
    if (this._isTorEnabled && this.agent) {
      return this.agent;
    }
    return undefined;
  }

  /**
   * Check if Tor SOCKS5 proxy is listening
   */
  private checkTorConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(this.torPort, this.torHost);
    });
  }

  /**
   * Helper to get axios config object
   */
  getAxiosConfig() {
    if (this._isTorEnabled && this.agent) {
      return {
        httpAgent: this.agent,
        httpsAgent: this.agent
      };
    }
    return {};
  }
}

export const networkService = new NetworkService();
