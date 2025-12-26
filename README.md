# Canopi

<div align="center">

![Canopi Logo](frontend/public/canopi-logo.svg)

**Algorithmic trading, elevated.**

An intelligent trading bot for Solana with 16 automated exit strategies, DCA, and real-time portfolio management.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-97%20passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Mainnet-9945FF.svg)](https://solana.com/)

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Roadmap](#roadmap)

</div>

---

## Why Canopi?

Most Solana trading bots focus on **sniping new token launches**. Canopi is different:

✅ **16 Exit Strategies** - From 1-minute scalping to 30-day HODL positions
✅ **Intelligent Entry** - DCA, limit orders, and instant buys
✅ **Risk Management** - Built-in stop losses and take profit targets
✅ **Portfolio Focus** - Track all positions with real-time P&L
✅ **Secure by Design** - No private keys stored, ever

**Perfect for:** Traders who want algorithmic risk management, not just launch sniping.

---

## Features

### 🎯 16 Automated Exit Strategies

**Fast Trading (Minutes-Based):**
- **Scalping** - Ultra-fast 1-3min trades (5-15% gains, -10% stop)
- **Aggressive** - Fast exits for volatile plays (8min max, 100%+ targets, -20% stop)
- **Moderate** - Balanced exits for mid-caps (20min max, 300%+ targets, -30% stop)
- **Slow** - Patient exits for trend following (50min max, 500%+ targets, -35% stop)

**HODL Strategies (Days-Weeks):**
- **HODL 1, 2, 3** - Short/medium/long-term holds (300%-10000% targets)
- **Swing** - Multi-day trend following (5 days max, 40-200% gains)

**Advanced Strategies:**
- **Breakout** - Volume-based momentum trading
- **Trailing Stop** - Dynamic stop loss that locks in profits
- **Grid Trading** - Range trading with multiple exits
- **Conservative** - Safe exits with tight stop loss
- **Take Profit** - Profit targets only (NO stop loss - high risk)
- **DCA Exit** - Conservative exits for averaged-in positions

**Manual Control:**
- **Manual** - Full manual control, no automated exits

---

### 💰 Entry Strategies

**Instant Buy**
- Execute trades immediately at market price
- Best for time-sensitive opportunities
- Uses Jupiter aggregator for best rates

**Limit Orders**
- Set target price and buy automatically when reached
- Automated price monitoring every 30 seconds
- Configurable expiration times
- Perfect for buying dips

**DCA (Dollar Cost Averaging)**
- Split purchases across multiple buys over time
- **Time-based**: Fixed amounts at regular intervals
- **Price-based**: Buy more when price drops, less when it rises
- Supports 2-100 buys per order
- Pause/resume anytime

---

### 📊 Position Management

**Real-Time Tracking:**
- Live P&L updates via WebSocket (every 5 seconds)
- Automatic exit condition monitoring
- Position status: active → closing → closed
- Exit stage tracking for multi-stage strategies

**Portfolio Stats:**
- Total portfolio value (SOL)
- Overall profit/loss percentage
- Active vs closed position counts
- Highest profit tracking per position

**Position Controls:**
- Partial sells: 25%, 50%, 100%
- Add to position (DCA into existing positions)
- Manual exit override
- Real-time profit calculations

---

### 🔍 Token Discovery & Risk Analysis

**Advanced Risk Scoring:**
- Liquidity-based risk assessment
- Volume analysis and market cap ratios
- Holder distribution analysis
- Liquidity lock detection
- Mint/freeze authority checks

**Safety Indicators:**
- Green badges for locked liquidity
- Rug risk color coding (red/orange/yellow/green)
- High/Medium/Low/None safety levels
- Real-time holder count from Solscan

**Token Metrics:**
- 24h price change with trend visualization
- Liquidity (USD) and trading pairs
- 24h volume and market cap
- Copy mint address to clipboard
- External links to DexScreener

---

### 🛠️ Developer Features

**Comprehensive Test Coverage:**
- 97 tests passing
- Full unit test coverage for core logic
- Tested exit strategies and position management
- Integration tests for Jupiter and DexScreener APIs

**Clean Architecture:**
- TypeScript throughout (backend + frontend)
- Singleton pattern for services
- Separation of concerns (core/services/api)
- Modular strategy system
- Persistent JSON storage (upgradeable to PostgreSQL)

**API-First Design:**
- RESTful API endpoints
- WebSocket for real-time updates
- Type-safe API client
- Comprehensive error handling

---

## Quick Start

### Prerequisites

- **Node.js 18+** (20 recommended)
- **npm or yarn**
- **Solana wallet** (Phantom recommended)
- **SOL for trading** (start with 0.1-1 SOL for testing)

### Installation (5 Minutes)

1. **Clone the repository**
```bash
git clone https://github.com/jamesfredericks/solana-trading-bot.git
cd solana-trading-bot
```

2. **Install dependencies**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. **Configure environment**

**Backend** - Create `backend/.env`:
```env
# Solana RPC (REQUIRED)
RPC_URL=https://api.mainnet-beta.solana.com
# For better performance: Helius, QuickNode, or Triton RPC

# Server
PORT=3001
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

**Frontend** - Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

4. **Start the application**

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

5. **Open in browser**
- Navigate to http://localhost:3000
- Connect your Phantom wallet
- Start trading!

---

## Usage Guide

### Basic Trading Flow

1. **Connect Wallet**
   - Click "Select Wallet" in the top right
   - Choose Phantom or another Solana wallet
   - Approve the connection

2. **Find a Token**
   - Use Token Search to discover tokens
   - Review risk analysis and safety indicators
   - Check liquidity and holder distribution
   - Click "Trade" to auto-fill the trading form

3. **Execute a Trade**
   - Select entry strategy (Instant/Limit/DCA)
   - Choose exit strategy based on your goals
   - Enter SOL amount (start small: 0.01-0.1 SOL)
   - Review slippage settings
   - Click "Buy Token"
   - Approve transaction in wallet

4. **Monitor Position**
   - Position appears in "Active Positions"
   - Real-time price updates every 5 seconds
   - Watch profit/loss percentage
   - Exit stage progress shown

5. **Exit Strategy**
   - Strategy executes automatically based on rules
   - Manual override: Click 25%, 50%, or 100% sell
   - Add more SOL: Click "Add to Position"
   - Position closes when all tokens sold

### Advanced Features

**DCA Orders:**
```
1. Select "DCA" entry strategy
2. Set total SOL amount and number of buys
3. Choose interval (e.g., 60 minutes)
4. Pick DCA type:
   - Time-based: Fixed schedule
   - Price-based: Buy more on dips
5. Monitor progress in "DCA Orders" section
6. Pause/resume/cancel anytime
```

**Limit Orders:**
```
1. Select "Limit Order" entry strategy
2. Enter target price (e.g., $0.0001)
3. Set expiration time
4. Bot monitors price every 30 seconds
5. Auto-executes when price target hit
```

**Watchlist:**
```
1. Search for token
2. Click "Save to Watchlist"
3. Monitor prices in sidebar
4. One-click trade from watchlist
```

---

## Architecture

### Project Structure

```
trading_bot/
├── backend/                    # Express + TypeScript backend
│   ├── src/
│   │   ├── api/               # REST & WebSocket endpoints
│   │   │   ├── wallet-server.ts      # Main API (trades, positions, DCA, limits)
│   │   │   ├── chart-api.ts          # Price & OHLCV data
│   │   │   └── websocket-server.ts   # Real-time position updates
│   │   ├── core/              # Business logic
│   │   │   ├── strategies.ts         # 16 exit strategy definitions
│   │   │   ├── position-manager.ts   # Position lifecycle management
│   │   │   ├── dca-order-manager.ts  # DCA order tracking
│   │   │   └── limit-order-manager.ts # Limit order tracking
│   │   ├── services/          # External integrations
│   │   │   ├── jupiter.service.ts    # Jupiter DEX integration
│   │   │   ├── price.service.ts      # Price fetching + caching
│   │   │   ├── dca-executor.ts       # DCA buy execution
│   │   │   └── limit-order-executor.ts # Limit order execution
│   │   ├── types/             # TypeScript definitions
│   │   └── utils/             # Helpers (blockchain, logger, format)
│   └── data/                  # Persistent storage (JSON files)
│
└── frontend/                   # Next.js 14 + React
    ├── src/
    │   ├── app/               # Next.js app router
    │   │   ├── layout.tsx            # Root layout + WalletProvider
    │   │   └── page.tsx              # Main dashboard
    │   ├── components/
    │   │   ├── wallet/        # Wallet connection
    │   │   │   ├── WalletProvider.tsx
    │   │   │   └── WalletStatusCard.tsx
    │   │   └── trading/       # Trading interface
    │   │       ├── QuickSnipe.tsx          # Trading form
    │   │       ├── PositionCard.tsx        # Position display
    │   │       ├── TokenSearch.tsx         # Token discovery
    │   │       ├── Watchlist.tsx           # Saved tokens
    │   │       ├── DCAOrdersList.tsx       # DCA management
    │   │       └── PendingDCABuys.tsx      # DCA execution alerts
    │   └── lib/
    │       └── api.ts                      # Type-safe API client
    └── public/                # Static assets
```

### Technology Stack

**Backend:**
- Node.js 20 + TypeScript 5.0
- Express.js with WebSocket (ws)
- Jupiter Aggregator V6 (best swap rates)
- DexScreener API (price data)
- Solscan API (holder counts)
- Jest (unit testing)

**Frontend:**
- Next.js 14 (App Router)
- React 18 + TypeScript
- Solana Wallet Adapter (Phantom, Solflare, etc.)
- TailwindCSS (styling)
- Lucide React (icons)
- Axios (HTTP client)

**Blockchain:**
- Solana Web3.js
- SPL Token Program
- Jupiter Aggregator

---

## API Reference

### Core Endpoints

**Wallet & Balance:**
```
GET  /api/wallet/balance/:publicKey          # Get SOL balance
GET  /api/wallet/positions/:publicKey        # Get active positions
```

**Trading:**
```
POST /api/snipe/prepare                      # Prepare buy transaction
POST /api/snipe/execute                      # Execute signed buy
POST /api/exit/prepare                       # Prepare sell transaction
POST /api/exit/execute                       # Execute signed sell
```

**Strategies & Stats:**
```
GET  /api/strategies                         # Get all 16 exit strategies
GET  /api/stats                             # Get trading statistics
GET  /api/price/:tokenMint                  # Get current token price
```

**Limit Orders:**
```
POST   /api/limit-orders                    # Create limit order
GET    /api/limit-orders/:walletPublicKey   # Get orders by wallet
DELETE /api/limit-orders/:orderId           # Cancel order
GET    /api/limit-orders-stats              # Get limit order stats
```

**DCA Orders:**
```
POST   /api/dca-orders                      # Create DCA order
GET    /api/dca-orders/:walletPublicKey     # Get orders by wallet
GET    /api/dca-orders/order/:orderId       # Get specific order
PUT    /api/dca-orders/:orderId/pause       # Pause order
PUT    /api/dca-orders/:orderId/resume      # Resume order
DELETE /api/dca-orders/:orderId             # Cancel order
GET    /api/dca-pending-buys                # Get all pending buys
POST   /api/dca-pending-buys/execute        # Execute pending buy
GET    /api/dca-stats                       # Get DCA statistics
```

**WebSocket:**
```
ws://localhost:3001                         # Real-time position updates
```

Full API documentation: See [docs/API.md](docs/API.md)

---

## Testing

Run backend tests:
```bash
cd backend
npm test                    # Run all tests
npm test -- dca             # Run DCA tests only
npm run type-check          # TypeScript type checking
```

**Test Coverage:**
- ✅ 97 tests passing
- ✅ Position management (entry, exit, averaging)
- ✅ DCA order lifecycle (create, pause, resume, execute)
- ✅ Limit order execution
- ✅ Exit strategy logic (all 16 strategies)
- ✅ Price fetching and caching
- ✅ Jupiter integration

---

## Security

### 🔒 Security Features

**Private Keys:**
- ❌ **Never stored on backend** - Backend never has access to private keys
- ✅ **Client-side signing** - All transactions signed in browser via Phantom
- ✅ **User approval required** - Every transaction needs wallet confirmation

**Data Protection:**
- ✅ Environment variables for sensitive config (.env files)
- ✅ Position data stored locally (excluded from git)
- ✅ CORS protection with configurable origins
- ✅ Input validation and sanitization on all endpoints

**Best Practices:**
- Use premium RPC providers (Helius, QuickNode) for better reliability
- Start with small amounts (0.01-0.1 SOL) for testing
- Verify token contracts before trading (use risk analysis)
- Keep dependencies updated
- Monitor positions actively

### ⚠️ Important Disclaimers

**Trading Risks:**
- Cryptocurrency trading involves substantial risk of loss
- This bot is for educational purposes
- Past performance does not guarantee future results
- Only trade with funds you can afford to lose
- Always test strategies with small amounts first

**Smart Contract Risks:**
- Solana tokens may have malicious contracts
- Always verify token contracts before trading
- Rug pulls and scams are common - do your research
- This bot cannot protect you from malicious tokens
- Risk analysis helps but is not foolproof

**Software Disclaimer:**
- This software is provided "as is" without warranty
- The developers are not responsible for any losses
- Use at your own risk
- Not financial advice

---

## Roadmap

### ✅ Completed (v1.0)
- [x] 16 automated exit strategies
- [x] DCA (time-based and price-based)
- [x] Limit orders with auto-execution
- [x] Real-time WebSocket position updates
- [x] Token discovery with risk analysis
- [x] Watchlist functionality
- [x] Position averaging (add to position)
- [x] Persistent storage (JSON files)
- [x] 97 passing tests

### 🚧 In Progress (v1.1 - Next 2 Weeks)
- [ ] WebSocket integration on frontend (real-time UI updates)
- [ ] User-adjustable slippage tolerance
- [ ] Position charts with lightweight-charts
- [ ] Enhanced token search (debouncing, infinite scroll, sorting)

### 🎯 Near-Term (v1.2 - Weeks 3-5)
- [ ] Automatic exit execution (browser-based notifications)
- [ ] Pre-trade risk analysis (prevent rugs before buying)
- [ ] Smart DCA with RSI/volatility indicators
- [ ] Telegram notifications for trades and exits
- [ ] Mobile-responsive design improvements

### 🚀 Medium-Term (v2.0 - Weeks 6-12)
- [ ] PostgreSQL database migration
- [ ] Trading history and performance analytics
- [ ] Portfolio performance dashboard
- [ ] Strategy comparison and optimization
- [ ] Authentication and multi-user support
- [ ] API rate limiting and optimization
- [ ] Copy trading MVP (follow top traders)

### 💎 Long-Term (v3.0 - Beyond 12 Weeks)
- [ ] AI-powered token risk scoring
- [ ] Portfolio rebalancing automation
- [ ] Advanced order types (OCO, iceberg)
- [ ] Multi-asset support (token-to-token swaps)
- [ ] Tax-loss harvesting
- [ ] White-label solution for trading groups

See [docs/IMPROVEMENT_PROPOSAL.md](docs/IMPROVEMENT_PROPOSAL.md) for detailed roadmap.

---

## Documentation

- **[API Documentation](docs/API.md)** - Complete API reference
- **[CLAUDE.md](CLAUDE.md)** - Developer guide for Claude Code
- **[Improvement Proposal](docs/IMPROVEMENT_PROPOSAL.md)** - Detailed enhancement roadmap

---

## Configuration

### Recommended RPC Providers

Public RPC is rate-limited and unreliable. Use a premium provider:

**Best Options:**
1. **Helius** - https://helius.dev (Generous free tier)
2. **QuickNode** - https://quicknode.com (Fastest)
3. **Triton** - https://triton.one (Low latency)

```env
# backend/.env
RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

### Slippage Configuration

Default: 200 BPS (2%)

```typescript
// Adjust in backend/src/services/jupiter.service.ts
const slippageBps = 200; // 2% slippage tolerance

// Or per-trade in QuickSnipe component (coming in v1.1)
```

### Cache Settings

```typescript
// backend/src/services/price.service.ts
const PRICE_CACHE_TTL = 10; // seconds
const OHLCV_CACHE_TTL = 60; // seconds
```

---

## Troubleshooting

### Transaction Failures

**Problem:** Transactions fail or timeout
**Solutions:**
- Check RPC URL is working: `curl -X POST [RPC_URL] -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'`
- Ensure wallet has enough SOL for gas (keep 0.01+ SOL)
- Try increasing slippage tolerance (up to 5% for volatile tokens)
- Verify token has sufficient liquidity
- Switch to premium RPC provider (Helius, QuickNode)

### WebSocket Connection Issues

**Problem:** Real-time updates not working
**Solutions:**
- Check backend is running on port 3001: `lsof -i :3001`
- Verify CORS settings allow frontend origin
- Check firewall isn't blocking WebSocket connections
- Inspect browser console for WebSocket errors

### DCA Orders Not Executing

**Problem:** DCA buys not triggering automatically
**Solutions:**
- Ensure backend is running continuously
- Check DCA executor is processing: Look for `[DCAExecutor]` logs
- Verify wallet has sufficient balance for remaining buys
- Check order status isn't paused: `GET /api/dca-orders/:walletPublicKey`
- Manual execution: Look for pending buys in dashboard

### Price Data Issues

**Problem:** Stale or incorrect prices
**Solutions:**
- Clear price cache: `POST /api/cache/clear`
- Check DexScreener API status: https://dexscreener.com
- Test specific token: `GET /api/test/price/:mint`
- Backend logs show price source (Jupiter or DexScreener)

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Add tests** for new features
5. **Run tests**: `npm test` (ensure all pass)
6. **Commit with clear message**: `git commit -m 'Add amazing feature'`
7. **Push to branch**: `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Development Guidelines

- TypeScript everywhere (strict mode)
- Write tests for new features
- Follow existing code style
- Update documentation
- Keep commits focused and atomic

---

## Performance Benchmarks

**Backend:**
- Position update cycle: 5 seconds
- Price cache TTL: 10 seconds
- DCA check interval: 60 seconds
- Limit order check: 30 seconds

**Transaction Speed:**
- Quote fetch: <500ms (Jupiter)
- Transaction prepare: <1s
- Blockchain confirmation: 10-30s (Solana)

**Scalability:**
- Current: 100+ positions tracked simultaneously
- Memory: ~100MB backend, ~50MB frontend
- CPU: <5% on modern hardware

---

## License

MIT License - see [LICENSE](LICENSE) file for details

Copyright (c) 2025 Canopi (Monetoshi Project)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software.

---

## Acknowledgments

Built with:
- [Solana Web3.js](https://github.com/solana-labs/solana-web3.js) - Solana JavaScript SDK
- [Jupiter Aggregator](https://jup.ag) - Best swap rates on Solana
- [DexScreener API](https://dexscreener.com) - Real-time token data
- [Next.js](https://nextjs.org) - React framework
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter) - Phantom integration
- [TailwindCSS](https://tailwindcss.com) - Styling
- [Lucide React](https://lucide.dev) - Icons

Special thanks to:
- Claude Code for development assistance
- Solana community for tooling and support
- Early testers and contributors

---

## Support

**Issues & Bugs:**
- Open an issue on [GitHub Issues](https://github.com/jamesfredericks/solana-trading-bot/issues)
- Check existing issues before creating new ones

**Feature Requests:**
- Submit via [GitHub Discussions](https://github.com/jamesfredericks/solana-trading-bot/discussions)
- Vote on existing feature requests

**Questions:**
- Read the [docs/IMPROVEMENT_PROPOSAL.md](docs/IMPROVEMENT_PROPOSAL.md) for detailed explanations
- Check [Troubleshooting](#troubleshooting) section above

---

## Community

**Stay Updated:**
- ⭐ Star this repo for updates
- 👀 Watch for releases
- 🍴 Fork to contribute

**A Monetoshi Project**
- Building tools for algorithmic traders
- Open source and community-driven
- Focused on risk management, not just gains

---

<div align="center">

**Made with ❤️ for the Solana community**

[Report Bug](https://github.com/jamesfredericks/solana-trading-bot/issues) • [Request Feature](https://github.com/jamesfredericks/solana-trading-bot/discussions) • [Documentation](docs/)

</div>
