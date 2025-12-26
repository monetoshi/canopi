/**
 * Limit Order Manager Tests
 * Comprehensive test suite following TDD principles
 */

import { LimitOrderManager } from '../limit-order-manager';
import { ExitStrategy } from '../../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('LimitOrderManager', () => {
  let manager: LimitOrderManager;
  const testDataFile = path.join(__dirname, '../../../data/limit-orders.json');

  const mockWalletPublicKey = '2KrVQg1GFW2Q4wsARdi5fVpsaNXVETPp15YLZCG2uKJu';
  const mockTokenMint = '8avjtjHAHFqp4g2RR9ALAGBpSTqKPZR8nRbzSTwZERA';

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Mock file system operations
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.readFileSync.mockReturnValue('[]');
    mockFs.writeFileSync.mockReturnValue(undefined);

    // Create new manager instance
    manager = new LimitOrderManager();
  });

  describe('Order Creation', () => {
    test('should create a new limit order with required fields', async () => {
      const order = await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        tokenSymbol: 'ZERA',
        targetPrice: 0.025,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy,
        slippageBps: 200,
        expiresIn: 60
      });

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.walletPublicKey).toBe(mockWalletPublicKey);
      expect(order.tokenMint).toBe(mockTokenMint);
      expect(order.tokenSymbol).toBe('ZERA');
      expect(order.targetPrice).toBe(0.025);
      expect(order.solAmount).toBe(0.1);
      expect(order.exitStrategy).toBe('manual');
      expect(order.slippageBps).toBe(200);
      expect(order.status).toBe('pending');
      expect(order.createdAt).toBeDefined();
      expect(order.expiresAt).toBeDefined();
    });

    test('should create order without expiration when expiresIn not provided', async () => {
      const order = await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.025,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      expect(order.expiresAt).toBeUndefined();
    });

    test('should use default slippage of 200 bps when not provided', async () => {
      const order = await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.025,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      expect(order.slippageBps).toBe(200);
    });

    test('should save order to disk after creation', async () => {
      await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.025,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('Order Retrieval', () => {
    beforeEach(async () => {
      // Create some test orders
      await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.025,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: 'DifferentToken123',
        targetPrice: 0.05,
        solAmount: 0.2,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      await manager.createOrder({
        walletPublicKey: 'DifferentWallet123',
        tokenMint: mockTokenMint,
        targetPrice: 0.03,
        solAmount: 0.15,
        exitStrategy: 'hodl1' as ExitStrategy
      });
    });

    test('should get all orders', async () => {
      const orders = manager.getAllOrders();
      expect(orders).toHaveLength(3);
    });

    test('should get orders by wallet address', async () => {
      const orders = manager.getOrdersByWallet(mockWalletPublicKey);
      expect(orders).toHaveLength(2);
      expect(orders.every(o => o.walletPublicKey === mockWalletPublicKey)).toBe(true);
    });

    test('should get pending orders for specific token', async () => {
      const orders = manager.getPendingOrdersForToken(mockTokenMint);
      expect(orders).toHaveLength(2);
      expect(orders.every(o => o.tokenMint === mockTokenMint && o.status === 'pending')).toBe(true);
    });

    test('should get order by ID', async () => {
      const createdOrder = await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.025,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      const retrievedOrder = manager.getOrder(createdOrder.id);
      expect(retrievedOrder).toBeDefined();
      expect(retrievedOrder?.id).toBe(createdOrder.id);
    });

    test('should return undefined for non-existent order ID', async () => {
      const order = manager.getOrder('non-existent-id');
      expect(order).toBeUndefined();
    });
  });

  describe('Order Status Management', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.025,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });
      orderId = order.id;
    });

    test('should update order status', async () => {
      const success = await manager.updateOrderStatus(orderId, 'executing');
      expect(success).toBe(true);

      const order = manager.getOrder(orderId);
      expect(order?.status).toBe('executing');
    });

    test('should update order status with signature', async () => {
      const signature = '5XYZabc123...';
      const success = await manager.updateOrderStatus(orderId, 'filled', signature);
      expect(success).toBe(true);

      const order = manager.getOrder(orderId);
      expect(order?.status).toBe('filled');
      expect(order?.signature).toBe(signature);
    });

    test('should mark order as executing', async () => {
      const success = await manager.markExecuting(orderId);
      expect(success).toBe(true);

      const order = manager.getOrder(orderId);
      expect(order?.status).toBe('executing');
    });

    test('should mark order as filled with signature and position mint', async () => {
      const signature = '5XYZabc123...';
      const positionMint = mockTokenMint;

      const success = await manager.markFilled(orderId, signature, positionMint);
      expect(success).toBe(true);

      const order = manager.getOrder(orderId);
      expect(order?.status).toBe('filled');
      expect(order?.signature).toBe(signature);
      expect(order?.positionMint).toBe(positionMint);
    });

    test('should return false when updating non-existent order', async () => {
      const success = await manager.updateOrderStatus('non-existent-id', 'filled');
      expect(success).toBe(false);
    });
  });

  describe('Order Cancellation', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.025,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });
      orderId = order.id;
    });

    test('should cancel pending order', async () => {
      const success = await manager.cancelOrder(orderId);
      expect(success).toBe(true);

      const order = manager.getOrder(orderId);
      expect(order?.status).toBe('cancelled');
    });

    test('should not cancel executing order', async () => {
      await manager.markExecuting(orderId);

      const success = await manager.cancelOrder(orderId);
      expect(success).toBe(false);

      const order = manager.getOrder(orderId);
      expect(order?.status).toBe('executing');
    });

    test('should return false when cancelling non-existent order', async () => {
      const success = await manager.cancelOrder('non-existent-id');
      expect(success).toBe(false);
    });
  });

  describe('Order Execution Logic', () => {
    let order: any;

    beforeEach(async () => {
      order = await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.025,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy,
        expiresIn: 60
      });
    });

    test('should execute order when current price is below target price', async () => {
      const shouldExecute = await manager.shouldExecuteOrder(order, 0.024);
      expect(shouldExecute).toBe(true);
    });

    test('should execute order when current price equals target price', async () => {
      const shouldExecute = await manager.shouldExecuteOrder(order, 0.025);
      expect(shouldExecute).toBe(true);
    });

    test('should not execute order when current price is above target price', async () => {
      const shouldExecute = await manager.shouldExecuteOrder(order, 0.026);
      expect(shouldExecute).toBe(false);
    });

    test('should not execute order that is not pending', async () => {
      await manager.markExecuting(order.id);
      const shouldExecute = await manager.shouldExecuteOrder(order, 0.024);
      expect(shouldExecute).toBe(false);
    });

    test('should not execute expired order', async () => {
      // Mock Date.now to make order expired
      const mockNow = order.expiresAt + 1000;
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const shouldExecute = await manager.shouldExecuteOrder(order, 0.024);
      expect(shouldExecute).toBe(false);

      const updatedOrder = manager.getOrder(order.id);
      expect(updatedOrder?.status).toBe('expired');
    });

    test('should get executable orders for token', async () => {
      // Create multiple orders
      await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.03,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.02,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      const executableOrders = await manager.getExecutableOrders(mockTokenMint, 0.025);

      // Should get orders with target price >= 0.025
      expect(executableOrders.length).toBeGreaterThan(0);
      expect(executableOrders.every(o => o.targetPrice >= 0.025)).toBe(true);
    });
  });

  describe('Order Cleanup', () => {
    beforeEach(async () => {
      // Create orders with different statuses
      const order1 = await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.025,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      const order2 = await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.03,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      // Mark orders with different statuses
      await manager.markFilled(order1.id, 'sig1', mockTokenMint);
      await manager.cancelOrder(order2.id);
    });

    test('should clean up old filled and cancelled orders', async () => {
      // Mock Date.now to make orders older than 7 days
      const mockNow = Date.now() + (8 * 24 * 60 * 60 * 1000);
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const removed = await manager.cleanup(7);
      expect(removed).toBeGreaterThan(0);
    });

    test('should not clean up recent orders', async () => {
      const removed = await manager.cleanup(7);
      expect(removed).toBe(0);
    });

    test('should not clean up pending orders', async () => {
      await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.025,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      const mockNow = Date.now() + (8 * 24 * 60 * 60 * 1000);
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const removed = await manager.cleanup(7);

      // Should still have the pending order
      const orders = manager.getAllOrders();
      expect(orders.some(o => o.status === 'pending')).toBe(true);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      // Create orders with various statuses
      const order1 = await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.025,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      const order2 = await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.03,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      const order3 = await manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        targetPrice: 0.02,
        solAmount: 0.1,
        exitStrategy: 'manual' as ExitStrategy
      });

      await manager.markExecuting(order1.id);
      await manager.markFilled(order2.id, 'sig1', mockTokenMint);
      // order3 remains pending
    });

    test('should return correct statistics', async () => {
      const stats = manager.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.executing).toBe(1);
      expect(stats.filled).toBe(1);
      expect(stats.cancelled).toBe(0);
      expect(stats.expired).toBe(0);
    });
  });

  describe('Data Persistence', () => {
    test('should load orders from disk on initialization', async () => {
      const mockOrders = [
        {
          id: '123',
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          targetPrice: 0.025,
          solAmount: 0.1,
          exitStrategy: 'manual',
          slippageBps: 200,
          status: 'pending',
          createdAt: Date.now()
        }
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockOrders));

      const newManager = new LimitOrderManager();
      const orders = newManager.getAllOrders();

      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe('123');
    });

    test('should handle missing data directory gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => new LimitOrderManager()).not.toThrow();
    });

    test('should handle corrupted data file gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      expect(() => new LimitOrderManager()).not.toThrow();
    });
  });
});
