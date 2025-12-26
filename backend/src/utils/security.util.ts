/**
 * Security Utilities
 * Handles encryption and decryption of sensitive data (like private keys)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

export interface EncryptedData {
  iv: string;
  salt: string;
  tag: string;
  content: string;
}

/**
 * Derive a key from a password using PBKDF2
 */
function getKeyFromPassword(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt text with a password
 */
export function encrypt(text: string, password: string): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getKeyFromPassword(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    tag: tag.toString('hex'),
    content: encrypted.toString('hex')
  };
}

/**
 * Decrypt data with a password
 */
export function decrypt(data: EncryptedData, password: string): string {
  const iv = Buffer.from(data.iv, 'hex');
  const salt = Buffer.from(data.salt, 'hex');
  const tag = Buffer.from(data.tag, 'hex');
  const content = Buffer.from(data.content, 'hex');

  const key = getKeyFromPassword(password, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(content),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Save encrypted wallet to disk
 */
export function saveEncryptedWallet(encryptedData: EncryptedData, filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(encryptedData, null, 2));
}

/**
 * Load encrypted wallet from disk
 */
export function loadEncryptedWallet(filePath: string): EncryptedData | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as EncryptedData;
  } catch (error) {
    console.error('Failed to parse encrypted wallet file');
    return null;
  }
}
