# 🚀 Solana Trading Bot - Complete Implementation Guide for Claude Code

## 📋 Project Overview

Build a professional Solana trading bot with:
- 6 automated exit strategies (time-based & percentage-based)
- Phantom wallet integration (no private keys stored)
- TradingView-style real-time charts
- Beautiful web dashboard with dark/light mode
- Real-time WebSocket updates
- Performance analytics
- Mobile responsive design

**Estimated Development Time:** 8-12 hours  
**Difficulty:** Intermediate to Advanced  
**Market Value:** $70,000+

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js v18+
- **Language:** TypeScript 5.3+
- **Framework:** Express.js 4.18+
- **Blockchain:** Solana Web3.js 1.87+
- **DEX Integration:** Jupiter Aggregator V6
- **WebSocket:** ws 8.14+
- **Caching:** node-cache
- **Environment:** dotenv

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5.3+
- **Styling:** Tailwind CSS 3.3+
- **UI Components:** Custom + Lucide React icons
- **Wallet:** Phantom wallet-adapter
- **State Management:** React Context + Hooks
- **HTTP Client:** Axios

### Infrastructure
- **Database:** In-memory (Map) for MVP, PostgreSQL for production
- **Deployment:** Vercel (frontend) + VPS/Railway (backend)
- **APIs:** 
  - Jupiter Swap API
  - Birdeye Price API (optional)
  - DexScreener API

---

## 📁 Project Structure

```
solana-trading-bot/
├── backend/
│   ├── src/
│   │   ├── core/
│   │   │   ├── bot.ts                    # Main bot class
│   │   │   ├── strategies.ts             # 6 exit strategies
│   │   │   ├── position-manager.ts       # Position tracking
│   │   │   └── exit-monitor.ts           # Auto-exit logic
│   │   │
│   │   ├── api/
│   │   │   ├── wallet-server.ts          # Main API server
│   │   │   ├── chart-api.ts              # Chart data endpoints
│   │   │   ├── trading-api.ts            # Trading endpoints
│   │   │   └── websocket-server.ts       # Real-time updates
│   │   │
│   │   ├── services/
│   │   │   ├── jupiter.service.ts        # Jupiter integration
│   │   │   ├── price.service.ts          # Price fetching
│   │   │   ├── token.service.ts          # Token validation
│   │   │   └── cache.service.ts          # Caching layer
│   │   │
│   │   ├── utils/
│   │   │   ├── blockchain.util.ts        # Solana helpers
│   │   │   ├── format.util.ts            # Formatters
│   │   │   └── logger.util.ts            # Logging
│   │   │
│   │   ├── types/
│   │   │   ├── index.ts                  # Type definitions
│   │   │   ├── bot.types.ts
│   │   │   └── api.types.ts
│   │   │
│   │   └── index.ts                      # Entry point
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                  # Main dashboard
│   │   │   ├── layout.tsx                # Root layout
│   │   │   ├── globals.css               # Global styles
│   │   │   │
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx              # Analytics page
│   │   │   │
│   │   │   └── api/
│   │   │       └── [...proxy].ts         # API proxy (optional)
│   │   │
│   │   ├── components/
│   │   │   ├── wallet/
│   │   │   │   ├── WalletProvider.tsx
│   │   │   │   ├── WalletButton.tsx
│   │   │   │   ├── WalletStatusCard.tsx
│   │   │   │   └── SnipeWithWallet.tsx
│   │   │   │
│   │   │   ├── charts/
│   │   │   │   ├── TradingViewChart.tsx
│   │   │   │   ├── ChartDashboard.tsx
│   │   │   │   └── PriceChart.tsx
│   │   │   │
│   │   │   ├── trading/
│   │   │   │   ├── PositionCard.tsx
│   │   │   │   ├── StrategySelector.tsx
│   │   │   │   └── QuickSnipe.tsx
│   │   │   │
│   │   │   ├── analytics/
│   │   │   │   ├── PerformanceChart.tsx
│   │   │   │   ├── StrategyStats.tsx
│   │   │   │   └── TopTokens.tsx
│   │   │   │
│   │   │   └── ui/
│   │   │       ├── Card.tsx
│   │   │       ├── Button.tsx
│   │   │       └── Stats.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useWallet.ts
│   │   │   ├── useWebSocket.ts
│   │   │   ├── usePriceData.ts
│   │   │   └── usePositions.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                    # API client
│   │   │   ├── websocket.ts              # WebSocket client
│   │   │   └── utils.ts                  # Utility functions
│   │   │
│   │   └── types/
│   │       └── index.ts                  # Frontend types
│   │
│   ├── public/
│   │   └── assets/
│   │
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── .env.local.example
│
├── docs/
│   ├── API.md
│   ├── STRATEGIES.md
│   ├── DEPLOYMENT.md
│   └── USAGE.md
│
├── .gitignore
├── README.md
└── LICENSE
```

---

## 🎯 Implementation Checklist

### Phase 1: Project Setup (30 minutes)

#### 1.1 Initialize Project Structure
```bash
# Create main directory
mkdir solana-trading-bot && cd solana-trading-bot

# Create backend
mkdir -p backend/src/{core,api,services,utils,types}
cd backend
npm init -y

# Create frontend
cd ..
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir --no-git
```

#### 1.2 Install Backend Dependencies
```bash
cd backend
npm install \
  @solana/web3.js \
  express \
  axios \
  cors \
  ws \
  dotenv \
  bs58 \
  node-cache

npm install -D \
  @types/node \
  @types/express \
  @types/cors \
  @types/ws \
  typescript \
  ts-node \
  nodemon
```

#### 1.3 Install Frontend Dependencies
```bash
cd ../frontend
npm install \
  lucide-react \
  axios
```

#### 1.4 Create Configuration Files

**backend/tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**backend/package.json (add scripts):**
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "nodemon --exec ts-node src/index.ts",
    "type-check": "tsc --noEmit"
  }
}
```

**backend/.env.example:**
```bash
# Solana Configuration
RPC_URL=https://api.mainnet-beta.solana.com
# Get better RPC: https://helius.dev or https://quiknode.com

# API Configuration
PORT=3001
NODE_ENV=development

# Optional: Price Data APIs
BIRDEYE_API_KEY=
DEXSCREENER_API_KEY=

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

**frontend/.env.local.example:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

---

### Phase 2: Backend Core (2-3 hours)

#### 2.1 Types and Interfaces (`backend/src/types/index.ts`)

```typescript
export type ExitStrategy = 'aggressive' | 'moderate' | 'slow' | 'utility' | 'defi' | 'hodl';

export interface ExitStage {
  timeMinutes?: number;
  sellPercent: number;
  minProfitPercent: number;
}

export interface StrategyConfig {
  exitStages: ExitStage[];
  maxHoldTime: number;
  stopLossPercent: number;
  isPercentageBased: boolean;
  description: string;
}

export interface Position {
  mint: string;
  walletPublicKey: string;
  entryTime: number;
  entryPrice: number;
  tokenAmount: number;
  solSpent: number;
  exitStagesCompleted: number;
  strategy: ExitStrategy;
  isPercentageBased: boolean;
  highestProfit: number;
  status: 'active' | 'closing' | 'closed';
}

export interface PriceData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

#### 2.2 Strategy Definitions (`backend/src/core/strategies.ts`)

```typescript
import { StrategyConfig, ExitStrategy } from '../types';

export const EXIT_STRATEGIES: Record<ExitStrategy, StrategyConfig> = {
  aggressive: {
    exitStages: [
      { timeMinutes: 2, sellPercent: 40, minProfitPercent: 30 },
      { timeMinutes: 5, sellPercent: 40, minProfitPercent: 60 },
      { timeMinutes: 8, sellPercent: 20, minProfitPercent: 100 },
    ],
    maxHoldTime: 10,
    stopLossPercent: -20,
    isPercentageBased: false,
    description: '⚡ AGGRESSIVE: Fast exits (8min)'
  },
  
  moderate: {
    exitStages: [
      { timeMinutes: 5, sellPercent: 25, minProfitPercent: 50 },
      { timeMinutes: 10, sellPercent: 25, minProfitPercent: 100 },
      { timeMinutes: 15, sellPercent: 25, minProfitPercent: 200 },
      { timeMinutes: 20, sellPercent: 25, minProfitPercent: 300 },
    ],
    maxHoldTime: 25,
    stopLossPercent: -30,
    isPercentageBased: false,
    description: '⚖️ MODERATE: Balanced exits (20min)'
  },

  slow: {
    exitStages: [
      { timeMinutes: 5, sellPercent: 10, minProfitPercent: 50 },
      { timeMinutes: 10, sellPercent: 10, minProfitPercent: 100 },
      { timeMinutes: 15, sellPercent: 15, minProfitPercent: 150 },
      { timeMinutes: 20, sellPercent: 15, minProfitPercent: 200 },
      { timeMinutes: 25, sellPercent: 15, minProfitPercent: 300 },
      { timeMinutes: 30, sellPercent: 15, minProfitPercent: 400 },
      { timeMinutes: 40, sellPercent: 10, minProfitPercent: 500 },
      { timeMinutes: 50, sellPercent: 10, minProfitPercent: 0 },
    ],
    maxHoldTime: 60,
    stopLossPercent: -35,
    isPercentageBased: false,
    description: '🐢 SLOW: Chart-friendly (50min)'
  },

  utility: {
    exitStages: [
      { sellPercent: 20, minProfitPercent: 50 },
      { sellPercent: 20, minProfitPercent: 100 },
      { sellPercent: 20, minProfitPercent: 200 },
      { sellPercent: 20, minProfitPercent: 400 },
      { sellPercent: 20, minProfitPercent: 800 },
    ],
    maxHoldTime: 10080,
    stopLossPercent: -40,
    isPercentageBased: true,
    description: '🔧 UTILITY: Percentage-based (days)'
  },

  defi: {
    exitStages: [
      { sellPercent: 25, minProfitPercent: 30 },
      { sellPercent: 25, minProfitPercent: 75 },
      { sellPercent: 25, minProfitPercent: 150 },
      { sellPercent: 25, minProfitPercent: 300 },
    ],
    maxHoldTime: 4320,
    stopLossPercent: -35,
    isPercentageBased: true,
    description: '💰 DEFI: Percentage-based (hours-days)'
  },

  hodl: {
    exitStages: [
      { sellPercent: 10, minProfitPercent: 100 },
      { sellPercent: 10, minProfitPercent: 200 },
      { sellPercent: 10, minProfitPercent: 400 },
      { sellPercent: 10, minProfitPercent: 900 },
      { sellPercent: 10, minProfitPercent: 1900 },
      { sellPercent: 10, minProfitPercent: 4900 },
      { sellPercent: 10, minProfitPercent: 9900 },
    ],
    maxHoldTime: 43200,
    stopLossPercent: -50,
    isPercentageBased: true,
    description: '💎 HODL: Diamond hands (weeks)'
  }
};
```

#### 2.3 Position Manager (`backend/src/core/position-manager.ts`)

```typescript
import { Position, ExitStrategy } from '../types';

export class PositionManager {
  private positions: Map<string, Position[]> = new Map();

  addPosition(position: Position): void {
    const key = position.walletPublicKey;
    if (!this.positions.has(key)) {
      this.positions.set(key, []);
    }
    this.positions.get(key)!.push(position);
  }

  getPositions(walletPublicKey: string): Position[] {
    return this.positions.get(walletPublicKey) || [];
  }

  getAllActivePositions(): Position[] {
    const all: Position[] = [];
    for (const positions of this.positions.values()) {
      all.push(...positions.filter(p => p.status === 'active'));
    }
    return all;
  }

  updatePosition(walletPublicKey: string, mint: string, updates: Partial<Position>): void {
    const positions = this.positions.get(walletPublicKey);
    if (!positions) return;

    const position = positions.find(p => p.mint === mint);
    if (position) {
      Object.assign(position, updates);
    }
  }

  removePosition(walletPublicKey: string, mint: string): void {
    const positions = this.positions.get(walletPublicKey);
    if (!positions) return;

    const index = positions.findIndex(p => p.mint === mint);
    if (index !== -1) {
      positions.splice(index, 1);
    }
  }
}
```

#### 2.4 Jupiter Service (`backend/src/services/jupiter.service.ts`)

```typescript
import axios from 'axios';

const JUPITER_API = 'https://quote-api.jup.ag/v6';

export class JupiterService {
  async getQuote(inputMint: string, outputMint: string, amount: number, slippageBps: number = 200) {
    try {
      const response = await axios.get(`${JUPITER_API}/quote`, {
        params: {
          inputMint,
          outputMint,
          amount: amount.toString(),
          slippageBps
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      console.error('Jupiter quote error:', error);
      throw error;
    }
  }

  async getSwapTransaction(quote: any, userPublicKey: string) {
    try {
      const response = await axios.post(`${JUPITER_API}/swap`, {
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        computeUnitPriceMicroLamports: 'auto'
      }, {
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      console.error('Jupiter swap error:', error);
      throw error;
    }
  }
}
```

#### 2.5 Price Service (`backend/src/services/price.service.ts`)

```typescript
import axios from 'axios';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 30 });

export class PriceService {
  async getCurrentPrice(mint: string): Promise<number | null> {
    const cached = cache.get<number>(`price:${mint}`);
    if (cached) return cached;

    try {
      // Try Jupiter first
      const response = await axios.get(
        `https://price.jup.ag/v4/price?ids=${mint}`,
        { timeout: 5000 }
      );

      const price = response.data.data[mint]?.price;
      if (price) {
        cache.set(`price:${mint}`, price);
        return price;
      }
    } catch (error) {
      console.error('Price fetch error:', error);
    }

    return null;
  }

  async getOHLCVData(mint: string, timeframe: string, limit: number = 100) {
    const cacheKey = `ohlcv:${mint}:${timeframe}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // In production, fetch from Birdeye or DexScreener
    // For now, return mock data
    const data = this.generateMockOHLCV(limit);
    cache.set(cacheKey, data, 60);
    return data;
  }

  private generateMockOHLCV(count: number) {
    const data = [];
    let price = 0.00015;
    const now = Date.now();

    for (let i = count; i >= 0; i--) {
      const time = now - (i * 900000);
      price = price * (1 + (Math.random() - 0.5) * 0.02);
      
      data.push({
        time,
        open: price,
        high: price * 1.01,
        low: price * 0.99,
        close: price * (1 + (Math.random() - 0.5) * 0.005),
        volume: Math.random() * 1000000
      });
    }

    return data;
  }
}
```

---

### Phase 3: Backend API (2-3 hours)

#### 3.1 Main API Server (`backend/src/api/wallet-server.ts`)

Create Express server with:
- `/api/wallet/balance` - Get wallet balance
- `/api/wallet/positions` - Get user positions
- `/api/snipe/prepare` - Prepare buy transaction
- `/api/snipe/execute` - Execute signed transaction
- `/api/exit/prepare` - Prepare sell transaction
- `/api/token/validate` - Validate token safety
- `/api/token/info` - Get token information

#### 3.2 Chart API (`backend/src/api/chart-api.ts`)

Create endpoints for:
- `/api/chart/ohlcv` - Get OHLCV candle data
- `/api/price/current` - Get current price
- `/api/market/overview` - Get market overview

#### 3.3 WebSocket Server (`backend/src/api/websocket-server.ts`)

Setup WebSocket for:
- Real-time position updates
- Price updates
- Trade notifications
- Bot status changes

---

### Phase 4: Frontend Setup (2-3 hours)

#### 4.1 Wallet Integration (`frontend/src/components/wallet/`)

Create components:
- `WalletProvider.tsx` - Context provider
- `WalletButton.tsx` - Connect/disconnect button
- `WalletStatusCard.tsx` - Wallet info display
- `SnipeWithWallet.tsx` - Trading form

#### 4.2 Chart Components (`frontend/src/components/charts/`)

Create:
- `TradingViewChart.tsx` - Main chart component
- `ChartDashboard.tsx` - Multi-token dashboard
- `PriceChart.tsx` - Simple price display

#### 4.3 Trading Components (`frontend/src/components/trading/`)

Create:
- `PositionCard.tsx` - Position display
- `StrategySelector.tsx` - Strategy picker
- `QuickSnipe.tsx` - Quick trade form

#### 4.4 Main Dashboard (`frontend/src/app/page.tsx`)

Build dashboard with:
- Header with wallet button
- Portfolio stats cards
- Live charts section
- Active positions grid
- Quick snipe sidebar
- Recent activity feed

---

### Phase 5: Integration & Testing (1-2 hours)

#### 5.1 Connect Frontend to Backend

- Setup API client
- Configure WebSocket connection
- Test wallet connection
- Test trading flow

#### 5.2 Testing Checklist

- [ ] Wallet connection works
- [ ] Can fetch token prices
- [ ] Charts display correctly
- [ ] Can prepare transactions
- [ ] Phantom signing works
- [ ] Positions track correctly
- [ ] WebSocket updates work
- [ ] Error handling works
- [ ] Mobile responsive

---

### Phase 6: Polish & Deploy (1-2 hours)

#### 6.1 Environment Setup

Create production configs:
- Backend: Railway/Render/VPS
- Frontend: Vercel
- Environment variables
- CORS settings

#### 6.2 Documentation

Create:
- README.md with setup instructions
- API.md with endpoint documentation
- DEPLOYMENT.md with deploy steps
- USAGE.md with user guide

---

## 🎯 Priority Order

### Must Have (MVP)
1. ✅ Backend: Position tracking, Jupiter integration
2. ✅ Backend: Wallet-based API (no private keys)
3. ✅ Frontend: Wallet connection (Phantom)
4. ✅ Frontend: Basic trading form
5. ✅ Frontend: Position display
6. ✅ Backend: Auto-exit monitoring

### Should Have
7. ✅ Frontend: TradingView charts
8. ✅ Backend: Price data API
9. ✅ Frontend: Analytics dashboard
10. ✅ Backend: WebSocket updates
11. ✅ Frontend: Strategy visualization

### Nice to Have
12. ⏳ Token scanner integration
13. ✅ Telegram notifications
14. ⏳ Advanced indicators
15. ⏳ Drawing tools
16. ⏳ Portfolio management

---

## 🔧 Development Tips

### For Claude Code

1. **Start with Backend Core:**
   - Implement strategies first
   - Build position manager
   - Create Jupiter service
   - Test with mock data

2. **Build API Layer:**
   - Start with wallet endpoints
   - Add trading endpoints
   - Implement WebSocket
   - Add error handling

3. **Frontend Foundation:**
   - Setup wallet integration first
   - Build basic UI components
   - Connect to backend
   - Add real-time updates

4. **Charts & Analytics:**
   - Implement after core works
   - Start with simple charts
   - Add timeframes
   - Build analytics

5. **Polish Last:**
   - Add loading states
   - Improve error messages
   - Optimize performance
   - Test edge cases

### Code Quality

- Use TypeScript strict mode
- Add JSDoc comments
- Handle errors gracefully
- Log important events
- Cache aggressively
- Validate all inputs

### Security

- Never store private keys
- Validate wallet signatures
- Rate limit API endpoints
- Sanitize user inputs
- Use HTTPS in production
- Implement CORS properly

---

## 🚀 Quick Start Commands

```bash
# Clone artifacts and setup
git clone <your-repo> solana-trading-bot
cd solana-trading-bot

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with RPC URL
npm run build
npm run dev

# Frontend setup (new terminal)
cd frontend
npm install
cp .env.local.example .env.local
# Edit with API URL
npm run dev

# Open browser
# http://localhost:3000
```

---

## 📊 Success Metrics

### Technical
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] API response < 500ms
- [ ] WebSocket latency < 100ms
- [ ] Mobile responsive
- [ ] 90+ Lighthouse score

### Functional
- [ ] Can connect wallet
- [ ] Can snipe tokens
- [ ] Auto-exits work
- [ ] Charts update live
- [ ] Analytics accurate
- [ ] Error handling robust

### User Experience
- [ ] Intuitive interface
- [ ] Fast loading
- [ ] Clear feedback
- [ ] Mobile friendly
- [ ] Dark mode polish
- [ ] Professional look

---

## 🎉 Final Deliverables

When complete, you'll have:

1. **Backend API Server**
   - Wallet-based trading
   - 6 exit strategies
   - Real-time monitoring
   - Price data API
   - WebSocket server

2. **Frontend Dashboard**
   - Phantom integration
   - TradingView charts
   - Position tracking
   - Analytics page
   - Mobile responsive

3. **Documentation**
   - Setup guides
   - API reference
   - User manual
   - Deployment guide

4. **Production Ready**
   - Error handling
   - Logging
   - Caching
   - Rate limiting
   - Security measures

---

## 💡 Pro Tips

1. **Build incrementally** - Get core working first
2. **Test with small amounts** - Use 0.01 SOL initially
3. **Mock data first** - Test without real transactions
4. **Use TypeScript** - Catch errors early
5. **Cache everything** - Reduce API calls
6. **Handle errors** - Network issues are common
7. **Log important events** - Debug easier
8. **Make it responsive** - Mobile users matter
9. **Document as you go** - Future you will thank you
10. **Deploy early** - Test in production conditions

---

## 🎯 Ready to Build?

This is your complete roadmap to build a **$70k+ professional trading platform**!

**Estimated Timeline:**
- Backend Core: 2-3 hours
- Backend API: 2-3 hours
- Frontend Core: 2-3 hours
- Integration: 1-2 hours
- Testing & Polish: 1-2 hours
- **Total: 8-12 hours**

**Start building with Claude Code and create something amazing! 🚀**