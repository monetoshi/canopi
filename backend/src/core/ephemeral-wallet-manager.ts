/**
 * Ephemeral Wallet Manager
 * Generates, encrypts, and stores temporary keys for private trading
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';
import { encrypt, decrypt, EncryptedData } from '../utils/security.util';
import { logger } from '../utils/logger.util';
import { getDataDir } from '../utils/paths.util';

const KEYS_FILE = path.join(getDataDir(), 'ephemeral-keys.enc.json');

export interface EphemeralKeyRecord {
  publicKey: string;
  encryptedKey: EncryptedData;
  createdAt: number;
  status: 'active' | 'drained' | 'burned';
}

export class EphemeralWalletManager {
  private keys: Map<string, EphemeralKeyRecord> = new Map();

  constructor() {
    this.loadKeys();
  }

  private loadKeys() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(KEYS_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(KEYS_FILE)) {
        const data = fs.readFileSync(KEYS_FILE, 'utf-8');
        const records: EphemeralKeyRecord[] = JSON.parse(data);
        for (const record of records) {
          this.keys.set(record.publicKey, record);
        }
        logger.info(`[EphemeralWalletManager] Loaded ${this.keys.size} keys from disk`);
      }
    } catch (error) {
      logger.error(`[EphemeralWalletManager] Error loading keys: ${error}`);
    }
  }

  private saveKeys() {
    try {
      const records = Array.from(this.keys.values());
      fs.writeFileSync(KEYS_FILE, JSON.stringify(records, null, 2));
    } catch (error) {
      logger.error(`[EphemeralWalletManager] Error saving keys: ${error}`);
    }
  }

  /**
   * Create a new ephemeral wallet
   */
  public createWallet(password: string): Keypair {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toString();
    const secretKey = bs58.encode(keypair.secretKey);

    const encryptedKey = encrypt(secretKey, password);

    this.keys.set(publicKey, {
      publicKey,
      encryptedKey,
      createdAt: Date.now(),
      status: 'active'
    });

    this.saveKeys();
    logger.info(`[EphemeralWalletManager] Created new ephemeral wallet: ${publicKey}`);
    return keypair;
  }

  /**
   * Get an existing ephemeral wallet
   */
  public getWallet(publicKey: string, password: string): Keypair | null {
    const record = this.keys.get(publicKey);
    if (!record) return null;

    try {
      const decryptedSecret = decrypt(record.encryptedKey, password);
      return Keypair.fromSecretKey(bs58.decode(decryptedSecret));
    } catch (error) {
      logger.error(`[EphemeralWalletManager] Failed to decrypt wallet ${publicKey}`);
      return null;
    }
  }

  /**
   * Mark a wallet as drained
   */
  public markDrained(publicKey: string) {
    const record = this.keys.get(publicKey);
    if (record) {
      record.status = 'drained';
      this.saveKeys();
    }
  }

  /**
   * Check if a wallet is ephemeral
   */
  public isEphemeral(publicKey: string): boolean {
    return this.keys.has(publicKey);
  }

  /**
   * Get all wallet public keys
   */
  public getAllPublicKeys(): string[] {
    return Array.from(this.keys.keys());
  }
}

export const ephemeralWalletManager = new EphemeralWalletManager();
