# Canopi

An automated trading bot for Solana with intelligent entry and exit strategies.

![Canopi Logo](frontend/public/canopi-logo.svg)

## Features

### Entry Strategies
- **Instant Buy** - Execute trades immediately at market price
- **Limit Orders** - Buy when token reaches target price (automated execution when price target hits)
- **DCA (Dollar Cost Averaging)** - Split purchases across multiple buys over time
  - **Time-based**: Fixed amounts at regular intervals
  - **Price-based**: More when price drops, less when it rises
  - **Fixed-split**: Equal distribution across scheduled buys

### Exit Strategies (15 Automated Strategies)

**Manual Control:**
- **Manual** - Full manual control, no automated exits

**Fast Trading (Minutes-Based):**
- **Scalping** - Ultra-fast 1-3min trades for quick 5-15% gains (tight -10% stop loss)
- **Aggressive** - Fast exits for volatile plays, 8min max, targeting 100%+ profit (-20% stop loss)
- **Moderate** - Balanced exits for mid-cap plays, 20min max, targeting 300%+ profit (-30% stop loss)
- **Slow** - Patient exits for trend following, 50min max, targeting 500%+ profit (-35% stop loss)

**HODL Strategies (Percentage-Based, Days/Weeks):**
- **HODL 1** - Short-term holds for DeFi protocols, hours-days, targeting 300%+ (-35% stop loss)
- **HODL 2** - Medium-term holds for utility tokens, days-weeks, targeting 800%+ (-40% stop loss)
- **HODL 3** - Long-term diamond hands, weeks-months, targeting 10000%+ (100x) (-50% stop loss)
- **Swing** - Multi-day trend following, 5 days max, targeting 40-200% gains (-25% stop loss)

**Advanced Strategies:**
- **Breakout** - Volume-based momentum trading, 15min max, targeting 40-150% gains (-25% stop loss)
- **Trailing** - Dynamic stop loss that locks in profits while riding trends (-15% trailing stop)
- **Grid** - Range trading with multiple 10-30% exits over 30 minutes (-20% stop loss)
- **Conservative** - Safe exits with tight -10% stop loss, targeting 10-60% gains in 15min
- **Take Profit** - Profit targets only (50-500%), NO stop loss - high risk/reward!
- **DCA Exit** - Conservative exits for averaged-in positions, targeting 20-150% over 10 days (-30% stop loss)

### Key Features
- **Real-time Price Monitoring** - DexScreener API integration with WebSocket updates
- **Automated Position Tracking** - Tracks all open positions with real-time P&L
- **Multi-stage Exit Strategies** - Graduated exits with configurable stop-loss per strategy
- **Secure Architecture** - No private keys stored on backend, all transactions require wallet signature
- **DCA Order Management** - Pause, resume, or cancel DCA orders with pending buy notifications
- **Limit Order System** - Automated limit order execution with price monitoring
- **Token Logos & Metadata** - Visual token identification with DexScreener CDN integration
- **Comprehensive Test Coverage** - 97 tests passing with full unit test coverage
- **WebSocket Real-time Updates** - Live price feeds and position updates

## Tech Stack

### Backend
- Node.js + TypeScript
- Express.js with WebSocket support
- Jupiter Aggregator for swaps
- DexScreener API for price data
- Jest for testing

### Frontend
- Next.js 14 (App Router)
- React with TypeScript
- Solana Wallet Adapter (Phantom, Solflare, etc.)
- TailwindCSS
- Lucide React icons

### Frontend Features
- **Wallet Integration** - Connect with any Solana wallet (Phantom, Solflare, etc.)
- **Quick Snipe Interface** - Instant buy with entry strategy selection (Instant/Limit/DCA)
- **Position Cards** - Live P&L tracking with token logos and manual sell options (25%, 50%, 100%)
- **DCA Order Dashboard** - View, pause, resume, or cancel active DCA orders with progress tracking
- **Pending DCA Buys** - Notification system for pending DCA buys requiring execution
- **Token Search** - Search and analyze tokens with real-time price data
- **Watchlist** - Save and monitor favorite tokens
- **Portfolio Stats** - Real-time portfolio value and performance metrics
- **Responsive Design** - Mobile-friendly interface with dark mode

## Project Structure

```
trading_bot/
├── backend/           # Express backend with trading logic
│   ├── src/
│   │   ├── api/       # REST API endpoints
│   │   ├── core/      # Core managers (positions, orders, strategies)
│   │   ├── services/  # Trading services (executors, Jupiter, price)
│   │   ├── types/     # TypeScript types
│   │   └── utils/     # Utilities (blockchain, logger)
│   └── data/          # Persistent data storage
└── frontend/          # Next.js frontend
    └── src/
        ├── app/       # Next.js app router
        ├── components/ # React components
        ├── lib/       # API client
        └── types/     # TypeScript types
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Solana wallet (Phantom recommended)

### Installation

1. Clone the repository
```bash
git clone git@github.com:jamesfredericks/solana-trading-bot.git
cd solana-trading-bot
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

4. Set up environment variables

**Backend** (`backend/.env`):
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
# Solana RPC URL (required)
RPC_URL=https://api.mainnet-beta.solana.com
# For better performance, use paid RPC: Helius, QuickNode, Triton

# Server Configuration
PORT=3001
NODE_ENV=development

# Optional: Enhanced price data
BIRDEYE_API_KEY=your_birdeye_key
DEXSCREENER_API_KEY=your_dexscreener_key

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

**Frontend** (`frontend/.env.local`):
```bash
# Create frontend/.env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > frontend/.env.local
```

### Running the Application

**Development Mode:**

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

**Production Mode:**

Backend:
```bash
cd backend
npm run build
npm start
```

Frontend:
```bash
cd frontend
npm run build
npm start
```

### Testing

Run backend tests:
```bash
cd backend
npm test
```

### Access the Application

Once both backend and frontend are running:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **WebSocket**: ws://localhost:3001

## Usage

1. **Connect Wallet** - Click "Select Wallet" and connect your Solana wallet (Phantom, Solflare, etc.)
2. **Search for Token** - Use the token search to find tokens by address or name
3. **Choose Entry Strategy**:
   - **Instant Buy**: Execute immediately at market price
   - **Limit Order**: Set a target price and buy automatically when reached
   - **DCA**: Split your buy across multiple purchases over time
4. **Select Exit Strategy** - Choose from 15 automated exit strategies based on your risk tolerance
5. **Monitor Positions** - Track your positions in real-time with live P&L updates
6. **Manage DCA Orders** - Pause, resume, or cancel active DCA orders as needed

## API Endpoints

### Trading
- `POST /api/snipe/prepare` - Prepare buy transaction
- `POST /api/snipe/execute` - Execute buy transaction
- `POST /api/exit/prepare` - Prepare sell transaction
- `POST /api/exit/execute` - Execute sell transaction

### Limit Orders
- `POST /api/limit-orders` - Create limit order
- `GET /api/limit-orders/:walletPublicKey` - Get orders by wallet
- `DELETE /api/limit-orders/:orderId` - Cancel order

### DCA Orders
- `POST /api/dca-orders` - Create DCA order
  - Body: `{ walletPublicKey, tokenMint, totalSolAmount, numberOfBuys, intervalMinutes, strategyType, exitStrategy, slippageBps }`
- `GET /api/dca-orders/:walletPublicKey` - Get orders by wallet
- `GET /api/dca-orders/order/:orderId` - Get specific order
- `PUT /api/dca-orders/:orderId/pause` - Pause order
- `PUT /api/dca-orders/:orderId/resume` - Resume order
- `DELETE /api/dca-orders/:orderId` - Cancel order
- `GET /api/dca-pending-buys` - Get all pending buys
- `GET /api/dca-pending-buys/:walletPublicKey` - Get pending buys by wallet
- `POST /api/dca-pending-buys/execute` - Execute pending buy
- `GET /api/dca-stats` - Get DCA statistics

### Wallet & Positions
- `GET /api/wallet/balance/:publicKey` - Get wallet balance (SOL balance)
- `GET /api/wallet/positions/:publicKey` - Get active positions with real-time P&L
- `GET /api/strategies` - Get all 15 exit strategies with descriptions
- `GET /api/stats` - Get trading statistics (total positions, win rate, etc.)
- `GET /api/price/:tokenMint` - Get current token price from DexScreener

### WebSocket
- `ws://localhost:3001` - Real-time price updates and position tracking
  - Subscribe to token prices
  - Real-time P&L updates
  - Order execution notifications

## Security

- **No Private Keys Stored** - Backend never has access to private keys
- **Client-Side Signing** - All transactions signed in browser via wallet
- **Environment Variables** - Sensitive config stored in .env files (not in git)
- **Data Isolation** - Position data stored locally, excluded from git
- **CORS Protection** - Configurable allowed origins
- **Input Validation** - All API inputs validated and sanitized

## Important Disclaimers

⚠️ **TRADING RISKS**
- Cryptocurrency trading involves substantial risk of loss
- This bot is provided for educational purposes
- Past performance does not guarantee future results
- Only trade with funds you can afford to lose
- Always test with small amounts first

⚠️ **SMART CONTRACT RISKS**
- Solana tokens may have malicious contracts
- Always verify token contracts before trading
- Rug pulls and scams are common - do your research
- This bot cannot protect you from malicious tokens

⚠️ **SOFTWARE DISCLAIMER**
- This software is provided "as is" without warranty
- The developers are not responsible for any losses
- Use at your own risk
- Not financial advice

## Recommended Setup

For best performance and reliability:

1. **Use a dedicated RPC provider** (Helius, QuickNode, Triton) instead of public RPC
2. **Start with small amounts** to test strategies
3. **Monitor positions actively** - automated strategies are not foolproof
4. **Set appropriate stop losses** - choose strategies with risk management
5. **Test on devnet first** if making code changes
6. **Keep dependencies updated** for security patches

## Troubleshooting

**Transaction Failures:**
- Check RPC URL is working (test with curl)
- Ensure wallet has enough SOL for gas fees
- Try increasing slippage tolerance
- Verify token has liquidity

**WebSocket Connection Issues:**
- Check backend is running on correct port
- Verify CORS settings allow frontend origin
- Check firewall isn't blocking WebSocket connections

**DCA Orders Not Executing:**
- Ensure backend is running continuously
- Check DCA executor is processing orders (check logs)
- Verify wallet has sufficient balance for remaining buys

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check existing issues for solutions
- Pull requests are welcome

## Acknowledgments

Built with:
- [Solana Web3.js](https://github.com/solana-labs/solana-web3.js)
- [Jupiter Aggregator](https://jup.ag)
- [DexScreener API](https://dexscreener.com)
- [Next.js](https://nextjs.org)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
