/**
 * Solana Trading Bot - Main Entry Point
 * Starts the Express server with WebSocket support
 */

import dotenv from 'dotenv';
import http from 'http';
import { app } from './api/wallet-server';
import { chartRouter } from './api/chart-api';
import { WebSocketManager } from './api/websocket-server';
import { limitOrderExecutor } from './services/limit-order-executor';
import { dcaExecutor } from './services/dca-executor';
import { logger } from './utils/logger.util';

// Load environment variables
dotenv.config();

// Add chart API routes
app.use('/api/chart', chartRouter);

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
  logger.info(`   RPC: ${process.env.RPC_URL || 'https://api.mainnet-beta.solana.com'}`);

  // Start limit order executor
  logger.info(`🎯 Starting limit order executor...`);
  limitOrderExecutor.start();

  // Start DCA executor
  logger.info(`📊 Starting DCA executor...`);
  dcaExecutor.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server...');
  limitOrderExecutor.stop();
  dcaExecutor.stop();
  wsManager.close();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, closing server...');
  limitOrderExecutor.stop();
  dcaExecutor.stop();
  wsManager.close();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Export for testing
export { server, wsManager };
