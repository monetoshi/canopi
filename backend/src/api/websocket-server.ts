/**
 * Solana Trading Bot - WebSocket Server
 * Real-time updates for positions, prices, and trades
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { positionManager } from '../core/position-manager';
import { priceService } from '../services/price.service';
import { logger } from '../utils/logger.util';
import { WebSocketMessage, WebSocketMessageType } from '../types';

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

      // Handle disconnect
      ws.on('close', () => {
        logger.info('WebSocket connection closed');
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
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
        if (message.walletPublicKey) {
          client.walletPublicKey = message.walletPublicKey;
          logger.info(`Client subscribed to wallet: ${message.walletPublicKey.slice(0, 8)}...`);

          // Send current positions
          const positions = positionManager.getPositions(message.walletPublicKey);
          this.sendMessage(ws, {
            type: 'position_update',
            data: positions,
            timestamp: Date.now()
          });
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

    this.clients.forEach((client) => {
      client.ws.close();
    });

    this.wss.close();
    logger.info('WebSocket server closed');
  }
}
