# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Solana Trading Bot** with automated exit strategies, Phantom wallet integration, and a professional web dashboard. The bot allows users to trade SPL tokens on Solana with 6 different exit strategies ranging from aggressive (8min) to long-term HODL (weeks).

**Key Capabilities:**
- Wallet-based trading (no private keys stored - secure!)
- 6 exit strategies: aggressive, moderate, slow, utility, defi, hodl
- Real-time position tracking via WebSocket
- Jupiter DEX aggregator integration for best swap rates
- Beautiful Next.js dashboard with Phantom wallet adapter

**Tech Stack:**
- **Backend:** Node.js + TypeScript + Express + Solana Web3.js + WebSocket
- **Frontend:** Next.js 14 + React + TypeScript + Tailwind CSS
- **Blockchain:** Solana mainnet with Jupiter V6 DEX aggregator

---

## Architecture

### Backend (`backend/src/`)

The backend is a TypeScript Express API server with WebSocket support.

**Core Architecture:**
1. **API Layer** (`api/`) - REST endpoints and WebSocket server
2. **Core Logic** (`core/`) - Position management and strategy logic
3. **Services** (`services/`) - External integrations (Jupiter, price data)
4. **Utils** (`utils/`) - Helper functions and utilities
5. **Types** (`types/`) - TypeScript type definitions

**Key Components:**

- **Position Manager** (`core/position-manager.ts`): Tracks all trading positions across wallets. Uses in-memory Map storage (positions cleared on restart). Singleton pattern.

- **Strategy System** (`core/strategies.ts`): Defines 6 exit strategies with different risk/reward profiles. Each strategy has exit stages, stop loss, and max hold time. Two types: time-based (aggressive/moderate/slow) and percentage-based (utility/defi/hodl).

- **Jupiter Service** (`services/jupiter.service.ts`): Integrates with Jupiter V6 API for token swaps. Gets quotes, prepares transactions, fetches prices. Singleton pattern.

- **Price Service** (`services/price.service.ts`): Fetches and caches token prices. Uses Jupiter as primary source, DexScreener as backup. Node-cache with 30s TTL. Can generate mock OHLCV data for MVP.

- **WebSocket Manager** (`api/websocket-server.ts`): Real-time updates for positions and prices. Clients subscribe to wallets/tokens. Updates every 5 seconds with price checks and exit condition monitoring.

- **Main API** (`api/wallet-server.ts`): Express server with wallet, trading, and strategy endpoints. No authentication - relies on wallet signatures.

**Data Flow:**
1. Frontend requests transaction preparation
2. Backend fetches Jupiter quote and creates unsigned transaction
3. Frontend signs transaction with Phantom wallet
4. Backend receives signed transaction and broadcasts to Solana
5. Backend creates position and tracks via Position Manager
6. WebSocket pushes real-time updates to connected clients
7. Backend monitors positions and checks exit conditions every 5s

### Frontend (`frontend/src/`)

Next.js 14 app with App Router and TypeScript.

**Structure:**
- `app/` - Next.js App Router pages and layouts
- `components/` - React components organized by feature
- `lib/` - API client and utilities
- `types/` - TypeScript type definitions (mirrors backend types)

**Key Components:**

- **WalletProvider** (`components/wallet/WalletProvider.tsx`): Solana wallet adapter context provider. Wraps entire app. Supports Phantom wallet.

- **Dashboard** (`app/page.tsx`): Main trading interface. Shows wallet balance, positions, portfolio stats, and quick snipe form. Auto-refreshes every 10s.

- **PositionCard** (`components/trading/PositionCard.tsx`): Displays individual position with profit/loss, entry/current price, time held, and sell buttons (25%, 50%, 100%).

- **QuickSnipe** (`components/trading/QuickSnipe.tsx`): Trading form for buying tokens. Takes token mint, SOL amount, and strategy. Prepares transaction, signs with wallet, executes.

- **API Client** (`lib/api.ts`): Axios-based API wrapper. All backend endpoints accessible via typed functions.

---

## Common Development Tasks

### Building and Running

**Backend:**
```bash
cd backend
npm run dev        # Development with hot reload
npm run build      # Compile TypeScript to dist/
npm start          # Run compiled JavaScript
npm run type-check # Type checking only
```

**Frontend:**
```bash
cd frontend
npm run dev   # Development server (localhost:3000)
npm run build # Production build
npm start     # Production server
```

**Full Stack:**
1. Terminal 1: `cd backend && npm run dev` (starts on :3001)
2. Terminal 2: `cd frontend && npm run dev` (starts on :3000)
3. Open http://localhost:3000

### Testing Trading Flow

1. Ensure backend is running on :3001
2. Open frontend on :3000
3. Connect Phantom wallet (must have SOL)
4. Get a token mint address (e.g., from DexScreener)
5. Enter mint, amount (start with 0.01 SOL), select strategy
6. Click "Buy Token" and approve in Phantom
7. Watch position appear in dashboard
8. Use sell buttons to manually exit or wait for strategy

### Adding New Exit Strategy

1. Add strategy name to `ExitStrategy` type in `backend/src/types/index.ts`
2. Define strategy config in `backend/src/core/strategies.ts` in `EXIT_STRATEGIES` object
3. Add to frontend select in `frontend/src/components/trading/QuickSnipe.tsx`
4. Strategy will auto-work with position manager and exit monitoring

### Modifying Exit Conditions

Edit `checkExitConditions()` in `backend/src/core/position-manager.ts`:
- Stop loss check: Line ~145
- Max hold time check: Line ~152
- Exit stage checks: Line ~158 onwards

### Adding New API Endpoint

1. Add route to `backend/src/api/wallet-server.ts` or create new router file
2. Import and use in `backend/src/index.ts`
3. Add typed function to `frontend/src/lib/api.ts`
4. Use in components via import

### Working with WebSocket

**Backend:** Broadcast messages via `wsManager.broadcast()`, `broadcastToWallet()`, or `broadcastToToken()`

**Frontend:** Not yet implemented (future enhancement). Would use `frontend/src/lib/websocket.ts`

---

## Important Implementation Details

### Position Tracking

Positions are stored **in-memory** in a Map. Restarting the backend clears all positions. This is intentional for MVP. For production, implement persistent storage (PostgreSQL, Redis).

Position lifecycle:
1. Created on buy execution (status: 'active')
2. Updated with current price every 5s via WebSocket loop
3. Marked 'closing' when sell is initiated
4. Marked 'closed' when sell completes or all stages done

### Transaction Flow

**Buy:**
1. `prepareBuyTransaction()` - Get Jupiter quote + unsigned tx
2. Sign in Phantom wallet (frontend)
3. `executeBuyTransaction()` - Send signed tx to Solana
4. Create position in Position Manager

**Sell:**
1. `prepareSellTransaction()` - Get Jupiter quote for % of tokens
2. Sign in Phantom wallet (frontend)
3. `executeSellTransaction()` - Send signed tx to Solana
4. Update or close position based on percentage

**Security:** Backend never sees private keys. Transactions are signed client-side in Phantom.

### Price Data

Prices fetched from:
1. Jupiter Price API (primary) - `https://price.jup.ag/v4/price`
2. DexScreener (backup) - `https://api.dexscreener.com`

OHLCV data currently generates mock data. To use real data:
- Integrate Birdeye API: `https://public-api.birdeye.so`
- Or DexScreener OHLCV endpoints
- Update `getOHLCVData()` in `backend/src/services/price.service.ts`

### Caching Strategy

- Price cache: 30s TTL (node-cache)
- OHLCV cache: 60s TTL
- WebSocket updates: Every 5s
- Frontend polling: Every 10s

Adjust TTLs in:
- Backend: `backend/src/services/price.service.ts` line 20-21
- WebSocket: `backend/src/api/websocket-server.ts` line 156
- Frontend: `frontend/src/app/page.tsx` line 33

### Exit Strategy Logic

**Time-based** (aggressive/moderate/slow):
- Checks both time elapsed AND profit percent
- Must meet time threshold AND profit threshold to exit
- Example: "Sell 40% at 5min IF profit >= 50%"

**Percentage-based** (utility/defi/hodl):
- Checks ONLY profit percent (no time requirement)
- Suitable for longer holds
- Example: "Sell 20% IF profit >= 100%" (anytime)

Both types have:
- Stop loss (exits 100% if hit)
- Max hold time (force exit after time limit)

Implementation: `backend/src/core/position-manager.ts` lines 132-177

---

## Configuration

### Environment Variables

**Backend** (`.env`):
```bash
RPC_URL=https://api.mainnet-beta.solana.com  # Use Helius/QuickNode for better performance
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000        # CORS origins
```

**Frontend** (`.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com  # Optional: override default RPC
```

### Customizing Strategies

Edit `backend/src/core/strategies.ts`:
- Modify `exitStages` array to change stage timing/percentages
- Adjust `maxHoldTime` to change force-exit time
- Change `stopLossPercent` for different risk tolerance

Example - Make aggressive more aggressive:
```typescript
aggressive: {
  exitStages: [
    { timeMinutes: 1, sellPercent: 50, minProfitPercent: 20 },  // Faster, lower target
    { timeMinutes: 3, sellPercent: 50, minProfitPercent: 40 },
  ],
  maxHoldTime: 5,          // Exit everything at 5min
  stopLossPercent: -15,    // Tighter stop loss
  // ...
}
```

---

## File Structure Reference

```
trading_bot/
├── backend/
│   ├── src/
│   │   ├── core/
│   │   │   ├── strategies.ts         # 6 exit strategy configs
│   │   │   └── position-manager.ts   # Position tracking (singleton)
│   │   ├── api/
│   │   │   ├── wallet-server.ts      # Main Express API
│   │   │   ├── chart-api.ts          # Chart data endpoints
│   │   │   └── websocket-server.ts   # Real-time WebSocket
│   │   ├── services/
│   │   │   ├── jupiter.service.ts    # Jupiter DEX integration
│   │   │   └── price.service.ts      # Price fetching + caching
│   │   ├── utils/
│   │   │   ├── blockchain.util.ts    # Solana helpers
│   │   │   ├── format.util.ts        # Formatters
│   │   │   └── logger.util.ts        # Logging
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript types
│   │   └── index.ts                  # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx            # Root layout with WalletProvider
│   │   │   ├── page.tsx              # Main dashboard
│   │   │   └── globals.css           # Global styles
│   │   ├── components/
│   │   │   ├── wallet/
│   │   │   │   ├── WalletProvider.tsx       # Solana wallet context
│   │   │   │   └── WalletStatusCard.tsx     # Wallet info display
│   │   │   └── trading/
│   │   │       ├── PositionCard.tsx         # Position display + sell
│   │   │       └── QuickSnipe.tsx           # Buy form
│   │   ├── lib/
│   │   │   └── api.ts                # API client (typed)
│   │   └── types/
│   │       └── index.ts              # Frontend types (mirrors backend)
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── .env.local
│
├── docs/
│   └── API.md                        # API documentation
├── README.md                         # User documentation
└── CLAUDE.md                         # This file
```

**Key Files to Understand First:**
1. `backend/src/types/index.ts` - All type definitions
2. `backend/src/core/strategies.ts` - Exit strategy logic
3. `backend/src/core/position-manager.ts` - Position lifecycle
4. `backend/src/api/wallet-server.ts` - API endpoints
5. `frontend/src/app/page.tsx` - Main UI
6. `frontend/src/lib/api.ts` - API calls

---

## Troubleshooting Guide

### Backend won't start
- Check port 3001 is available: `lsof -i :3001`
- Verify `.env` file exists with RPC_URL
- Run `npm install` in backend folder
- Check `npm run type-check` for TS errors

### Frontend won't start
- Check port 3000 is available: `lsof -i :3000`
- Verify `.env.local` exists with API_URL
- Run `npm install` in frontend folder
- Check backend is running first

### Wallet won't connect
- Phantom extension installed?
- Try different browser
- Clear browser cache
- Check browser console for errors

### Transactions fail
- Ensure wallet has SOL for fees (0.01+ SOL)
- Verify token mint address is correct
- Try increasing slippage (edit `slippageBps` in QuickSnipe)
- Use better RPC endpoint (Helius, QuickNode)
- Check Solana network status

### Positions not updating
- Backend must be running
- WebSocket connection may be down (check browser console)
- Position tracking is in-memory (cleared on backend restart)
- Manually refresh page to fetch latest data

### Price data missing
- Jupiter API may be rate-limited
- Token might not be on Jupiter
- Check backend logs for errors
- May need to wait for cache TTL (30s)

---

## Future Enhancements

The bot is production-ready MVP but could be enhanced with:

1. **Persistent Storage**: PostgreSQL/Redis for positions (survives restarts)
2. **Chart Visualization**: Real TradingView-style charts with lightweight-charts
3. **Auto-Exit Execution**: Backend auto-sells when exit conditions met (needs wallet signing solution)
4. **Portfolio Analytics**: Performance charts, win rate, average P&L
5. **Token Scanner**: Auto-discover new tokens, rugpull detection
6. **Telegram Notifications**: Alert on trades, exits, significant profits/losses
7. **Multi-wallet**: Support multiple wallets simultaneously
8. **Advanced Orders**: Limit orders, trailing stop loss
9. **Backtesting**: Test strategies on historical data
10. **Mobile App**: React Native version

To implement any of these, maintain the current architecture:
- Backend stays API-only with WebSocket
- Frontend remains stateless (fetches from API)
- Position Manager remains the source of truth
- Use dependency injection for testability

---

## Security Considerations

This bot follows security best practices:

✅ **No Private Keys Stored**: Uses Phantom wallet adapter, keys stay in browser
✅ **Client-Side Signing**: All transactions signed in user's wallet
✅ **CORS Protection**: Configured allowed origins
✅ **Input Validation**: All inputs validated before processing
✅ **Type Safety**: Full TypeScript coverage

⚠️ **Important Notes:**
- Bot is for mainnet use - real money at risk
- No authentication layer (anyone can use API if they know URL)
- In-memory storage means positions lost on restart
- No rate limiting on API endpoints (add for production)
- WebSocket broadcasts to all clients (no per-user isolation yet)

For production deployment:
1. Add API authentication (JWT tokens)
2. Implement rate limiting (express-rate-limit)
3. Use persistent storage (PostgreSQL)
4. Add monitoring (Sentry, DataDog)
5. Deploy backend on reliable infra (Railway, Render)
6. Deploy frontend on Vercel
7. Use premium RPC (Helius, QuickNode)

---

## API Quick Reference

**Wallet:**
- `GET /api/wallet/balance/:publicKey` - Get balance
- `GET /api/wallet/positions/:publicKey` - Get positions

**Trading:**
- `POST /api/snipe/prepare` - Prepare buy
- `POST /api/snipe/execute` - Execute buy
- `POST /api/exit/prepare` - Prepare sell
- `POST /api/exit/execute` - Execute sell

**Data:**
- `GET /api/strategies` - Get all strategies
- `GET /api/chart/price/:mint` - Get price
- `GET /api/chart/ohlcv/:mint` - Get chart data
- `GET /api/stats` - Get statistics

**WebSocket:**
- `ws://localhost:3001/ws` - Real-time updates

See `docs/API.md` for full API documentation.

---

## Development Workflow

When making changes:

1. **Backend Changes:**
   - Edit TypeScript files in `backend/src/`
   - TypeScript auto-recompiles with `npm run dev`
   - Test endpoints with Postman or curl
   - Check types with `npm run type-check`

2. **Frontend Changes:**
   - Edit React components in `frontend/src/`
   - Hot reload updates browser automatically
   - Test wallet connection and transactions
   - Check browser console for errors

3. **Type Changes:**
   - Update `backend/src/types/index.ts`
   - Mirror changes in `frontend/src/types/index.ts`
   - Rebuild both backend and frontend

4. **Strategy Changes:**
   - Edit `backend/src/core/strategies.ts`
   - Restart backend to load new config
   - Test with small SOL amounts first

5. **Testing:**
   - Start backend: `cd backend && npm run dev`
   - Start frontend: `cd frontend && npm run dev`
   - Use test tokens with low value
   - Check logs in both terminal windows

---

## Additional Resources

- **Solana Web3.js**: https://solana-labs.github.io/solana-web3.js/
- **Jupiter Docs**: https://station.jup.ag/docs
- **Wallet Adapter**: https://github.com/solana-labs/wallet-adapter
- **Next.js Docs**: https://nextjs.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs

---

## Contact & Support

This bot was built as a comprehensive trading platform for Solana. Feel free to extend, modify, and improve it. The architecture is modular and designed for extensibility.

**Remember:** Always test with small amounts first! Crypto trading is risky.

Happy trading! 🚀
