/**
 * Solana Trading Bot - Blockchain Utilities
 * Helper functions for Solana blockchain interactions
 */

import { Connection, PublicKey, Transaction, VersionedTransaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
import path from 'path';
import { loadEncryptedWallet, decrypt } from './security.util';

dotenv.config();

/**
 * Initialize Solana connection
 */
export function getConnection(rpcUrl: string = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com'): Connection {
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Get server wallet Keypair from environment or encrypted keystore
 */
export function getWalletKeypair(): Keypair | null {
  // Priority 1: Plaintext env var (Legacy/Dev)
  const privateKey = process.env.WALLET_PRIVATE_KEY;
  if (privateKey) {
    try {
      if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
        const array = JSON.parse(privateKey);
        return Keypair.fromSecretKey(Uint8Array.from(array));
      }
      return Keypair.fromSecretKey(bs58.decode(privateKey));
    } catch (error) {
      console.error('[Blockchain] Failed to parse WALLET_PRIVATE_KEY:', error);
    }
  }

  // Priority 2: Encrypted Keystore
  const password = process.env.WALLET_PASSWORD;
  if (password) {
    const walletPath = path.join(process.cwd(), 'data', 'wallet.enc.json');
    const encryptedData = loadEncryptedWallet(walletPath);
    
    if (encryptedData) {
      try {
        const decryptedKey = decrypt(encryptedData, password);
        if (decryptedKey.startsWith('[') && decryptedKey.endsWith(']')) {
           return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(decryptedKey)));
        }
        return Keypair.fromSecretKey(bs58.decode(decryptedKey));
      } catch (error) {
        console.error('[Blockchain] Failed to decrypt wallet. Incorrect password?');
        return null;
      }
    }
  }

  console.warn('[Blockchain] No valid wallet configuration found (WALLET_PRIVATE_KEY or Encrypted Store + Password)');
  return null;
}

/**
 * Validate Solana public key
 */
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get SOL balance for a wallet
 */
export async function getSOLBalance(connection: Connection, publicKey: string): Promise<number> {
  try {
    const pubkey = new PublicKey(publicKey);
    const balance = await connection.getBalance(pubkey);
    return balance / 1e9; // Convert lamports to SOL
  } catch (error) {
    console.error('[Blockchain] Error getting SOL balance:', error);
    return 0;
  }
}

/**
 * Deserialize transaction from base64
 */
export function deserializeTransaction(transactionBase64: string): Transaction | VersionedTransaction {
  try {
    const buffer = Buffer.from(transactionBase64, 'base64');

    // Try to deserialize as versioned transaction first
    try {
      return VersionedTransaction.deserialize(buffer);
    } catch {
      // Fall back to legacy transaction
      return Transaction.from(buffer);
    }
  } catch (error) {
    throw new Error(`Failed to deserialize transaction: ${error}`);
  }
}

/**
 * Serialize transaction to base64
 */
export function serializeTransaction(transaction: Transaction | VersionedTransaction): string {
  try {
    if (transaction instanceof VersionedTransaction) {
      return Buffer.from(transaction.serialize()).toString('base64');
    } else {
      return transaction.serialize({ requireAllSignatures: false }).toString('base64');
    }
  } catch (error) {
    throw new Error(`Failed to serialize transaction: ${error}`);
  }
}

/**
 * Validate transaction signature
 */
export async function validateSignature(
  connection: Connection,
  signature: string
): Promise<boolean> {
  try {
    const status = await connection.getSignatureStatus(signature);
    return status?.value !== null;
  } catch (error) {
    console.error('[Blockchain] Error validating signature:', error);
    return false;
  }
}

/**
 * Wait for transaction confirmation
 */
export async function confirmTransaction(
  connection: Connection,
  signature: string,
  maxRetries: number = 30
): Promise<boolean> {
  console.log(`[Blockchain] Confirming transaction: ${signature}`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const status = await connection.getSignatureStatus(signature);

      if (status?.value?.confirmationStatus === 'confirmed' ||
          status?.value?.confirmationStatus === 'finalized') {
        console.log(`[Blockchain] Transaction confirmed: ${signature}`);
        return true;
      }

      if (status?.value?.err) {
        console.error(`[Blockchain] Transaction failed: ${signature}`, status.value.err);
        return false;
      }

      // Wait 1 second before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('[Blockchain] Error checking transaction status:', error);
    }
  }

  console.error(`[Blockchain] Transaction confirmation timeout: ${signature}`);
  return false;
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSOL(lamports: number): number {
  return lamports / 1e9;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1e9);
}

/**
 * Format public key for display
 */
export function formatPublicKey(publicKey: string, length: number = 8): string {
  if (publicKey.length <= length) return publicKey;
  const half = Math.floor(length / 2);
  return `${publicKey.slice(0, half)}...${publicKey.slice(-half)}`;
}

/**
 * Check if address is SOL mint
 */
export function isSOLMint(mint: string): boolean {
  return mint === 'So11111111111111111111111111111111111111112';
}

/**
 * Get token decimals (common values)
 */
export function getCommonDecimals(mint: string): number {
  if (isSOLMint(mint)) return 9;
  // Most SPL tokens use 6 or 9 decimals
  return 6;
}
