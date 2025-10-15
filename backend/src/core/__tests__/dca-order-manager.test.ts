/**
 * DCA Order Manager Tests
 * Comprehensive test suite for DCA order management
 */

import { DCAOrderManager } from '../dca-order-manager';
import { ExitStrategy } from '../../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('DCAOrderManager', () => {
  let manager: DCAOrderManager;
  const testDataFile = path.join(__dirname, '../../../data/dca-orders.json');

  const mockWalletPublicKey = '2KrVQg1GFW2Q4wsARdi5fVpsaNXVETPp15YLZCG2uKJu';
  const mockTokenMint = '8avjtjHAHFqp4g2RR9ALAGBpSTqKPZR8nRbzSTwZERA';

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Mock file system operations
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.readFileSync.mockReturnValue('[]');
    mockFs.writeFileSync.mockReturnValue(undefined);

    // Create new manager instance
    manager = new DCAOrderManager();
  });

  describe('Order Creation', () => {
    test('should create a new DCA order with all required fields', () => {
      const order = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        tokenSymbol: 'ZERA',
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 10,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy,
        slippageBps: 300,
        referencePrice: 0.025
      });

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.walletPublicKey).toBe(mockWalletPublicKey);
      expect(order.tokenMint).toBe(mockTokenMint);
      expect(order.tokenSymbol).toBe('ZERA');
      expect(order.strategyType).toBe('time-based');
      expect(order.totalSolAmount).toBe(1.0);
      expect(order.numberOfBuys).toBe(10);
      expect(order.intervalMinutes).toBe(60);
      expect(order.exitStrategy).toBe('aggressive');
      expect(order.slippageBps).toBe(300);
      expect(order.currentBuy).toBe(0);
      expect(order.status).toBe('active');
      expect(order.createdAt).toBeDefined();
      expect(order.nextBuyAt).toBeDefined();
      expect(order.completedBuys).toEqual([]);
      expect(order.referencePrice).toBe(0.025);
    });

    test('should create order with default slippage when not provided', () => {
      const order = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'fixed-split',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 30,
        exitStrategy: 'hodl1' as ExitStrategy
      });

      expect(order.slippageBps).toBe(200);
    });

    test('should create price-based order with reference price', () => {
      const order = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'price-based',
        totalSolAmount: 2.0,
        numberOfBuys: 8,
        intervalMinutes: 120,
        exitStrategy: 'conservative' as ExitStrategy,
        referencePrice: 0.05
      });

      expect(order.strategyType).toBe('price-based');
      expect(order.referencePrice).toBe(0.05);
    });

    test('should set nextBuyAt to interval after creation', () => {
      const beforeCreate = Date.now();
      const intervalMinutes = 30;

      const order = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      const expectedNextBuy = beforeCreate + (intervalMinutes * 60000);
      const afterCreate = Date.now() + (intervalMinutes * 60000);

      expect(order.nextBuyAt).toBeGreaterThanOrEqual(expectedNextBuy);
      expect(order.nextBuyAt).toBeLessThanOrEqual(afterCreate);
    });

    test('should validate minimum number of buys', () => {
      expect(() => {
        manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'time-based',
          totalSolAmount: 1.0,
          numberOfBuys: 1,
          intervalMinutes: 60,
          exitStrategy: 'aggressive' as ExitStrategy
        });
      }).toThrow('Number of buys must be at least 2');
    });

    test('should validate maximum number of buys', () => {
      expect(() => {
        manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'time-based',
          totalSolAmount: 1.0,
          numberOfBuys: 101,
          intervalMinutes: 60,
          exitStrategy: 'aggressive' as ExitStrategy
        });
      }).toThrow('Number of buys cannot exceed 100');
    });

    test('should validate minimum interval', () => {
      expect(() => {
        manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'time-based',
          totalSolAmount: 1.0,
          numberOfBuys: 5,
          intervalMinutes: 0,
          exitStrategy: 'aggressive' as ExitStrategy
        });
      }).toThrow('Interval must be at least 1 minute');
    });

    test('should validate positive SOL amount', () => {
      expect(() => {
        manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'time-based',
          totalSolAmount: 0,
          numberOfBuys: 5,
          intervalMinutes: 60,
          exitStrategy: 'aggressive' as ExitStrategy
        });
      }).toThrow('Total SOL amount must be positive');
    });

    test('should save order to disk after creation', () => {
      manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('Order Retrieval', () => {
    beforeEach(() => {
      // Create test orders
      manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: 'DifferentToken123',
        strategyType: 'price-based',
        totalSolAmount: 2.0,
        numberOfBuys: 8,
        intervalMinutes: 120,
        exitStrategy: 'hodl1' as ExitStrategy,
        referencePrice: 0.05
      });

      manager.createOrder({
        walletPublicKey: 'DifferentWallet123',
        tokenMint: mockTokenMint,
        strategyType: 'fixed-split',
        totalSolAmount: 0.5,
        numberOfBuys: 4,
        intervalMinutes: 30,
        exitStrategy: 'conservative' as ExitStrategy
      });
    });

    test('should get all orders', () => {
      const orders = manager.getAllOrders();
      expect(orders).toHaveLength(3);
    });

    test('should get orders by wallet address', () => {
      const orders = manager.getOrdersByWallet(mockWalletPublicKey);
      expect(orders).toHaveLength(2);
      expect(orders.every(o => o.walletPublicKey === mockWalletPublicKey)).toBe(true);
    });

    test('should get active orders by wallet', () => {
      const orders = manager.getActiveOrdersByWallet(mockWalletPublicKey);
      expect(orders).toHaveLength(2);
      expect(orders.every(o => o.walletPublicKey === mockWalletPublicKey && o.status === 'active')).toBe(true);
    });

    test('should get order by ID', () => {
      const createdOrder = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      const retrievedOrder = manager.getOrder(createdOrder.id);
      expect(retrievedOrder).toBeDefined();
      expect(retrievedOrder?.id).toBe(createdOrder.id);
    });

    test('should return undefined for non-existent order ID', () => {
      const order = manager.getOrder('non-existent-id');
      expect(order).toBeUndefined();
    });

    test('should get all active orders', () => {
      const orders = manager.getActiveOrders();
      expect(orders).toHaveLength(3);
      expect(orders.every(o => o.status === 'active')).toBe(true);
    });
  });

  describe('Order Lifecycle Management', () => {
    let orderId: string;

    beforeEach(() => {
      const order = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });
      orderId = order.id;
    });

    test('should pause active order', () => {
      const success = manager.pauseOrder(orderId);
      expect(success).toBe(true);

      const order = manager.getOrder(orderId);
      expect(order?.status).toBe('paused');
    });

    test('should not pause non-active order', () => {
      manager.pauseOrder(orderId);
      const success = manager.pauseOrder(orderId);
      expect(success).toBe(false);
    });

    test('should resume paused order', () => {
      manager.pauseOrder(orderId);
      const success = manager.resumeOrder(orderId);
      expect(success).toBe(true);

      const order = manager.getOrder(orderId);
      expect(order?.status).toBe('active');
    });

    test('should recalculate nextBuyAt when resuming', () => {
      manager.pauseOrder(orderId);

      const beforeResume = Date.now();
      manager.resumeOrder(orderId);
      const afterResume = Date.now();

      const order = manager.getOrder(orderId);
      const expectedMin = beforeResume + (60 * 60000);
      const expectedMax = afterResume + (60 * 60000);

      expect(order?.nextBuyAt).toBeGreaterThanOrEqual(expectedMin);
      expect(order?.nextBuyAt).toBeLessThanOrEqual(expectedMax);
    });

    test('should not resume non-paused order', () => {
      const success = manager.resumeOrder(orderId);
      expect(success).toBe(false);
    });

    test('should cancel active order', () => {
      const success = manager.cancelOrder(orderId);
      expect(success).toBe(true);

      const order = manager.getOrder(orderId);
      expect(order?.status).toBe('cancelled');
    });

    test('should cancel paused order', () => {
      manager.pauseOrder(orderId);
      const success = manager.cancelOrder(orderId);
      expect(success).toBe(true);

      const order = manager.getOrder(orderId);
      expect(order?.status).toBe('cancelled');
    });

    test('should not cancel completed order', () => {
      manager.updateOrderStatus(orderId, 'completed');
      const success = manager.cancelOrder(orderId);
      expect(success).toBe(false);
    });

    test('should return false when managing non-existent order', () => {
      expect(manager.pauseOrder('non-existent')).toBe(false);
      expect(manager.resumeOrder('non-existent')).toBe(false);
      expect(manager.cancelOrder('non-existent')).toBe(false);
    });
  });

  describe('Buy Execution Tracking', () => {
    let orderId: string;

    beforeEach(() => {
      const order = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });
      orderId = order.id;
    });

    test('should record buy execution', () => {
      const execution = {
        buyNumber: 1,
        timestamp: Date.now(),
        solAmount: 0.2,
        tokenAmount: 8.0,
        price: 0.025,
        signature: '5XYZabc123...',
        positionMint: mockTokenMint
      };

      const success = manager.recordBuyExecution(orderId, execution);
      expect(success).toBe(true);

      const order = manager.getOrder(orderId);
      expect(order?.completedBuys).toHaveLength(1);
      expect(order?.completedBuys[0]).toEqual(execution);
      expect(order?.currentBuy).toBe(1);
      expect(order?.lastBuyAt).toBe(execution.timestamp);
    });

    test('should calculate next buy time after execution', () => {
      const executionTime = Date.now();
      const execution = {
        buyNumber: 1,
        timestamp: executionTime,
        solAmount: 0.2,
        tokenAmount: 8.0,
        price: 0.025,
        signature: '5XYZabc123...',
        positionMint: mockTokenMint
      };

      manager.recordBuyExecution(orderId, execution);

      const order = manager.getOrder(orderId);
      const expectedNextBuy = executionTime + (60 * 60000);
      expect(order?.nextBuyAt).toBe(expectedNextBuy);
    });

    test('should mark order as completed after all buys', () => {
      for (let i = 1; i <= 5; i++) {
        const execution = {
          buyNumber: i,
          timestamp: Date.now() + (i * 60 * 60000),
          solAmount: 0.2,
          tokenAmount: 8.0,
          price: 0.025,
          signature: `sig${i}`,
          positionMint: mockTokenMint
        };
        manager.recordBuyExecution(orderId, execution);
      }

      const order = manager.getOrder(orderId);
      expect(order?.status).toBe('completed');
      expect(order?.nextBuyAt).toBeUndefined();
      expect(order?.currentBuy).toBe(5);
    });

    test('should return false when recording to non-existent order', () => {
      const execution = {
        buyNumber: 1,
        timestamp: Date.now(),
        solAmount: 0.2,
        tokenAmount: 8.0,
        price: 0.025,
        signature: '5XYZabc123...',
        positionMint: mockTokenMint
      };

      const success = manager.recordBuyExecution('non-existent', execution);
      expect(success).toBe(false);
    });
  });

  describe('DCA Calculation Logic', () => {
    describe('Time-based DCA', () => {
      test('should calculate equal distribution for time-based strategy', () => {
        const order = manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'time-based',
          totalSolAmount: 1.0,
          numberOfBuys: 5,
          intervalMinutes: 60,
          exitStrategy: 'aggressive' as ExitStrategy
        });

        const amount = manager.calculateNextBuyAmount(order);
        expect(amount).toBe(0.2); // 1.0 / 5
      });

      test('should recalculate remaining budget after buys', () => {
        const order = manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'time-based',
          totalSolAmount: 1.0,
          numberOfBuys: 5,
          intervalMinutes: 60,
          exitStrategy: 'aggressive' as ExitStrategy
        });

        // Execute first buy
        manager.recordBuyExecution(order.id, {
          buyNumber: 1,
          timestamp: Date.now(),
          solAmount: 0.2,
          tokenAmount: 8.0,
          price: 0.025,
          signature: 'sig1',
          positionMint: mockTokenMint
        });

        const updatedOrder = manager.getOrder(order.id)!;
        const amount = manager.calculateNextBuyAmount(updatedOrder);
        expect(amount).toBe(0.2); // (1.0 - 0.2) / 4 = 0.2
      });
    });

    describe('Fixed-split DCA', () => {
      test('should calculate equal distribution for fixed-split strategy', () => {
        const order = manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'fixed-split',
          totalSolAmount: 2.0,
          numberOfBuys: 10,
          intervalMinutes: 30,
          exitStrategy: 'hodl1' as ExitStrategy
        });

        const amount = manager.calculateNextBuyAmount(order);
        expect(amount).toBe(0.2); // 2.0 / 10
      });
    });

    describe('Price-based DCA', () => {
      test('should buy more when price drops', () => {
        const order = manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'price-based',
          totalSolAmount: 1.0,
          numberOfBuys: 5,
          intervalMinutes: 60,
          exitStrategy: 'aggressive' as ExitStrategy,
          referencePrice: 0.05
        });

        // Price dropped 10% (0.05 -> 0.045)
        const amount = manager.calculateNextBuyAmount(order, 0.045);
        const baseAmount = 0.2; // 1.0 / 5
        const expectedAmount = baseAmount * 1.2; // 20% more

        expect(amount).toBeCloseTo(expectedAmount, 4);
      });

      test('should buy less when price rises', () => {
        const order = manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'price-based',
          totalSolAmount: 1.0,
          numberOfBuys: 5,
          intervalMinutes: 60,
          exitStrategy: 'aggressive' as ExitStrategy,
          referencePrice: 0.05
        });

        // Price rose 10% (0.05 -> 0.055)
        const amount = manager.calculateNextBuyAmount(order, 0.055);
        const baseAmount = 0.2; // 1.0 / 5
        const expectedAmount = baseAmount * 0.8; // 20% less

        expect(amount).toBeCloseTo(expectedAmount, 4);
      });

      test('should clamp adjustment to 50% minimum', () => {
        const order = manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'price-based',
          totalSolAmount: 1.0,
          numberOfBuys: 5,
          intervalMinutes: 60,
          exitStrategy: 'aggressive' as ExitStrategy,
          referencePrice: 0.05
        });

        // Price rose 50% (extreme case)
        const amount = manager.calculateNextBuyAmount(order, 0.075);
        const baseAmount = 0.2;
        const minAmount = baseAmount * 0.5; // Clamped to 50%

        expect(amount).toBeCloseTo(minAmount, 4);
      });

      test('should clamp adjustment to 200% maximum', () => {
        const order = manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'price-based',
          totalSolAmount: 1.0,
          numberOfBuys: 5,
          intervalMinutes: 60,
          exitStrategy: 'aggressive' as ExitStrategy,
          referencePrice: 0.05
        });

        // Price dropped 50% (extreme case)
        const amount = manager.calculateNextBuyAmount(order, 0.025);
        const baseAmount = 0.2;
        const maxAmount = baseAmount * 2.0; // Clamped to 200%

        expect(amount).toBeCloseTo(maxAmount, 4);
      });

      test('should fallback to equal distribution when no price data', () => {
        const order = manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'price-based',
          totalSolAmount: 1.0,
          numberOfBuys: 5,
          intervalMinutes: 60,
          exitStrategy: 'aggressive' as ExitStrategy,
          referencePrice: 0.05
        });

        // No current price provided
        const amount = manager.calculateNextBuyAmount(order);
        expect(amount).toBe(0.2); // Equal distribution
      });

      test('should fallback to equal distribution when no reference price', () => {
        const order = manager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'price-based',
          totalSolAmount: 1.0,
          numberOfBuys: 5,
          intervalMinutes: 60,
          exitStrategy: 'aggressive' as ExitStrategy
        });

        const amount = manager.calculateNextBuyAmount(order, 0.05);
        expect(amount).toBe(0.2); // Equal distribution
      });
    });
  });

  describe('Order Execution Logic', () => {
    let order: any;

    beforeEach(() => {
      order = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });
    });

    test('should execute when time has passed', () => {
      const futureTime = order.nextBuyAt + 1000;
      const shouldExecute = manager.shouldExecuteNextBuy(order, futureTime);
      expect(shouldExecute).toBe(true);
    });

    test('should not execute before time', () => {
      const currentTime = order.nextBuyAt - 1000;
      const shouldExecute = manager.shouldExecuteNextBuy(order, currentTime);
      expect(shouldExecute).toBe(false);
    });

    test('should not execute paused order', () => {
      manager.pauseOrder(order.id);
      const updatedOrder = manager.getOrder(order.id)!;
      const futureTime = order.nextBuyAt + 1000;
      const shouldExecute = manager.shouldExecuteNextBuy(updatedOrder, futureTime);
      expect(shouldExecute).toBe(false);
    });

    test('should not execute completed order', () => {
      manager.updateOrderStatus(order.id, 'completed');
      const updatedOrder = manager.getOrder(order.id)!;
      const futureTime = order.nextBuyAt + 1000;
      const shouldExecute = manager.shouldExecuteNextBuy(updatedOrder, futureTime);
      expect(shouldExecute).toBe(false);
    });

    test('should not execute when all buys completed', () => {
      for (let i = 1; i <= 5; i++) {
        manager.recordBuyExecution(order.id, {
          buyNumber: i,
          timestamp: Date.now() + (i * 60 * 60000),
          solAmount: 0.2,
          tokenAmount: 8.0,
          price: 0.025,
          signature: `sig${i}`,
          positionMint: mockTokenMint
        });
      }

      const updatedOrder = manager.getOrder(order.id)!;
      const futureTime = Date.now() + (10 * 60 * 60000);
      const shouldExecute = manager.shouldExecuteNextBuy(updatedOrder, futureTime);
      expect(shouldExecute).toBe(false);
    });

    test('should get orders ready for buy', () => {
      const futureTime = order.nextBuyAt + 1000;
      jest.spyOn(Date, 'now').mockReturnValue(futureTime);

      const readyOrders = manager.getOrdersReadyForBuy();
      expect(readyOrders).toHaveLength(1);
      expect(readyOrders[0].id).toBe(order.id);
    });

    test('should not include orders not ready', () => {
      const currentTime = order.nextBuyAt - 1000;
      jest.spyOn(Date, 'now').mockReturnValue(currentTime);

      const readyOrders = manager.getOrdersReadyForBuy();
      expect(readyOrders).toHaveLength(0);
    });
  });

  describe('Helper Methods', () => {
    let orderId: string;

    beforeEach(() => {
      const order = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });
      orderId = order.id;
    });

    test('should calculate total spent', () => {
      manager.recordBuyExecution(orderId, {
        buyNumber: 1,
        timestamp: Date.now(),
        solAmount: 0.2,
        tokenAmount: 8.0,
        price: 0.025,
        signature: 'sig1',
        positionMint: mockTokenMint
      });

      manager.recordBuyExecution(orderId, {
        buyNumber: 2,
        timestamp: Date.now() + 60000,
        solAmount: 0.2,
        tokenAmount: 8.0,
        price: 0.025,
        signature: 'sig2',
        positionMint: mockTokenMint
      });

      const spent = manager.getTotalSpent(orderId);
      expect(spent).toBe(0.4);
    });

    test('should calculate remaining budget', () => {
      manager.recordBuyExecution(orderId, {
        buyNumber: 1,
        timestamp: Date.now(),
        solAmount: 0.2,
        tokenAmount: 8.0,
        price: 0.025,
        signature: 'sig1',
        positionMint: mockTokenMint
      });

      const remaining = manager.getRemainingBudget(orderId);
      expect(remaining).toBe(0.8);
    });

    test('should calculate average entry price', () => {
      manager.recordBuyExecution(orderId, {
        buyNumber: 1,
        timestamp: Date.now(),
        solAmount: 0.2,
        tokenAmount: 10.0,
        price: 0.02,
        signature: 'sig1',
        positionMint: mockTokenMint
      });

      manager.recordBuyExecution(orderId, {
        buyNumber: 2,
        timestamp: Date.now() + 60000,
        solAmount: 0.2,
        tokenAmount: 5.0,
        price: 0.04,
        signature: 'sig2',
        positionMint: mockTokenMint
      });

      const avgPrice = manager.getAverageEntryPrice(orderId);
      // Total SOL: 0.4, Total Tokens: 15, Avg: 0.4 / 15 = 0.0266...
      expect(avgPrice).toBeCloseTo(0.02666, 4);
    });

    test('should return 0 for average price with no buys', () => {
      const avgPrice = manager.getAverageEntryPrice(orderId);
      expect(avgPrice).toBe(0);
    });

    test('should calculate progress percentage', () => {
      manager.recordBuyExecution(orderId, {
        buyNumber: 1,
        timestamp: Date.now(),
        solAmount: 0.2,
        tokenAmount: 8.0,
        price: 0.025,
        signature: 'sig1',
        positionMint: mockTokenMint
      });

      manager.recordBuyExecution(orderId, {
        buyNumber: 2,
        timestamp: Date.now() + 60000,
        solAmount: 0.2,
        tokenAmount: 8.0,
        price: 0.025,
        signature: 'sig2',
        positionMint: mockTokenMint
      });

      const progress = manager.getProgress(orderId);
      expect(progress).toBe(40); // 2 / 5 = 40%
    });

    test('should calculate estimated completion time', () => {
      const order = manager.getOrder(orderId)!;
      const estimatedTime = manager.getEstimatedCompletionTime(orderId);

      // 5 buys * 60 minutes = 300 minutes from creation
      const expectedTime = order.createdAt + (5 * 60 * 60000);
      expect(estimatedTime).toBe(expectedTime);
    });

    test('should update estimated completion after buys', () => {
      const executionTime = Date.now();
      manager.recordBuyExecution(orderId, {
        buyNumber: 1,
        timestamp: executionTime,
        solAmount: 0.2,
        tokenAmount: 8.0,
        price: 0.025,
        signature: 'sig1',
        positionMint: mockTokenMint
      });

      const estimatedTime = manager.getEstimatedCompletionTime(orderId);
      // 4 remaining buys * 60 minutes from last buy
      const expectedTime = executionTime + (4 * 60 * 60000);
      expect(estimatedTime).toBe(expectedTime);
    });

    test('should return undefined for completed order', () => {
      for (let i = 1; i <= 5; i++) {
        manager.recordBuyExecution(orderId, {
          buyNumber: i,
          timestamp: Date.now() + (i * 60000),
          solAmount: 0.2,
          tokenAmount: 8.0,
          price: 0.025,
          signature: `sig${i}`,
          positionMint: mockTokenMint
        });
      }

      const estimatedTime = manager.getEstimatedCompletionTime(orderId);
      expect(estimatedTime).toBeUndefined();
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      const order1 = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      const order2 = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'price-based',
        totalSolAmount: 2.0,
        numberOfBuys: 10,
        intervalMinutes: 120,
        exitStrategy: 'hodl1' as ExitStrategy,
        referencePrice: 0.05
      });

      const order3 = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'fixed-split',
        totalSolAmount: 0.5,
        numberOfBuys: 4,
        intervalMinutes: 30,
        exitStrategy: 'conservative' as ExitStrategy
      });

      // Modify order statuses
      manager.pauseOrder(order2.id);

      // Complete order3
      for (let i = 1; i <= 4; i++) {
        manager.recordBuyExecution(order3.id, {
          buyNumber: i,
          timestamp: Date.now() + (i * 30 * 60000),
          solAmount: 0.125,
          tokenAmount: 5.0,
          price: 0.025,
          signature: `sig${i}`,
          positionMint: mockTokenMint
        });
      }
    });

    test('should return correct statistics', () => {
      const stats = manager.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(1);
      expect(stats.paused).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.cancelled).toBe(0);
      expect(stats.totalSolAllocated).toBe(3.5); // 1.0 + 2.0 + 0.5
      expect(stats.totalSolSpent).toBe(0.5); // Only order3 completed 4 * 0.125
    });

    test('should track cancelled orders', () => {
      const order = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      manager.cancelOrder(order.id);

      const stats = manager.getStatistics();
      expect(stats.cancelled).toBe(1);
    });
  });

  describe('Cleanup', () => {
    test('should clean up old completed orders', () => {
      const oldOrder = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 2,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      // Complete the order
      manager.recordBuyExecution(oldOrder.id, {
        buyNumber: 1,
        timestamp: Date.now(),
        solAmount: 0.5,
        tokenAmount: 20.0,
        price: 0.025,
        signature: 'sig1',
        positionMint: mockTokenMint
      });

      manager.recordBuyExecution(oldOrder.id, {
        buyNumber: 2,
        timestamp: Date.now() + 60000,
        solAmount: 0.5,
        tokenAmount: 20.0,
        price: 0.025,
        signature: 'sig2',
        positionMint: mockTokenMint
      });

      // Mock time 31 days in future
      const mockNow = Date.now() + (31 * 24 * 60 * 60 * 1000);
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const removed = manager.cleanup(30);
      expect(removed).toBe(1);
    });

    test('should clean up old cancelled orders', () => {
      const order = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      manager.cancelOrder(order.id);

      // Mock time 31 days in future
      const mockNow = Date.now() + (31 * 24 * 60 * 60 * 1000);
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const removed = manager.cleanup(30);
      expect(removed).toBe(1);
    });

    test('should not clean up recent orders', () => {
      manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      const removed = manager.cleanup(30);
      expect(removed).toBe(0);
    });

    test('should not clean up active orders', () => {
      manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      const mockNow = Date.now() + (31 * 24 * 60 * 60 * 1000);
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const removed = manager.cleanup(30);
      expect(removed).toBe(0);
    });

    test('should not clean up paused orders', () => {
      const order = manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      manager.pauseOrder(order.id);

      const mockNow = Date.now() + (31 * 24 * 60 * 60 * 1000);
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const removed = manager.cleanup(30);
      expect(removed).toBe(0);
    });
  });

  describe('Data Persistence', () => {
    test('should load orders from disk on initialization', () => {
      const mockOrders = [
        {
          id: '123',
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          tokenSymbol: 'ZERA',
          strategyType: 'time-based',
          totalSolAmount: 1.0,
          numberOfBuys: 5,
          intervalMinutes: 60,
          exitStrategy: 'aggressive',
          slippageBps: 200,
          currentBuy: 0,
          status: 'active',
          createdAt: Date.now(),
          nextBuyAt: Date.now() + 3600000,
          completedBuys: []
        }
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockOrders));

      const newManager = new DCAOrderManager();
      const orders = newManager.getAllOrders();

      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe('123');
    });

    test('should handle missing data directory gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => new DCAOrderManager()).not.toThrow();
    });

    test('should handle corrupted data file gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      expect(() => new DCAOrderManager()).not.toThrow();
    });

    test('should save to disk after operations', () => {
      manager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive' as ExitStrategy
      });

      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });
});
