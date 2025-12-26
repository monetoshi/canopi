# Privacy Trading Plan: ShadowWire Integration

## Objective
Integrate **ShadowWire** (Zero-Knowledge Privacy SDK) into Canopi to enable **Private Trading**. The goal is to break the on-chain link between the user's main "Bot Wallet" and the "Ephemeral Wallets" used for executing trades, preventing observers from tracking the user's overall P&L or copy-trading their strategy.

## Core Concept: "Wash & Trade"
Since DEXs (Jupiter/Raydium) are public, we cannot "swap privately" directly. Instead, we use ShadowWire as a **Shielded Bridge**:

1.  **Shield:** Deposit SOL from Main Bot Wallet into ShadowWire Shielded Pool.
2.  **Fund:** Privately transfer SOL from the Shielded Pool to a fresh, **Ephemeral Keypair**.
3.  **Trade:** The Ephemeral Keypair executes the swap (Buy ZERA).
4.  **Hold/Sell:** The Ephemeral Keypair holds the position. When selling, it swaps back to SOL.
5.  **Wash Return (Optional):** The Ephemeral Keypair deposits the SOL back into ShadowWire, and you withdraw to a *different* clean wallet (or back to Main, though that re-links them slightly less directly).

---

## Architecture Changes

### 1. New Service: `PrivacyService`
Located in `backend/src/services/privacy.service.ts`.

**Responsibilities:**
*   **Initialize SDK:** Load ShadowWire WASM and connect to the network.
*   **Manage Shielded Balance:** Track how much SOL is currently "in the shadows".
*   **Fund Ephemeral Wallet:** Generate ZK proof and execute a private transfer to a target public key.
*   **Keypair Management:** Generate and store (securely in memory) ephemeral keypairs for single trades or sessions.

### 2. Database Schema Updates
We need to track which ephemeral wallet owns which position, as they are no longer all owned by the "Main Bot Wallet".

*   **Positions Table:** Add `owner_keypair_encrypted` (or similar) or just `owner_public_key`. The `wallet_public_key` field currently used represents the "User ID". We might need a new field `execution_wallet` to distinguish between the User (Controller) and the Wallet (Signer).
    *   *Decision:* For MVP, we can treat the Ephemeral Wallet as just another "Bot Wallet" in the system, but managed automatically.

### 3. Backend Workflow Updates

#### A. The "Private Buy" Flow (Instant/Limit/DCA)
1.  **Trigger:** User initiates "Private Buy" for 1 SOL of Token X.
2.  **Check Shielded Balance:** `PrivacyService` checks if > 1.02 SOL (trade + fees) exists in ShadowWire.
    *   *If No:* Prompt user to "Deposit to Shield" first.
3.  **Generate Ephemeral:** `PrivacyService` creates a new random Keypair (Memory only).
4.  **Fund Ephemeral:** `PrivacyService` executes `shadowWire.transfer(amount, ephemeralPubkey)`.
    *   *Latency:* Wait for confirmation (~5-10s for Proof + Block).
5.  **Execute Swap:** `JupiterService` gets quote. `EphemeralKeypair` signs the transaction.
6.  **Record Position:** Store position in DB, noting that `owner = EphemeralKeypair`.
    *   *Security:* We must save this Ephemeral Keypair securely (AES encrypted with same password) to `backend/data/ephemeral-keys.json` or DB, otherwise funds are lost on restart.

#### B. The "Private Sell" Flow
1.  **Trigger:** Exit strategy hits.
2.  **Load Key:** Load the specific Ephemeral Keypair that owns this position.
3.  **Execute Swap:** `EphemeralKeypair` signs Sell transaction (Token X -> SOL).
4.  **Reclaim Funds:** `EphemeralKeypair` deposits the resulting SOL *back* into ShadowWire (Shield).
5.  **Burn Key:** Mark Ephemeral Keypair as "Drained/Inactive".

---

## Integration Steps

### Phase 1: Setup & Deposits (The Bank)
*   [ ] Install `@radr/shadowwire` and configure `next.config.js`/`backend build` for WASM.
*   [ ] Create `PrivacyService`.
*   [ ] Add API `/api/privacy/deposit` (Main Wallet -> Shield).
*   [ ] Add API `/api/privacy/balance` (Check Shielded Balance).
*   [ ] Frontend: Add "Privacy Shield" card to Dashboard (Deposit/Withdraw UI).

### Phase 2: Ephemeral Trading (The Proxy)
*   [ ] Create `EphemeralWalletManager` to generate, encrypt, and store temporary keys.
*   [ ] Update `QuickSnipe` UI to have a "Private Trade" toggle.
*   [ ] Update `/api/bot/trade` to handle `isPrivate: true` flag:
    *   Triggers the "Fund -> Trade" sequence.

### Phase 3: Automated Privacy (The Loop)
*   [ ] Update `DCAExecutor` to support private funding for each buy interval.
*   [ ] Update `TaxService` to handle these complex flows (Cost basis tracking becomes harder across wallets).

---

## Technical Challenges & Risks

1.  **Latency:** The "Fund" step involves ZK Proof generation. This adds significant delay. **Not suitable for sniping.**
2.  **Fees:** You pay fees for the Deposit, the Transfer, and the Trade. Slightly higher cost.
3.  **Complexity:** Managing multiple private keys (one per active position) increases the risk of fund loss if keys aren't backed up properly.
4.  **WASM in Node:** Ensuring the ShadowWire WASM runs correctly in the Node.js backend environment (sometimes requires specific flags).

## Recommendation for MVP
Start with **Phase 1 (The Bank)**. Just giving the user the ability to Deposit to Shield and Withdraw to a *different* wallet manually is a huge privacy win. They can "wash" their funds manually before funding a new Bot Wallet.

**Full Automated Private Trading (Phase 2)** is a heavy lift that transforms Canopi into a Privacy-Preserving Trading Bot.
