import fs from 'fs';
import path from 'path';
import { getDataDir } from './paths.util';
import { logger } from './logger.util';

const CONFIG_FILE = path.join(getDataDir(), 'config.json');

export interface AppConfig {
  telegramBotToken?: string;
  rpcUrl?: string;
}

export const configUtil = {
  get: (): AppConfig => {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      }
    } catch (e) {
      logger.error('Failed to load config:', e);
    }
    return {};
  },

  set: (key: keyof AppConfig, value: string) => {
    const config = configUtil.get();
    config[key] = value;
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (e) {
      logger.error('Failed to save config:', e);
    }
  }
};
