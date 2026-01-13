/**
 * Network Service
 * Manages network configuration and Tor proxy integration
 */

import { SocksProxyAgent } from 'socks-proxy-agent';
import { logger } from '../utils/logger.util';
import http from 'http';
import https from 'https';
import net from 'net';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export class NetworkService {
  private _isTorEnabled: boolean = false;
  private torHost: string = '127.0.0.1';
  private torPort: number = 9050;
  private agent: SocksProxyAgent | null = null;
  private torProcess: ChildProcess | null = null;

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
      // 1. Check if Tor is already running
      let isReachable = await this.checkTorConnection();
      
      if (!isReachable) {
        logger.info('[NetworkService] Tor not reachable. Attempting to spawn managed process...');
        const spawned = await this.spawnTorProcess();
        if (spawned) {
          logger.info('[NetworkService] Waiting for Tor to bootstrap...');
          await new Promise(r => setTimeout(r, 3000)); // Wait 3s
          isReachable = await this.checkTorConnection();
        }
      }

      if (!isReachable) {
        logger.error('[NetworkService] Cannot enable Tor: Proxy unreachable at 127.0.0.1:9050');
        logger.error('[NetworkService] Hint: Run "npm run install:tor" in backend folder');
        return false;
      }

      this.agent = new SocksProxyAgent(`socks5://${this.torHost}:${this.torPort}`);
      this._isTorEnabled = true;
      logger.info('[NetworkService] 🧅 Tor Mode ENABLED');
    } else {
      this.stopTorProcess();
      this.agent = null;
      this._isTorEnabled = false;
      logger.info('[NetworkService] 🌐 Tor Mode DISABLED');
    }
    return true;
  }

  private async spawnTorProcess(): Promise<boolean> {
    // Look for binary based on environment
    let binPath: string;
    
    if (process.env.RESOURCES_PATH) {
      // Production: Bundled in Resources/bin/tor
      binPath = path.join(process.env.RESOURCES_PATH, 'bin/tor');
    } else {
      // Development: Symlinked in backend/bin/tor
      binPath = path.resolve(__dirname, '../../bin/tor');
    }
    
    if (!fs.existsSync(binPath)) {
      logger.warn(`[NetworkService] Tor binary not found at ${binPath}`);
      return false;
    }

    const dataDir = path.join(process.cwd(), 'data', 'tor');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    logger.info(`[NetworkService] Spawning Tor from ${binPath}`);
    
    try {
      this.torProcess = spawn(binPath, [
        '--SocksPort', this.torPort.toString(),
        '--DataDirectory', dataDir
      ], {
        detached: false, // Kill when parent dies
        stdio: 'ignore' // Ignore stdout/stderr to reduce noise
      });

      this.torProcess.on('error', (err) => {
        logger.error(`[NetworkService] Tor process error: ${err.message}`);
      });

      this.torProcess.on('exit', (code) => {
        logger.info(`[NetworkService] Tor process exited with code ${code}`);
        this.torProcess = null;
      });

      return true;
    } catch (e: any) {
      logger.error(`[NetworkService] Failed to spawn Tor: ${e.message}`);
      return false;
    }
  }

  private stopTorProcess() {
    if (this.torProcess) {
      logger.info('[NetworkService] Stopping managed Tor process...');
      this.torProcess.kill();
      this.torProcess = null;
    }
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
