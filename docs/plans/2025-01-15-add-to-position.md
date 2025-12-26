# Add to Position Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Allow users to add more SOL to an existing position directly from the position card with a modal interface.

**Architecture:** Reuse existing buy transaction flow (`/api/snipe/prepare` and `/api/snipe/execute`) and extend PositionManager to merge new buys into existing positions by recalculating average entry price. Frontend adds a modal component and button to position cards.

**Tech Stack:**
- Backend: Node.js + TypeScript + Express
- Frontend: Next.js 14 + React + TypeScript + TailwindCSS
- Blockchain: Solana Web3.js + Jupiter Aggregator

---

## Task 1: Backend - Add Position Merging Logic

**Files:**
- Modify: `/Volumes/Data Drive/Projects/trading_bot/backend/src/core/PositionManager.ts`

**Step 1: Add addToPosition method to PositionManager**

Add this method to the PositionManager class (around line 100, after existing position methods):

```typescript
/**
 * Add to an existing position by merging a new buy
 * Recalculates average entry price and updates position totals
 */
public addToPosition(
  walletPublicKey: string,
  mint: string,
  additionalTokens: number,
  additionalSolSpent: number,
  newEntryPrice: number
): void {
  const position = this.getPosition(walletPublicKey, mint);

  if (!position) {
    throw new Error('Position not found');
  }

  if (position.status !== 'active') {
    throw new Error('Cannot add to closed position');
  }

  // Calculate new weighted average entry price
  const totalSolSpent = position.solSpent + additionalSolSpent;
  const totalTokens = position.tokenAmount + additionalTokens;
  const newAvgEntryPrice = totalSolSpent / totalTokens;

  // Update position
  position.tokenAmount = totalTokens;
  position.solSpent = totalSolSpent;
  position.entryPrice = newAvgEntryPrice;

  // Reset exit stages since position size changed
  position.exitStagesCompleted = 0;

  this.savePositions();

  logger.info(`Added to position: ${mint} - New total: ${totalTokens} tokens, Avg entry: ${newAvgEntryPrice}`);
}
```

**Step 2: Verify the change compiles**

```bash
cd "/Volumes/Data Drive/Projects/trading_bot/backend"
npm run build
```

Expected: Build succeeds with no TypeScript errors

**Step 3: Commit**

```bash
git add backend/src/core/PositionManager.ts
git commit -m "feat: add position merging logic to PositionManager"
```

---

## Task 2: Backend - Integrate Position Merging with Buy Flow

**Files:**
- Modify: `/Volumes/Data Drive/Projects/trading_bot/backend/src/api/snipe.ts`

**Step 1: Update execute endpoint to detect and merge positions**

In the `/api/snipe/execute` endpoint (around line 150), after the swap execution succeeds, add logic to check if position exists and merge:

Find this section:
```typescript
// Create position with proper strategy
positionManager.createPosition(
  walletPublicKey,
  tokenMint,
  entryPrice,
  tokenAmount,
  solAmount,
  exitStrategy
);
```

Replace with:
```typescript
// Check if position already exists
const existingPosition = positionManager.getPosition(walletPublicKey, tokenMint);

if (existingPosition && existingPosition.status === 'active') {
  // Add to existing position
  positionManager.addToPosition(
    walletPublicKey,
    tokenMint,
    tokenAmount,
    solAmount,
    entryPrice
  );
  logger.info(`Added to existing position: ${tokenMint}`);
} else {
  // Create new position
  positionManager.createPosition(
    walletPublicKey,
    tokenMint,
    entryPrice,
    tokenAmount,
    solAmount,
    exitStrategy
  );
  logger.info(`Created new position: ${tokenMint}`);
}
```

**Step 2: Verify compilation**

```bash
cd "/Volumes/Data Drive/Projects/trading_bot/backend"
npm run build
```

Expected: Build succeeds

**Step 3: Test manually with existing position**

1. Start backend: `npm run dev`
2. Use existing position from positions.json
3. Make a small buy of the same token via frontend
4. Verify position updates with new average price (check positions.json)

**Step 4: Commit**

```bash
git add backend/src/api/snipe.ts
git commit -m "feat: integrate position merging with buy flow"
```

---

## Task 3: Frontend - Create AddToPositionModal Component

**Files:**
- Create: `/Volumes/Data Drive/Projects/trading_bot/frontend/src/components/trading/AddToPositionModal.tsx`

**Step 1: Create modal component**

Create the file with this content:

```typescript
'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Position } from '@/types';
import { prepareBuyTransaction, executeBuyTransaction } from '@/lib/api';

interface AddToPositionModalProps {
  position: Position;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddToPositionModal({
  position,
  isOpen,
  onClose,
  onSuccess,
}: AddToPositionModalProps) {
  const { publicKey, signTransaction } = useWallet();
  const [solAmount, setSolAmount] = useState('0.1');
  const [slippageBps, setSlippageBps] = useState(300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddToPosition = async () => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected');
      return;
    }

    const amount = parseFloat(solAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Invalid SOL amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare transaction (uses instant buy with existing exit strategy)
      const { transaction } = await prepareBuyTransaction({
        walletPublicKey: publicKey.toString(),
        tokenMint: position.mint,
        solAmount: amount,
        slippageBps,
        buyType: 'instant',
        exitStrategy: position.exitStrategy || 'moderate',
      });

      // Sign transaction
      const signedTx = await signTransaction(transaction);

      // Execute transaction
      await executeBuyTransaction({
        signedTransaction: signedTx,
        walletPublicKey: publicKey.toString(),
      });

      // Success
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error adding to position:', err);
      setError(err.message || 'Failed to add to position');
    } finally {
      setLoading(false);
    }
  };

  // Calculate estimated new average price
  const estimatedNewCost = position.solSpent + parseFloat(solAmount || '0');
  const estimatedNewTokens = position.tokenAmount + (parseFloat(solAmount || '0') / position.currentPrice);
  const estimatedNewAvgPrice = estimatedNewCost / estimatedNewTokens;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-white mb-4">Add to Position</h3>

        {/* Current Position Info */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-400">Current Position</p>
          <p className="text-white font-semibold">
            {position.tokenAmount.toFixed(2)} tokens @ ${position.entryPrice.toFixed(4)}
          </p>
          <p className="text-sm text-gray-500">
            Total Cost: {position.solSpent.toFixed(4)} SOL
          </p>
        </div>

        {/* SOL Amount Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            SOL Amount to Add
          </label>
          <input
            type="number"
            value={solAmount}
            onChange={(e) => setSolAmount(e.target.value)}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-600"
            placeholder="0.1"
          />
        </div>

        {/* Slippage Tolerance */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Slippage Tolerance
          </label>
          <div className="flex gap-2">
            {[100, 300, 500, 1000].map((bps) => (
              <button
                key={bps}
                onClick={() => setSlippageBps(bps)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  slippageBps === bps
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {bps / 100}%
              </button>
            ))}
          </div>
        </div>

        {/* Estimated New Average */}
        {parseFloat(solAmount || '0') > 0 && (
          <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-3 mb-4">
            <p className="text-xs text-emerald-400 mb-1">Estimated New Average</p>
            <p className="text-emerald-300 font-semibold">
              ${estimatedNewAvgPrice.toFixed(4)} ({isNaN(estimatedNewAvgPrice) ? '0' : estimatedNewTokens.toFixed(2)} tokens)
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAddToPosition}
            disabled={loading || !solAmount || parseFloat(solAmount) <= 0}
            className="flex-1 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Add to Position'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

```bash
cd "/Volumes/Data Drive/Projects/trading_bot/frontend"
npm run build
```

Expected: Build succeeds with no TypeScript errors

**Step 3: Commit**

```bash
git add frontend/src/components/trading/AddToPositionModal.tsx
git commit -m "feat: create AddToPositionModal component"
```

---

## Task 4: Frontend - Integrate Modal with PositionCard

**Files:**
- Modify: `/Volumes/Data Drive/Projects/trading_bot/frontend/src/components/trading/PositionCard.tsx`

**Step 1: Import modal and add state**

At the top of PositionCard.tsx, add the import:

```typescript
import AddToPositionModal from './AddToPositionModal';
```

Inside the component function, add state for modal (around line 20):

```typescript
const [showAddModal, setShowAddModal] = useState(false);
```

**Step 2: Add "Add to Position" button**

Find the sell buttons section (around line 80-100), which looks like:

```typescript
<div className="flex gap-2">
  <button onClick={() => handleSell(25)} ...>
    Sell 25%
  </button>
  <button onClick={() => handleSell(50)} ...>
    Sell 50%
  </button>
  <button onClick={() => handleSell(100)} ...>
    Sell 100%
  </button>
</div>
```

Replace with:

```typescript
<div className="flex flex-col gap-3">
  {/* Sell Buttons */}
  <div className="flex gap-2">
    <button
      onClick={() => handleSell(25)}
      disabled={selling}
      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      Sell 25%
    </button>
    <button
      onClick={() => handleSell(50)}
      disabled={selling}
      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      Sell 50%
    </button>
    <button
      onClick={() => handleSell(100)}
      disabled={selling}
      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      Sell 100%
    </button>
  </div>

  {/* Add to Position Button */}
  <button
    onClick={() => setShowAddModal(true)}
    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
  >
    + Add to Position
  </button>
</div>
```

**Step 3: Add modal component at end of return statement**

At the end of the return statement, before the closing tag, add:

```typescript
{/* Add to Position Modal */}
<AddToPositionModal
  position={position}
  isOpen={showAddModal}
  onClose={() => setShowAddModal(false)}
  onSuccess={onSell}
/>
```

**Step 4: Test in browser**

1. Start frontend: `npm run dev`
2. Navigate to http://localhost:3000
3. Connect wallet
4. Verify "Add to Position" button appears on position card
5. Click button to open modal
6. Verify modal displays current position info
7. Test closing modal

**Step 5: Commit**

```bash
git add frontend/src/components/trading/PositionCard.tsx
git commit -m "feat: integrate Add to Position button and modal with PositionCard"
```

---

## Task 5: End-to-End Testing

**Step 1: Test complete add to position flow**

1. Ensure backend is running: `cd backend && npm run dev`
2. Ensure frontend is running: `cd frontend && npm run dev`
3. Connect wallet with small SOL balance
4. Navigate to existing position (or create one with small amount)
5. Click "Add to Position" button
6. Enter 0.1 SOL
7. Click "Add to Position"
8. Sign transaction in wallet
9. Verify success and modal closes
10. Verify position card updates with new average price and token amount
11. Check backend logs for "Added to existing position" message
12. Verify positions.json shows updated entry price and amounts

**Step 2: Test edge cases**

1. Test with 0 SOL amount (should show error)
2. Test with negative amount (should show error)
3. Test canceling modal (should close without action)
4. Test with disconnected wallet (should show error)

**Step 3: Final commit**

```bash
git add -A
git commit -m "test: verify add to position feature works end-to-end"
```

---

## Task 6: Documentation

**Files:**
- Modify: `/Volumes/Data Drive/Projects/trading_bot/README.md`

**Step 1: Add feature to README**

In the README.md "Frontend Features" section (around line 72), add:

```markdown
- **Add to Position** - Add more SOL to existing positions with average price recalculation
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Add to Position feature to README"
```

---

## Completion Checklist

- [ ] Backend PositionManager has addToPosition method
- [ ] Backend integrates position merging with buy flow
- [ ] Frontend AddToPositionModal component created
- [ ] Frontend PositionCard integrated with modal
- [ ] End-to-end testing completed successfully
- [ ] Edge cases tested (invalid amounts, disconnected wallet)
- [ ] Documentation updated
- [ ] All commits pushed to repository

## Notes

- The feature reuses existing buy transaction infrastructure
- Average entry price is calculated using weighted average: `totalCost / totalTokens`
- Exit stages are reset when adding to position since position size changed
- Modal matches existing Canopi design language (emerald/teal theme)
- Consider adding keyboard shortcut (Cmd+A) for power users in future iteration
