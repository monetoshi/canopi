/**
 * Solana Trading Bot - Main Entry Point
 * Starts the Express server with WebSocket support
 */

import dotenv from 'dotenv';
import http from 'http';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { app } from './api/wallet-server';
import { chartRouter } from './api/chart-api';
import taxRouter from './api/tax-api';
import { WebSocketManager } from './api/websocket-server';
import { limitOrderExecutor } from './services/limit-order-executor';
import { dcaExecutor } from './services/dca-executor';
import { positionManager } from './core/position-manager';
import { limitOrderManager } from './core/limit-order-manager';
import { dcaOrderManager } from './core/dca-order-manager';
import { pendingSellsManager } from './core/pending-sells-manager';
import { logger } from './utils/logger.util';
import { getWalletPath } from './utils/paths.util';

// Load environment variables
dotenv.config();

/**
 * Helper to mask sensitive URLs (removes query parameters)
 */
function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.search) {
      return `${u.origin}${u.pathname}?***`;
    }
    return url;
  } catch {
    return 'Invalid URL';
  }
}

// Helper to prompt for password securely
function askPassword(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  return new Promise((resolve) => {
    // Mute stdout to hide password
    // This is a basic implementation. For full security, we rely on the fact 
    // that this input is not saved to history.
    process.stdout.write(query);
    
    // Simple handler to close RL on enter
    rl.on('line', (line) => {
      // Clear the line to remove the visible password if possible
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
      rl.close();
      resolve(line);
    });
  });
}

async function startServer() {
  // 1. Wait for database managers to initialize
  logger.info('Initializing database managers...');
  await Promise.all([
    positionManager.waitForReady(),
    limitOrderManager.waitForReady(),
    dcaOrderManager.waitForReady(),
    pendingSellsManager.waitForReady()
  ]);
  logger.info('✅ Database managers initialized');

  // Check for encrypted wallet
  const walletPath = getWalletPath();
  if (fs.existsSync(walletPath) && !process.env.WALLET_PASSWORD && !process.env.WALLET_PRIVATE_KEY) {
    console.log('\n🔒 Encrypted wallet found, but no password provided.');
    console.log('⚠️  Server starting in LOCKED mode. Please unlock via API or UI.');
    // const password = await askPassword('🔑 Please enter your wallet password: ');
    // process.env.WALLET_PASSWORD = password;
    // console.log('\n✅ Password received. Starting server...\n');
  }

  // Add chart API routes
  app.use('/api/chart', chartRouter);

  // Add tax API routes
  app.use('/api/tax', taxRouter);

  // Get port from environment or default to 3001
  const PORT = process.env.PORT || 3001;

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize WebSocket server
  const wsManager = new WebSocketManager(server);

  // Start server
  server.listen(PORT, () => {
    logger.info(`🚀 Solana Trading Bot API started`);
    logger.info(`   HTTP: http://localhost:${PORT}`);
    logger.info(`   WebSocket: ws://localhost:${PORT}/ws`);
    logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`   RPC: ${maskUrl(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com')}`);

    // Check wallet status
    const { getWalletKeypair } = require('./utils/blockchain.util');
    const wallet = getWalletKeypair();
    if (wallet) {
      logger.info(`✅ Server wallet configured: ${wallet.publicKey.toString().slice(0, 8)}...`);
    } else {
      logger.warn(`⚠️  No server wallet configured - automated trading disabled`);
    }

    // Start limit order executor
    logger.info(`🎯 Starting limit order executor...`);
    limitOrderExecutor.start();

    // Start DCA executor
    logger.info(`📊 Starting DCA executor...`);
    dcaExecutor.start();
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Received kill signal, shutting down gracefully');
    limitOrderExecutor.stop();
    dcaExecutor.stop();
    wsManager.close();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { server, wsManager };
}

// Start the application
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});