/**
 * Encryption Service
 * Handles AES-256-GCM encryption for data at rest using the wallet password.
 */

import crypto from 'crypto';
import { logger } from '../utils/logger.util';

// Constants
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 64;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

export interface EncryptedData {
    iv: string;
    salt: string;
    tag: string;
    content: string;
}

export class EncryptionService {

    /**
     * Encrypts a string value using the current wallet password
     */
    public encrypt(text: string): EncryptedData {
        const password = this.getPassword();
        const salt = crypto.randomBytes(SALT_LENGTH);
        const iv = crypto.randomBytes(IV_LENGTH);

        const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const tag = cipher.getAuthTag();

        return {
            iv: iv.toString('hex'),
            salt: salt.toString('hex'),
            tag: tag.toString('hex'),
            content: encrypted
        };
    }

    /**
     * Decrypts an EncryptedData object
     */
    public decrypt(data: EncryptedData): string {
        const password = this.getPassword();

        const salt = Buffer.from(data.salt, 'hex');
        const iv = Buffer.from(data.iv, 'hex');
        const tag = Buffer.from(data.tag, 'hex');
        const content = data.content;

        const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(content, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Helper to format EncryptedData as a specific string format for storage
     * Format: version:salt:iv:tag:content
     */
    public stringify(data: EncryptedData): string {
        return `v1:${data.salt}:${data.iv}:${data.tag}:${data.content}`;
    }

    /**
     * Helper to parse the storage string back to EncryptedData
     */
    public parse(str: string): EncryptedData | null {
        const parts = str.split(':');
        if (parts.length !== 5 || parts[0] !== 'v1') return null;

        return {
            salt: parts[1],
            iv: parts[2],
            tag: parts[3],
            content: parts[4]
        };
    }

    /**
     * Get password or throw if locked
     */
    private getPassword(): string {
        const password = process.env.WALLET_PASSWORD;
        if (!password) {
            throw new Error('Wallet is locked. Cannot perform encryption/decryption.');
        }
        return password;
    }

    /**
     * Check if encryption is possible (wallet unlocked)
     */
    public isReady(): boolean {
        return !!process.env.WALLET_PASSWORD;
    }
}

export const encryptionService = new EncryptionService();
