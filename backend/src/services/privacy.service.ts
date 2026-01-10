/**
 * Privacy Service
 * Integrates ShadowWire SDK for shielded transactions
 */

import { ShadowWireClient, TokenUtils } from '@radr/shadowwire';
import { Connection, Keypair, VersionedTransaction, Transaction } from '@solana/web3.js';
import { getWalletKeypair, getConnection } from '../utils/blockchain.util';
import { logger } from '../utils/logger.util';

export class PrivacyService {
  private client: ShadowWireClient;
  private connection: Connection;

  constructor() {
    this.client = new ShadowWireClient({ debug: process.env.NODE_ENV === 'development' });
    this.connection = getConnection();
  }

  /**
   * Reload connection (e.g. when network settings change)
   */
  reload() {
    this.connection = getConnection();
    logger.info('[PrivacyService] Connection reloaded');
  }

  /**
   * Get shielded balance for a wallet
   */
  async getShieldedBalance(walletAddress: string) {
    try {
      const balance = await this.client.getBalance(walletAddress, 'SOL');
      return {
        available: TokenUtils.fromSmallestUnit(balance.available, 'SOL'),
        availableRaw: balance.available,
        poolAddress: balance.pool_address
      };
    } catch (error: any) {
      logger.error(`[PrivacyService] Error getting balance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Shield funds (Deposit to ShadowWire)
   */
  async shieldFunds(amountSol: number, customWallet?: Keypair) {
    const wallet = customWallet || getWalletKeypair();
    if (!wallet) throw new Error('Wallet not configured');

    try {
      logger.info(`[PrivacyService] Shielding ${amountSol} SOL from ${wallet.publicKey.toString().slice(0, 8)}...`);
      
      const amountLamports = TokenUtils.toSmallestUnit(amountSol, 'SOL');
      
      // 1. Request deposit transaction from ShadowWire
      const response = await this.client.deposit({
        wallet: wallet.publicKey.toString(),
        amount: amountLamports
      });

      if (!response.unsigned_tx_base64) {
        throw new Error('No transaction returned from ShadowWire');
      }

      // 2. Sign and Send
      const signature = await this.signAndSendTransaction(response.unsigned_tx_base64, wallet);
      
      logger.info(`[PrivacyService] Shielding successful: ${signature}`);
      return { signature };

    } catch (error: any) {
      logger.error(`[PrivacyService] Shielding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fund an ephemeral wallet privately from the shielded pool
   * This is the "Fund" step in "Wash & Trade"
   */
  async fundEphemeralWallet(targetPublicKey: string, amountSol: number) {
    const wallet = getWalletKeypair();
    if (!wallet) throw new Error('Bot wallet not configured');

    try {
      logger.info(`[PrivacyService] Funding ephemeral wallet ${targetPublicKey.slice(0, 8)}... with ${amountSol} SOL`);
      
      const amountLamports = TokenUtils.toSmallestUnit(amountSol, 'SOL');
      
      // Execute external transfer (shielded -> public)
      // We manually implement the transfer logic here because the SDK's transfer() method
      // fails to pass the wallet adapter to underlying methods for signing.
      
      const nonce = Math.floor(Math.random() * 1000000000); // Simple nonce generation
      const token = 'SOL';
      
      // 1. Upload Proof
      const proofResponse = await this.client.uploadProof({
        sender_wallet: wallet.publicKey.toString(),
        token: token,
        amount: Number(amountLamports),
        nonce: nonce
      }, {
        signMessage: async (message: Uint8Array) => {
          const nacl = require('tweetnacl');
          return nacl.sign.detached(message, wallet.secretKey);
        }
      });

      if (!proofResponse.success) {
        throw new Error('Failed to upload proof');
      }

      // 2. Execute External Transfer
      const relayerFee = Math.floor(Number(amountLamports) * 0.01);
      
      const response = await this.client.externalTransfer({
        sender_wallet: wallet.publicKey.toString(),
        recipient_wallet: targetPublicKey,
        token: token,
        nonce: proofResponse.nonce,
        relayer_fee: relayerFee
      }, {
        signMessage: async (message: Uint8Array) => {
          const nacl = require('tweetnacl');
          return nacl.sign.detached(message, wallet.secretKey);
        }
      });

      if (!response.success) {
        throw new Error('Private transfer failed');
      }

      logger.info(`[PrivacyService] Funding successful: ${response.tx_signature}`);
      return { signature: response.tx_signature };

    } catch (error: any) {
      logger.error(`[PrivacyService] Funding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unshield funds (Withdraw from ShadowWire)
   */
  async unshieldFunds(amountSol: number) {
    const wallet = getWalletKeypair();
    if (!wallet) throw new Error('Bot wallet not configured');

    try {
      logger.info(`[PrivacyService] Unshielding ${amountSol} SOL...`);
      
      const amountLamports = TokenUtils.toSmallestUnit(amountSol, 'SOL');
      
      // 1. Request withdraw transaction
      const response = await this.client.withdraw({
        wallet: wallet.publicKey.toString(),
        amount: amountLamports
      });

      if (!response.unsigned_tx_base64) {
        throw new Error('No transaction returned from ShadowWire');
      }

      // 2. Sign and Send
      const signature = await this.signAndSendTransaction(response.unsigned_tx_base64, wallet);
      
      logger.info(`[PrivacyService] Unshielding successful: ${signature}`);
      return { signature };

    } catch (error: any) {
      logger.error(`[PrivacyService] Unshielding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transfer shielded balance internally (Shadow-to-Shadow)
   * Used to consolidate funds from ephemeral wallets back to main wallet
   */
  async transferShieldedBalance(fromWallet: Keypair, toPublicKey: string, amountLamports: number) {
    try {
      const token = 'SOL';
      const nonce = Math.floor(Math.random() * 1000000000);

      // 1. Upload Proof
      const proofResponse = await this.client.uploadProof({
        sender_wallet: fromWallet.publicKey.toString(),
        token: token,
        amount: amountLamports,
        nonce: nonce
      }, {
        signMessage: async (message: Uint8Array) => {
          const nacl = require('tweetnacl');
          return nacl.sign.detached(message, fromWallet.secretKey);
        }
      });

      if (!proofResponse.success) {
        throw new Error('Failed to upload proof for consolidation');
      }

      // 2. Execute Internal Transfer
      const relayerFee = Math.floor(amountLamports * 0.01);
      
      const response = await this.client.internalTransfer({
        sender_wallet: fromWallet.publicKey.toString(),
        recipient_wallet: toPublicKey,
        token: token,
        nonce: proofResponse.nonce,
        relayer_fee: relayerFee
      }, {
        signMessage: async (message: Uint8Array) => {
          const nacl = require('tweetnacl');
          return nacl.sign.detached(message, fromWallet.secretKey);
        }
      });

      if (!response.success) {
        throw new Error('Internal transfer failed');
      }

      return { signature: response.tx_signature };
    } catch (error: any) {
      logger.error(`[PrivacyService] Consolidation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper to sign and send ShadowWire transactions
   */
  private async signAndSendTransaction(txBase64: string, wallet: Keypair): Promise<string> {
    const txBuffer = Buffer.from(txBase64, 'base64');
    
    let signature: string;
    
    try {
      // Try Versioned first
      const vTx = VersionedTransaction.deserialize(txBuffer);
      vTx.sign([wallet]);
      signature = await this.connection.sendRawTransaction(vTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3
      });
    } catch (e) {
      // Fallback to Legacy
      const lTx = Transaction.from(txBuffer);
      lTx.sign(wallet);
      signature = await this.connection.sendRawTransaction(lTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3
      });
    }
    
    return signature;
  }
}

export const privacyService = new PrivacyService();
