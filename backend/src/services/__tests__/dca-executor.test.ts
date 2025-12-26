/**
 * DCA Executor Tests
 * Comprehensive test suite for DCA executor service
 */

import { DCAExecutor } from '../dca-executor';
import { dcaOrderManager } from '../../core/dca-order-manager';
import { positionManager } from '../../core/position-manager';
import axios from 'axios';
import * as fs from 'fs';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// Mock fs module for persistence
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('DCAExecutor', () => {
  let executor: DCAExecutor;

  const mockWalletPublicKey = '2KrVQg1GFW2Q4wsARdi5fVpsaNXVETPp15YLZCG2uKJu';
  const mockTokenMint = '8avjtjHAHFqp4g2RR9ALAGBpSTqKPZR8nRbzSTwZERA';

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock file system operations
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.readFileSync.mockReturnValue('[]');
    mockFs.writeFileSync.mockReturnValue(undefined);

    // Create new executor instance
    executor = new DCAExecutor();

    // Clear managers
    (dcaOrderManager as any).orders.clear();
    await positionManager.clear();
  });

  afterEach(() => {
    executor.stop();
    jest.useRealTimers();
  });

  describe('Service Lifecycle', () => {
    test('should start executor', async () => {
      executor.start();
      const status = executor.getStatus();
      expect(status.isRunning).toBe(true);
    });

    test('should not start twice', async () => {
      executor.start();
      executor.start(); // Should not throw or cause issues
      const status = executor.getStatus();
      expect(status.isRunning).toBe(true);
    });

    test('should stop executor', async () => {
      executor.start();
      executor.stop();
      const status = executor.getStatus();
      expect(status.isRunning).toBe(false);
    });

    test('should check orders immediately on start', async () => {
      const checkSpy = jest.spyOn(executor as any, 'checkOrders');
      executor.start();
      expect(checkSpy).toHaveBeenCalled();
    });

    test('should check orders on interval', async () => {
      const checkSpy = jest.spyOn(executor as any, 'checkOrders');
      executor.start();

      // Advance timer
      jest.advanceTimersByTime(60000); // 1 minute
      expect(checkSpy).toHaveBeenCalledTimes(2); // Initial + interval
    });
  });

  describe('Pending Buy Creation', () => {
    beforeEach(async () => {
      // Mock price fetch
      mockAxios.get.mockResolvedValue({
        data: {
          pairs: [{
            priceUsd: '0.025',
            liquidity: { usd: '100000' }
          }]
        }
      });
    });

    test('should create pending buy for ready order', async () => {
      // Create DCA order that's ready
      const order = await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        tokenSymbol: 'ZERA',
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive',
        slippageBps: 200
      });

      // Set next buy time to past
      (order as any).nextBuyAt = Date.now() - 1000;

      // Run check
      await (executor as any).checkOrders();

      // Should have pending buy
      const pendingBuys = executor.getPendingBuys();
      expect(pendingBuys).toHaveLength(1);
      expect(pendingBuys[0].orderId).toBe(order.id);
      expect(pendingBuys[0].buyNumber).toBe(1);
      expect(pendingBuys[0].tokenMint).toBe(mockTokenMint);
      expect(pendingBuys[0].currentPrice).toBe(0.025);
    });

    test('should not create pending buy for order not ready', async () => {
      // Create DCA order that's not ready yet
      await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive'
      });

      // Run check
      await (executor as any).checkOrders();

      // Should have no pending buys
      const pendingBuys = executor.getPendingBuys();
      expect(pendingBuys).toHaveLength(0);
    });

    test('should skip order when price unavailable', async () => {
      // Mock no price data
      mockAxios.get.mockResolvedValue({
        data: { pairs: [] }
      });

      const order = await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive'
      });

      (order as any).nextBuyAt = Date.now() - 1000;

      await (executor as any).checkOrders();

      const pendingBuys = executor.getPendingBuys();
      expect(pendingBuys).toHaveLength(0);
    });

    test('should calculate correct buy amount for time-based strategy', async () => {
      const order = await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive'
      });

      (order as any).nextBuyAt = Date.now() - 1000;

      await (executor as any).checkOrders();

      const pendingBuys = executor.getPendingBuys();
      expect(pendingBuys[0].solAmount).toBe(0.2); // 1.0 / 5
    });

    test('should calculate correct buy amount for price-based strategy', async () => {
      const order = await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'price-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive',
        referencePrice: 0.05
      });

      (order as any).nextBuyAt = Date.now() - 1000;

      // Price dropped 50% (0.05 -> 0.025)
      await (executor as any).checkOrders();

      const pendingBuys = executor.getPendingBuys();
      // Should buy more when price drops
      expect(pendingBuys[0].solAmount).toBeGreaterThan(0.2);
    });
  });

  describe('Buy Execution', () => {
    let orderId: string;

    beforeEach(async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          pairs: [{
            priceUsd: '0.025',
            liquidity: { usd: '100000' }
          }]
        }
      });

      const order = await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        tokenSymbol: 'ZERA',
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive'
      });

      orderId = order.id;
      (order as any).nextBuyAt = Date.now() - 1000;

      await (executor as any).checkOrders();
    });

    test('should execute pending buy successfully', async () => {
      const success = await await executor.executeBuy(
        orderId,
        1,
        'sig123',
        40.0, // tokens received
        0.2,  // SOL spent
        0.005 // actual price
      );

      expect(success).toBe(true);

      // Should be recorded in order
      const order = dcaOrderManager.getOrder(orderId);
      expect(order?.currentBuy).toBe(1);
      expect(order?.completedBuys).toHaveLength(1);
      expect(order?.completedBuys[0].signature).toBe('sig123');
    });

    test('should create position on first buy', async () => {
      await await executor.executeBuy(
        orderId,
        1,
        'sig123',
        40.0,
        0.2,
        0.005
      );

      const position = positionManager.getPosition(mockWalletPublicKey, mockTokenMint);
      expect(position).toBeDefined();
      expect(position?.tokenAmount).toBe(40.0);
      expect(position?.solSpent).toBe(0.2);
      expect(position?.entryPrice).toBe(0.005);
    });

    test('should update position on subsequent buy', async () => {
      // First buy
      await await executor.executeBuy(orderId, 1, 'sig1', 40.0, 0.2, 0.005);

      // Create second pending buy
      const order = dcaOrderManager.getOrder(orderId)!;
      (order as any).nextBuyAt = Date.now() - 1000;
      await (executor as any).checkOrders();

      // Second buy
      await await executor.executeBuy(orderId, 2, 'sig2', 50.0, 0.2, 0.004);

      const position = positionManager.getPosition(mockWalletPublicKey, mockTokenMint);
      expect(position?.tokenAmount).toBe(90.0); // 40 + 50
      expect(position?.solSpent).toBe(0.4);     // 0.2 + 0.2
      expect(position?.entryPrice).toBeCloseTo(0.00444, 5); // avg: 0.4 / 90
    });

    test('should remove pending buy after execution', async () => {
      await await executor.executeBuy(orderId, 1, 'sig123', 40.0, 0.2, 0.005);

      const pendingBuy = executor.getPendingBuy(orderId, 1);
      expect(pendingBuy).toBeUndefined();
    });

    test('should return false for non-existent pending buy', async () => {
      const success = await await executor.executeBuy(
        'non-existent',
        1,
        'sig123',
        40.0,
        0.2,
        0.005
      );

      expect(success).toBe(false);
    });

    test('should return false for non-existent order', async () => {
      // Clear the order
      (dcaOrderManager as any).orders.clear();

      const success = await await executor.executeBuy(
        orderId,
        1,
        'sig123',
        40.0,
        0.2,
        0.005
      );

      expect(success).toBe(false);
    });
  });

  describe('Pending Buy Management', () => {
    test('should get all pending buys', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          pairs: [{
            priceUsd: '0.025',
            liquidity: { usd: '100000' }
          }]
        }
      });

      // Create multiple ready orders
      for (let i = 0; i < 3; i++) {
        const order = await dcaOrderManager.createOrder({
          walletPublicKey: mockWalletPublicKey,
          tokenMint: mockTokenMint,
          strategyType: 'time-based',
          totalSolAmount: 1.0,
          numberOfBuys: 5,
          intervalMinutes: 60,
          exitStrategy: 'aggressive'
        });
        (order as any).nextBuyAt = Date.now() - 1000;
      }

      await (executor as any).checkOrders();

      const pendingBuys = executor.getPendingBuys();
      expect(pendingBuys).toHaveLength(3);
    });

    test('should get specific pending buy', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          pairs: [{
            priceUsd: '0.025',
            liquidity: { usd: '100000' }
          }]
        }
      });

      const order = await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive'
      });
      (order as any).nextBuyAt = Date.now() - 1000;

      await (executor as any).checkOrders();

      const pendingBuy = executor.getPendingBuy(order.id, 1);
      expect(pendingBuy).toBeDefined();
      expect(pendingBuy?.orderId).toBe(order.id);
      expect(pendingBuy?.buyNumber).toBe(1);
    });

    test('should cancel pending buy', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          pairs: [{
            priceUsd: '0.025',
            liquidity: { usd: '100000' }
          }]
        }
      });

      const order = await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive'
      });
      (order as any).nextBuyAt = Date.now() - 1000;

      await (executor as any).checkOrders();

      const cancelled = executor.cancelPendingBuy(order.id, 1);
      expect(cancelled).toBe(true);

      const pendingBuy = executor.getPendingBuy(order.id, 1);
      expect(pendingBuy).toBeUndefined();
    });

    test('should return false when cancelling non-existent buy', async () => {
      const cancelled = executor.cancelPendingBuy('non-existent', 1);
      expect(cancelled).toBe(false);
    });

    test('should clean up old pending buys', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          pairs: [{
            priceUsd: '0.025',
            liquidity: { usd: '100000' }
          }]
        }
      });

      const order = await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive'
      });
      (order as any).nextBuyAt = Date.now() - 1000;

      await (executor as any).checkOrders();

      // Should have pending buy
      const pendingBuys = executor.getPendingBuys();
      expect(pendingBuys).toHaveLength(1);

      // Manually set timestamp to 2 hours ago
      const key = `${order.id}-1`;
      const pendingBuy = (executor as any).pendingBuys.get(key);
      if (pendingBuy) {
        pendingBuy.timestamp = Date.now() - (2 * 60 * 60 * 1000);
      }

      // Call cleanup directly
      (executor as any).cleanupOldPendingBuys();

      // Old pending buy should be removed
      expect(executor.getPendingBuys()).toHaveLength(0);
    });
  });

  describe('Status Reporting', () => {
    test('should return correct status when stopped', async () => {
      const status = executor.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.checkInterval).toBe(60000);
      expect(status.activeOrders).toBe(0);
      expect(status.pendingBuys).toBe(0);
    });

    test('should return correct status when running', async () => {
      executor.start();
      const status = executor.getStatus();
      expect(status.isRunning).toBe(true);
    });

    test('should report active orders count', async () => {
      await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive'
      });

      await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 2.0,
        numberOfBuys: 10,
        intervalMinutes: 120,
        exitStrategy: 'hodl1'
      });

      const status = executor.getStatus();
      expect(status.activeOrders).toBe(2);
    });

    test('should report pending buys with details', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          pairs: [{
            priceUsd: '0.025',
            liquidity: { usd: '100000' }
          }]
        }
      });

      const order = await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        tokenSymbol: 'ZERA',
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive'
      });
      (order as any).nextBuyAt = Date.now() - 1000;

      await (executor as any).checkOrders();

      const status = executor.getStatus();
      expect(status.pendingBuys).toBe(1);
      expect(status.pendingBuysList).toHaveLength(1);
      expect(status.pendingBuysList[0].token).toBe('ZERA');
      expect(status.pendingBuysList[0].buyNumber).toBe(1);
      expect(status.pendingBuysList[0].solAmount).toBe(0.2);
    });
  });

  describe('Price Fetching', () => {
    test('should fetch price from DexScreener', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          pairs: [{
            priceUsd: '0.025',
            liquidity: { usd: '100000' }
          }]
        }
      });

      const price = await (executor as any).fetchTokenPrice(mockTokenMint);
      expect(price).toBe(0.025);
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(mockTokenMint),
        expect.any(Object)
      );
    });

    test('should select pair with highest liquidity', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          pairs: [
            { priceUsd: '0.020', liquidity: { usd: '50000' } },
            { priceUsd: '0.025', liquidity: { usd: '200000' } }, // Highest
            { priceUsd: '0.022', liquidity: { usd: '100000' } }
          ]
        }
      });

      const price = await (executor as any).fetchTokenPrice(mockTokenMint);
      expect(price).toBe(0.025); // Should pick highest liquidity
    });

    test('should return null when no pairs available', async () => {
      mockAxios.get.mockResolvedValue({
        data: { pairs: [] }
      });

      const price = await (executor as any).fetchTokenPrice(mockTokenMint);
      expect(price).toBeNull();
    });

    test('should return null on API error', async () => {
      mockAxios.get.mockRejectedValue(new Error('API Error'));

      const price = await (executor as any).fetchTokenPrice(mockTokenMint);
      expect(price).toBeNull();
    });

    test('should handle invalid price data', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          pairs: [{
            priceUsd: 'invalid',
            liquidity: { usd: '100000' }
          }]
        }
      });

      const price = await (executor as any).fetchTokenPrice(mockTokenMint);
      expect(price).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should continue on price fetch error', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      const order = await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive'
      });
      (order as any).nextBuyAt = Date.now() - 1000;

      // Should not throw
      await expect((executor as any).checkOrders()).resolves.not.toThrow();
    });

    test('should handle order check errors gracefully', async () => {
      // Mock error in order checking
      jest.spyOn(dcaOrderManager, 'getOrdersReadyForBuy').mockImplementation(() => {
        throw new Error('Test error');
      });

      // Should not throw
      await expect((executor as any).checkOrders()).resolves.not.toThrow();
    });
  });

  describe('Integration with Managers', () => {
    test('should integrate with DCAOrderManager', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          pairs: [{
            priceUsd: '0.025',
            liquidity: { usd: '100000' }
          }]
        }
      });

      const order = await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive'
      });
      (order as any).nextBuyAt = Date.now() - 1000;

      // Create pending buy
      await (executor as any).checkOrders();

      // Execute the buy (manually create pending buy in case checkOrders didn't)
      const pendingBuys = executor.getPendingBuys();
      if (pendingBuys.length === 0) {
        // Manually add pending buy for test
        (executor as any).pendingBuys.set(`${order.id}-1`, {
          orderId: order.id,
          buyNumber: 1,
          tokenMint: mockTokenMint,
          solAmount: 0.2,
          currentPrice: 0.025,
          estimatedTokenAmount: 8,
          walletPublicKey: mockWalletPublicKey,
          slippageBps: 200,
          exitStrategy: 'aggressive',
          timestamp: Date.now()
        });
      }

      await await executor.executeBuy(order.id, 1, 'sig1', 40.0, 0.2, 0.005);

      // Verify integration with DCAOrderManager
      const updatedOrder = dcaOrderManager.getOrder(order.id);
      expect(updatedOrder?.currentBuy).toBe(1);
      expect(updatedOrder?.completedBuys).toHaveLength(1);
    });

    test('should integrate with PositionManager', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          pairs: [{
            priceUsd: '0.025',
            liquidity: { usd: '100000' }
          }]
        }
      });

      const order = await dcaOrderManager.createOrder({
        walletPublicKey: mockWalletPublicKey,
        tokenMint: mockTokenMint,
        strategyType: 'time-based',
        totalSolAmount: 1.0,
        numberOfBuys: 5,
        intervalMinutes: 60,
        exitStrategy: 'aggressive'
      });

      // Manually add pending buy
      (executor as any).pendingBuys.set(`${order.id}-1`, {
        orderId: order.id,
        buyNumber: 1,
        tokenMint: mockTokenMint,
        solAmount: 0.2,
        currentPrice: 0.025,
        estimatedTokenAmount: 8,
        walletPublicKey: mockWalletPublicKey,
        slippageBps: 200,
        exitStrategy: 'aggressive',
        timestamp: Date.now()
      });

      // Execute the buy
      await await executor.executeBuy(order.id, 1, 'sig1', 40.0, 0.2, 0.005);

      // Verify position created
      const allPositions = positionManager.getAllPositions();
      expect(allPositions).toHaveLength(1);
      expect(allPositions[0].mint).toBe(mockTokenMint);
      expect(allPositions[0].tokenAmount).toBe(40.0);
      expect(allPositions[0].solSpent).toBe(0.2);
    });
  });
});
