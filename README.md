# Solana Trading Bot

An automated trading bot for Solana with intelligent entry and exit strategies.

## Features

### Entry Strategies
- **Instant Buy** - Execute trades immediately at market price
- **Limit Orders** - Buy when token reaches target price
- **DCA (Dollar Cost Averaging)** - Split purchases across multiple buys over time
  - Time-based: Fixed amounts at regular intervals
  - Price-based: More when price drops, less when it rises
  - Fixed-split: Equal distribution

### Exit Strategies
- **Manual Control** - Full manual control over exits
- **Fast Trading** - Scalping, Aggressive, Moderate, Slow (minutes-based)
- **HODL Strategies** - HODL 1, 2, 3, Swing (days/weeks-based)
- **Advanced** - Breakout, Trailing Stop, Grid Trading, Conservative, Take Profit, DCA Exit

### Key Features
- Real-time price monitoring via DexScreener
- Automated position tracking
- Multi-stage exit strategies with stop-loss
- Secure transaction signing (no private keys stored)
- WebSocket real-time updates
- Comprehensive test coverage (97 tests passing)

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
- Solana Wallet Adapter
- TailwindCSS
- Lucide React icons

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
git clone <repository-url>
cd trading_bot
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
```bash
# Backend (.env)
cp .env.example .env
# Add your RPC URL and other config

# Frontend (.env.local)
cp .env.local.example .env.local
# Add API URL
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
- `GET /api/dca-orders/:walletPublicKey` - Get orders by wallet
- `PUT /api/dca-orders/:orderId/pause` - Pause order
- `PUT /api/dca-orders/:orderId/resume` - Resume order
- `DELETE /api/dca-orders/:orderId` - Cancel order
- `GET /api/dca-pending-buys` - Get pending buys
- `POST /api/dca-pending-buys/execute` - Execute pending buy

### Wallet & Positions
- `GET /api/wallet/balance/:publicKey` - Get wallet balance
- `GET /api/wallet/positions/:publicKey` - Get active positions
- `GET /api/strategies` - Get all exit strategies
- `GET /api/stats` - Get trading statistics

## Security

- No private keys stored on backend
- All transactions require wallet signature
- Environment variables for sensitive config
- Data files excluded from git

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
