import fs from 'fs';
import path from 'path';
import { getDataDir } from './paths.util';
import { logger } from './logger.util';

const CONFIG_FILE = path.join(getDataDir(), 'config.json');

export interface AppConfig {
  telegramBotToken?: string;
  rpcUrl?: string;
  adminApiKey?: string;
  autoLock?: {
    enabled: boolean;
    durationMinutes: number;
  };
}

import { encryptionService } from '../services/encryption.service';

export const configUtil = {
  get: (): AppConfig => {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const rawContent = fs.readFileSync(CONFIG_FILE, 'utf-8');

        // 1. Try to parse as JSON directly (Legacy/Unencrypted)
        try {
          const legacyConfig = JSON.parse(rawContent);
          // If we successfully parsed JSON, and we have a password, let's migrate to encryption immediately
          if (encryptionService.isReady()) {
            logger.info('[Config] Migrating legacy config to encrypted storage...');
            configUtil.saveToDisk(legacyConfig);
          }
          return legacyConfig;
        } catch (jsonErr) {
          // Not JSON, assume encrypted string
        }

        // 2. Try to decrypt (Encrypted)
        try {
          if (!encryptionService.isReady()) {
            // Cannot decrypt yet
            return {};
          }

          const encryptedData = encryptionService.parse(rawContent);
          if (!encryptedData) return {};

          const decryptedJson = encryptionService.decrypt(encryptedData);
          return JSON.parse(decryptedJson);
        } catch (decryptErr) {
          logger.error('Failed to decrypt config:', decryptErr);
          return {};
        }
      }
    } catch (e) {
      logger.error('Failed to load config:', e);
    }
    return {};
  },

  set: (key: keyof AppConfig, value: any) => {
    // We must load current config first to merge
    // WARNING: If locked, get() returns {}, so we might overwrite with partial data?
    // Actually, set() should probably only be called when unlocked (authenticated settings API)

    if (!encryptionService.isReady()) {
      logger.error('Cannot save config: Wallet is locked');
      throw new Error('Wallet is locked');
    }

    const config = configUtil.get();
    config[key] = value;
    configUtil.saveToDisk(config);
  },

  // Helper to write to disk
  saveToDisk: (config: AppConfig) => {
    try {
      if (!encryptionService.isReady()) {
        // Fallback? Or throw?
        // For now, if no password, we can't encrypt.
        throw new Error('Wallet locked');
      }

      const jsonContent = JSON.stringify(config);
      const encrypted = encryptionService.encrypt(jsonContent);
      const params = encryptionService.stringify(encrypted);

      fs.writeFileSync(CONFIG_FILE, params);
    } catch (e) {
      logger.error('Failed to save config:', e);
      throw e;
    }
  }
};
