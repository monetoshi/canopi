/**
 * Solana Trading Bot - WebSocket Server
 * Real-time updates for positions, prices, and trades
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { positionManager } from '../core/position-manager';
import { priceService } from '../services/price.service';
import { exitExecutor } from '../services/exit-executor';
import { logger } from '../utils/logger.util';
import { WebSocketMessage, WebSocketMessageType } from '../types';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

interface Client {
  ws: WebSocket;
  walletPublicKey?: string;
  subscriptions: Set<string>; // Token mints to watch
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, Client> = new Map();
  private priceUpdateInterval?: NodeJS.Timeout;

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupWebSocket();
    this.startPriceUpdates();

    // Start the exit executor
    exitExecutor.start().then(() => {
      logger.info('Exit executor started');
    }).catch(err => {
      logger.error('Failed to start exit executor:', err);
    });
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('New WebSocket connection');

      const client: Client = {
        ws,
        subscriptions: new Set()
      };

      this.clients.set(ws, client);

      // Send welcome message
      this.sendMessage(ws, {
        type: 'connection',
        data: { message: 'Connected to Solana Trading Bot' },
        timestamp: Date.now()
      });

      // Handle incoming messages
      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          logger.error('Error parsing WebSocket message:', error);
        }
      });
      
      // Handle socket errors
      ws.on('error', (err) => {
        logger.error(`WebSocket client error: ${err.message}`);
        this.clients.delete(ws);
      });

      // Handle disconnect
      ws.on('close', () => {
        logger.info('WebSocket connection closed');
        this.clients.delete(ws);
      });
    });
    
    // Server-level error handling
    this.wss.on('error', (err) => {
      logger.error(`WebSocket server error: ${err.message}`);
    });
  }

  /**
   * Handle messages from clients
   */
  private handleClientMessage(ws: WebSocket, message: any) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'subscribe_wallet':
        if (message.walletPublicKey && message.signature && message.timestamp) {
          try {
            // Verify timestamp (prevent replay attacks - 5 min window)
            const now = Date.now();
            if (Math.abs(now - message.timestamp) > 5 * 60 * 1000) {
              this.sendMessage(ws, { type: 'error', data: { message: 'Subscription request expired' }, timestamp: now });
              return;
            }

            // Verify signature
            const messageText = `Subscribe to Canopi: ${message.timestamp}`;
            const messageBytes = new TextEncoder().encode(messageText);
            const signatureBytes = bs58.decode(message.signature);
            const publicKeyBytes = new PublicKey(message.walletPublicKey).toBytes();

            const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

            if (!isValid) {
              logger.warn(`Invalid signature for wallet subscription: ${message.walletPublicKey}`);
              this.sendMessage(ws, { type: 'error', data: { message: 'Invalid signature' }, timestamp: now });
              return;
            }

            client.walletPublicKey = message.walletPublicKey;
            logger.info(`Client authenticated and subscribed to wallet: ${message.walletPublicKey.slice(0, 8)}...`);

            // Send current positions
            const positions = positionManager.getPositions(message.walletPublicKey);
            this.sendMessage(ws, {
              type: 'position_update',
              data: positions,
              timestamp: Date.now()
            });
          } catch (e: any) {
            logger.error(`Error verifying subscription: ${e.message}`);
            this.sendMessage(ws, { type: 'error', data: { message: 'Authentication error' }, timestamp: Date.now() });
          }
        } else {
          this.sendMessage(ws, { type: 'error', data: { message: 'Missing authentication data' }, timestamp: Date.now() });
        }
        break;

      case 'subscribe_token':
        if (message.mint) {
          client.subscriptions.add(message.mint);
          logger.info(`Client subscribed to token: ${message.mint.slice(0, 8)}...`);
        }
        break;

      case 'unsubscribe_token':
        if (message.mint) {
          client.subscriptions.delete(message.mint);
          logger.info(`Client unsubscribed from token: ${message.mint.slice(0, 8)}...`);
        }
        break;

      case 'ping':
        this.sendMessage(ws, {
          type: 'connection',
          data: { message: 'pong' },
          timestamp: Date.now()
        });
        break;

      default:
        logger.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Send message to a specific client
   */
  private sendMessage(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: WebSocketMessage) {
    this.clients.forEach((client) => {
      this.sendMessage(client.ws, message);
    });
  }

  /**
   * Send message to clients subscribed to a specific wallet
   */
  broadcastToWallet(walletPublicKey: string, message: WebSocketMessage) {
    this.clients.forEach((client) => {
      if (client.walletPublicKey === walletPublicKey) {
        this.sendMessage(client.ws, message);
      }
    });
  }

  /**
   * Send message to clients subscribed to a specific token
   */
  broadcastToToken(mint: string, message: WebSocketMessage) {
    this.clients.forEach((client) => {
      if (client.subscriptions.has(mint)) {
        this.sendMessage(client.ws, message);
      }
    });
  }

  /**
   * Start periodic price updates
   */
  private startPriceUpdates() {
    this.priceUpdateInterval = setInterval(async () => {
      try {
        // Get all active positions
        const positions = positionManager.getAllActivePositions();
        if (positions.length === 0) return;

        // Get unique mints
        const mints = [...new Set(positions.map(p => p.mint))];

        // Fetch prices
        const prices = await priceService.getPrices(mints);

        // Create price map for exit executor
        const pricesMap = new Map<string, number>();
        for (const [mint, price] of Object.entries(prices)) {
          pricesMap.set(mint, price);
        }

        // Update positions and notify clients
        for (const position of positions) {
          const price = prices[position.mint];
          if (!price) continue;

          // Update position with new price
          positionManager.updatePositionPrice(
            position.walletPublicKey,
            position.mint,
            price
          );

          // Check exit conditions
          const exitCheck = positionManager.checkExitConditions(position, price);

          // Broadcast price update to token subscribers
          this.broadcastToToken(position.mint, {
            type: 'price_update',
            data: {
              mint: position.mint,
              price,
              timestamp: Date.now()
            },
            timestamp: Date.now()
          });

          // Broadcast position update to wallet subscribers
          this.broadcastToWallet(position.walletPublicKey, {
            type: 'position_update',
            data: {
              position,
              exitCheck: exitCheck.shouldExit ? exitCheck : null
            },
            timestamp: Date.now()
          });
        }

        // Check for exit conditions and create pending sells
        await exitExecutor.checkPositionsForExits(positions, pricesMap);
      } catch (error) {
        logger.error('Error in price update loop:', error);
      }
    }, 5000); // Update every 5 seconds
  }

  /**
   * Notify about trade execution
   */
  notifyTrade(walletPublicKey: string, trade: any) {
    this.broadcastToWallet(walletPublicKey, {
      type: 'trade_executed',
      data: trade,
      timestamp: Date.now()
    });
  }

  /**
   * Stop price updates and close all connections
   */
  close() {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }

    // Stop the exit executor
    exitExecutor.stop();

    this.clients.forEach((client) => {
      client.ws.close();
    });

    this.wss.close();
    logger.info('WebSocket server closed');
  }
}