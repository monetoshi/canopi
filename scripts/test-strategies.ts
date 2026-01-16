/**
 * Strategy Test Script
 * Simulates price movements to test exit strategy logic.
 */

// Mock Types
type ExitStrategy =
    | 'aggressive'
    | 'trailing'
    | 'scalping'
    | 'moderate';

interface StrategyConfig {
    exitStages: any[];
    maxHoldTime: number;
    stopLossPercent: number;
    isPercentageBased: boolean;
    useTrailingStop?: boolean; // Proposed add
}

interface Position {
    entryPrice: number;
    entryTime: number;
    strategy: ExitStrategy;
    currentPrice: number;
    highestProfit: number;
    exitStagesCompleted: number;
}

// ------------------------------------------------------------------
// MOCK STRATEGY CONFIG (Copied/Adapted from strategies.ts)
// ------------------------------------------------------------------
const EXIT_STRATEGIES: Record<string, StrategyConfig> = {
    aggressive: {
        exitStages: [
            { timeMinutes: 2, sellPercent: 40, minProfitPercent: 30 },
            { timeMinutes: 5, sellPercent: 40, minProfitPercent: 60 },
            { timeMinutes: 8, sellPercent: 20, minProfitPercent: 100 },
        ],
        maxHoldTime: 10,
        stopLossPercent: -100, // User disabled
        isPercentageBased: false,
    },
    trailing: {
        exitStages: [
            { sellPercent: 20, minProfitPercent: 25 },
        ],
        maxHoldTime: 2880,
        stopLossPercent: -15, // Intended as trailing, currently fixed
        isPercentageBased: true,
        useTrailingStop: true, // Now strictly typed
    },
    scalping: {
        exitStages: [],
        maxHoldTime: 3,
        stopLossPercent: -10,
        isPercentageBased: false,
    }
};

// ------------------------------------------------------------------
// LOGIC UNDER TEST (Reflects current position-manager.ts logic)
// ------------------------------------------------------------------
function checkExitConditions(position: Position, currentPrice: number, strategyOverride?: StrategyConfig) {
    const strategy = strategyOverride || EXIT_STRATEGIES[position.strategy];

    // Calculate Profit
    const currentProfit = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    const timeHeld = (Date.now() - position.entryTime) / 60000;

    // 1. UPDATE HIGHEST PROFIT 
    // (In real app, this happens in updatePositionPrice, but we simulate it here to feed the check)
    if (currentProfit > position.highestProfit) {
        position.highestProfit = currentProfit;
    }

    // 2. CHECK STOP LOSS
    if (strategy.useTrailingStop) {
        const deviation = (position.highestProfit || 0) - currentProfit;
        const allowedDeviation = Math.abs(strategy.stopLossPercent);

        if (deviation >= allowedDeviation) {
            return { shouldExit: true, reason: `Trailing Stop triggered: Dropped ${deviation.toFixed(2)}% from peak` };
        }
    } else {
        // Fixed Stop Loss
        if (currentProfit <= strategy.stopLossPercent) {
            return { shouldExit: true, reason: `Stop loss triggered at ${currentProfit.toFixed(2)}%` };
        }
    }

    // 3. CHECK MAX HOLD
    if (timeHeld >= strategy.maxHoldTime) {
        return { shouldExit: true, reason: `Max hold time reached` };
    }

    return { shouldExit: false };
}

// ------------------------------------------------------------------
// TEST RUNNER
// ------------------------------------------------------------------
function runTests() {
    console.log('🧪 Starting Strategy Tests...\n');
    let passed = 0;
    let failed = 0;

    function assert(testName: string, result: boolean, msg?: string) {
        if (result) {
            console.log(`✅ [PASS] ${testName}`);
            passed++;
        } else {
            console.log(`❌ [FAIL] ${testName} - ${msg}`);
            failed++;
        }
    }

    // TEST 1: AGGRESSIVE (No Stop Loss)
    // Price drops -20%. Should NOT Exit (since SL disabled to -100)
    {
        const pos: Position = {
            entryPrice: 100, entryTime: Date.now(), strategy: 'aggressive',
            currentPrice: 100, highestProfit: 0, exitStagesCompleted: 0
        };
        const res = checkExitConditions(pos, 80); // -20%
        assert('Aggressive: Should NOT exit at -20%', !res.shouldExit, `Exited with: ${res.reason}`);
    }

    // TEST 2: SCALPING (Fixed Stop Loss)
    // Price drops -11%. Should Exit.
    {
        const pos: Position = {
            entryPrice: 100, entryTime: Date.now(), strategy: 'scalping',
            currentPrice: 100, highestProfit: 0, exitStagesCompleted: 0
        };
        const res = checkExitConditions(pos, 89); // -11%
        assert('Scalping: Should exit at -11%', res.shouldExit, 'Did not exit');
    }

    // TEST 3: TRAILING STOP (The Bug)
    // Price goes +50% -> Drops to +30%. (Drop of 20%, SL is -15).
    // Entry: 100. Peak: 150 (+50%). Current: 130 (+30%).
    // Fixed Logic: +30% > -15%. NO EXIT.
    // Trailing Logic: 150 -> 130 is > 15% drop. SHOULD EXIT.
    {
        const pos: Position = {
            entryPrice: 100, entryTime: Date.now(), strategy: 'trailing',
            currentPrice: 150, highestProfit: 50, exitStagesCompleted: 0 // Simulate peak
        };
        // Update to drop
        const res = checkExitConditions(pos, 130); // 130 is 30% profit.

        // We expect this to FAIL with current logic
        if (res.shouldExit) {
            console.log(`✅ [PASS] Trailing Stop: Exited correctly`);
            passed++;
        } else {
            console.log(`❌ [FAIL] Trailing Stop: Did NOT exit (Current Profit 30% > Fixed SL -15%). Needs Trailing Logic!`);
            failed++;
        }
    }

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
}

runTests();
