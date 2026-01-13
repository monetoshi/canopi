import { PositionManager } from '../position-manager';
import { Position } from '../../types';

// Mock DB
jest.mock('../../db/index', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockResolvedValue([]), // Default empty
    insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(true) }),
    update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnThis(), where: jest.fn().mockResolvedValue(true) }),
    delete: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(true) }),
  }
}));

// Mock Logger
jest.mock('../../utils/logger.util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }
}));

describe('PositionManager', () => {
  let manager: PositionManager;
  const mockWallet = 'Wallet123';
  const mockMint = 'Mint123';

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new PositionManager();
  });

  test('addToPosition should calculate weighted average correctly', async () => {
    // 1. Setup initial position
    const initialPosition: Position = {
      mint: mockMint,
      walletPublicKey: mockWallet,
      entryTime: Date.now(),
      entryPrice: 1.0,
      tokenAmount: 100,
      solSpent: 100, // 100 * 1.0
      exitStagesCompleted: 2, // Should be reset
      strategy: 'manual',
      isPercentageBased: false,
      highestProfit: 0,
      status: 'active',
      currentPrice: 1.0,
      currentProfit: 0
    };

    await manager.addPosition(initialPosition);

    // 2. Add to position
    // Adding 50 tokens at $1.50 = $75 cost
    const additionalTokens = 50;
    const additionalSolSpent = 75; // Normalized to USD/SOL logic of app, assuming solSpent tracks cost
    const newEntryPrice = 1.50;

    await manager.addToPosition(mockWallet, mockMint, additionalTokens, additionalSolSpent, newEntryPrice);

    // 3. Verify
    const updated = manager.getPosition(mockWallet, mockMint);
    expect(updated).toBeDefined();
    
    // Tokens: 100 + 50 = 150
    expect(updated?.tokenAmount).toBe(150);

    // Cost: 100 + 75 = 175
    expect(updated?.solSpent).toBe(175);

    // Avg Price: 175 / 150 = 1.1666...
    expect(updated?.entryPrice).toBeCloseTo(1.16666, 4);

    // Exit stages should be reset
    expect(updated?.exitStagesCompleted).toBe(0);
  });
});
