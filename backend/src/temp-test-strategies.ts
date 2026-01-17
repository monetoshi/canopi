/**
 * Strategy Test Script (Internal Backend Version)
 * Tests ALL 15 Exit Strategies against various market conditions.
 * Run with: npx ts-node src/temp-test-strategies.ts (from backend dir)
 */

import { EXIT_STRATEGIES } from './core/strategies';
import { StrategyConfig, ExitStrategy, Position } from './types';

// Mock Logic function 
function checkExitConditions(position: Position, currentPrice: number, strategy: StrategyConfig) {
    // Calculate Profit
    const currentProfit = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    const timeHeld = (Date.now() - position.entryTime) / 60000;

    // 1. UPDATE HIGHEST PROFIT
    if (currentProfit > position.highestProfit) {
        position.highestProfit = currentProfit;
    }

    // 2. CHECK STOP LOSS
    if (strategy.useTrailingStop) {
        const deviation = (position.highestProfit || 0) - currentProfit;
        const allowedDeviation = Math.abs(strategy.stopLossPercent);
        if (deviation >= allowedDeviation) {
            return { shouldExit: true, reason: `Trailing Stop: Dropped ${deviation.toFixed(2)}% from peak` };
        }
    } else {
        // Fixed Stop Loss
        if (currentProfit <= strategy.stopLossPercent) {
            return { shouldExit: true, reason: `Fixed Stop Loss: ${currentProfit.toFixed(2)}%` };
        }
    }

    // 3. CHECK MAX HOLD
    if (timeHeld >= strategy.maxHoldTime) {
        return { shouldExit: true, reason: `Max hold time: ${timeHeld.toFixed(0)}m` };
    }

    // 4. CHECK EXIT STAGES
    const currentStage = position.exitStagesCompleted;
    if (currentStage < strategy.exitStages.length) {
        const nextStage = strategy.exitStages[currentStage];

        if (strategy.isPercentageBased) {
            if (currentProfit >= nextStage.minProfitPercent) {
                return { shouldExit: true, reason: `Stage ${currentStage + 1} (Percent): +${currentProfit.toFixed(1)}%` };
            }
        } else {
            // Time Based Stages
            if (nextStage.timeMinutes && timeHeld >= nextStage.timeMinutes) {
                if (currentProfit >= nextStage.minProfitPercent) {
                    return { shouldExit: true, reason: `Stage ${currentStage + 1} (Time+Profit): ${timeHeld.toFixed(0)}m / +${currentProfit.toFixed(1)}%` };
                }
            }
        }
    }

    return { shouldExit: false };
}

// ------------------------------------------------------------------
// TEST SUITE
// ------------------------------------------------------------------
function runTests() {
    console.log('🧪 Deep Dive Strategy Tests (15 Strategies)...\n');
    let passed = 0;
    let failed = 0;

    function test(name: string, position: Partial<Position>, price: number, shouldExit: boolean, desc: string) {
        const fullPos: Position = {
            mint: 'TEST', walletPublicKey: 'TEST', tokenAmount: 100, solSpent: 1,
            entryPrice: 100, entryTime: Date.now(), strategy: 'manual',
            highestProfit: 0, exitStagesCompleted: 0, status: 'active', isPercentageBased: false,
            ...position
        } as Position;

        const strategy = EXIT_STRATEGIES[fullPos.strategy];
        if (!strategy) { console.error(`❌ Strategy ${fullPos.strategy} not found`); return; }

        const res = checkExitConditions(fullPos, price, strategy);

        if (res.shouldExit === shouldExit) {
            // console.log(`✅ [PASS] ${name}`);
            passed++;
        } else {
            console.log(`❌ [FAIL] ${name}`);
            console.log(`   Expected Exit: ${shouldExit}, Got: ${res.shouldExit}`);
            console.log(`   Reason: ${res.reason || 'None'}`);
            console.log(`   Config: SL ${strategy.stopLossPercent}, Trailing: ${strategy.useTrailingStop}`);
            failed++;
        }
    }

    // 1. MANUAL
    test('Manual: No Auto Exit', { strategy: 'manual' }, 50, false, '-50% drop');

    // 2. AGGRESSIVE (No SL, Time Limit)
    test('Aggressive: No SL at -20%', { strategy: 'aggressive' }, 80, false, 'SL is -100');
    test('Aggressive: Time Limit 11m', { strategy: 'aggressive', entryTime: Date.now() - 11 * 60000 }, 100, true, 'Max hold 10m');

    // 3. MODERATE (-30% SL)
    test('Moderate: SL Trigger', { strategy: 'moderate' }, 69, true, '-31% < -30%');
    test('Moderate: Stage 1 (5m, +50%)', { strategy: 'moderate', entryTime: Date.now() - 5 * 60000 }, 150, true, 'Stage 1 hit');

    // 4. SLOW (-35% SL)
    test('Slow: SL Trigger', { strategy: 'slow' }, 64, true, '-36% < -35%');

    // 5. HODL 1 (-35% SL)
    test('HODL1: Percentage Stage', { strategy: 'hodl1' }, 130, true, '+30% triggers stage 1 immediately');

    // 6. HODL 2 (-40% SL)
    test('HODL2: SL Trigger', { strategy: 'hodl2' }, 59, true, '-41% < -40%');

    // 7. HODL 3 (-50% SL)
    test('HODL3: Safe at -40%', { strategy: 'hodl3' }, 60, false, '-40% > -50%');

    // 8. SCALPING (Trailing Stop -10%)
    // Peak: 105 (+5%). Current 94 (-6%). Deviation = 11%. SL is 10%. SHOULD EXIT.
    test('Scalping: Trailing Stop', { strategy: 'scalping', highestProfit: 5 }, 94, true, 'Dropped 11% from peak');

    // 9. SWING (-25% SL)
    test('Swing: SL Trigger', { strategy: 'swing' }, 74, true, '-26% < -25%');

    // 10. BREAKOUT (Trailing -25%)
    test('Breakout: Trailing Check', { strategy: 'breakout', highestProfit: 50 }, 120, true, 'Peak +50. Drop is 30. 30 > 25. Exit.');

    // 11. TRAILING (-15% Trailing)
    test('Trailing: Dynamic', { strategy: 'trailing', highestProfit: 50 }, 130, true, '50 profit -> 30 profit = 20 dev > 15 allowed.');

    // 12. GRID (-20% SL)
    test('Grid: SL Trigger', { strategy: 'grid' }, 79, true, '-21% < -20%');

    // 13. CONSERVATIVE (-10% Trailing)
    // NOW CHANGED TO TRAILING! 
    // Scenario: Peak +20%. Drop to +5% (15% drop). SL is 10%. SHOULD EXIT.
    test('Conservative: Trailing Check', { strategy: 'conservative', highestProfit: 20 }, 105, true, 'Peak 20, Current 5. Dev 15. > 10. Exit.');

    // 14. TAKE PROFIT (No SL)
    test('TakeProfit: Safe at -90%', { strategy: 'takeProfit' }, 10, false, 'No SL');
    test('TakeProfit: Target Hit', { strategy: 'takeProfit' }, 150, true, '+50% hit');

    // 15. DCA (-30% SL)
    test('DCA: SL Trigger', { strategy: 'dca' }, 69, true, '-31% < -30%');

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
}

runTests();
