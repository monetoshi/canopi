# Canopi

<div align="center">

![Canopi Logo](frontend/public/canopi-logo.svg)

**Algorithmic trading, elevated.**

An intelligent trading bot for Solana with 16 automated exit strategies, ZK-Privacy, and a native macOS experience.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Mainnet-9945FF.svg)](https://solana.com/)
[![Desktop](https://img.shields.io/badge/Platform-macOS-lightgrey.svg)]()

[Features](#features) • [Quick Start](#quick-start) • [Privacy](#privacy--stealth-mode) • [Documentation](#documentation)

</div>

---

## Why Canopi?

Most Solana trading bots focus on **sniping new token launches**. Canopi is different:

**16 Exit Strategies** - Pro-grade risk management from scalping to HODLing.
**Stealth Mode** - ZK-Privacy via ShadowWire and Ephemeral Burner Wallets.
**Native macOS App** - Modern, draggable dark-mode interface.
**Secure by Design** - Admin API protection and WebSocket signature verification.
**Real-Time Data** - Live P&L and trade tracking via WebSockets and DexScreener.

---

## Features

### 16 Automated Exit Strategies
Automate your sells with precision. Canopi monitors your positions every 5 seconds and executes based on your chosen risk profile.
- **Fast Trading**: Scalping, Aggressive, Moderate, Slow (1-50 min).
- **HODL & Swing**: Percentage-based targets for long-term gains.
- **Advanced**: Trailing Stops, Grid Trading, Breakout detection, and Take Profit only.

### Privacy & Stealth Mode
Powered by **ShadowWire ZK-Proofs**, Canopi allows you to trade without leaving a public trail.
- **Privacy Shield**: Deposit funds into a shielded pool to hide your balance.
- **Stealth Limit Orders**: Automatically fund a fresh ephemeral wallet *only* when your price target is hit.
- **Ephemeral Wallets**: Every private trade uses a one-time burner wallet to sever the link to your main account.

### Telegram Bot Integration
Stay informed on the go with our interactive Telegram companion.
- **Real-Time Alerts**: Get pings for Buys, Sells, DCA triggers, and Errors.
- **Secure Linking**: Link your wallet using a secure 6-digit code system.
- **Remote Settings**: Toggle notification types directly from the chat menu.

### Native Desktop Experience
Canopi is built as a native macOS application for a premium, local-first experience.
- **Modern UI**: Hidden-inset title bar and Slate-950 dark theme.
- **Native Draggable**: Move the window naturally from the app header.
- **Local Database**: Uses **PGLite** for an embedded, high-performance Postgres experience.

---

## Quick Start

### Prerequisites
- **Node.js 20+**
- **Solana wallet** (Phantom recommended)
- **Telegram Bot Token** (Get from @BotFather)

### Installation
1. **Clone & Install**
```bash
git clone https://github.com/jamesfredericks/solana-trading-bot.git
cd solana-trading-bot
npm install # Install root, backend, and frontend deps
```

2. **Configure Environment**
Create `backend/.env` (use `backend/.env.example` as a template):
```env
RPC_URL=https://your-premium-rpc-url
TELEGRAM_BOT_TOKEN=your_bot_token
ADMIN_API_KEY=choose_a_strong_key
```

3. **Launch Desktop App**
```bash
npm run desktop
```

---

## Usage Guide

### 1. Authenticate
Open the app menu (Hamburger icon) and enter your `ADMIN_API_KEY` in the **Admin Access** section. This unlocks your data and fund movements.

### 2. Fund the Shield
Go to the **Privacy Shield** card. Enter an amount and click **Shield Funds**. This moves SOL into the ZK-pool for private trading.

### 3. Set a Stealth Order
- Use **Token Search** to find a pair.
- Select **Limit Order** as the Entry Strategy.
- Toggle **Stealth Limit Order** to **ON**.
- The bot will now monitor the price and execute via a private burner wallet when hit.

---

## Architecture

### Tech Stack
- **Frontend**: Next.js 14, TailwindCSS, Lucide React.
- **Backend**: Node.js, Express, Drizzle ORM.
- **Database**: PGLite (Embedded Postgres) or standard PostgreSQL.
- **Desktop**: Electron.
- **Integrations**: Jupiter V6 (DEX), DexScreener (Prices), ShadowWire (Privacy).

### Security Model
- **Admin API Key**: Required for all sensitive REST endpoints.
- **WebSocket Auth**: Requires a cryptographic signature from your wallet to subscribe to position updates.
- **Log Masking**: Sensitive RPC query parameters are automatically redacted from system logs.

---

## Roadmap

### Completed
- [x] 16 automated exit strategies.
- [x] ZK-Privacy integration (ShadowWire).
- [x] Stealth Limit Orders and Private DCA.
- [x] Native macOS App (Electron).
- [x] Secure Telegram Bot integration.
- [x] Real-time transaction history and tax reporting.
- [x] Embedded PGLite database support.

### Near-Term
- [ ] Live OHLCV charts via DexScreener API (replacing mock data).
- [ ] "Trending Sniper" dashboard for hot Solana pairs.
- [ ] Advanced performance analytics (Strategy Win Rate, P&L Heatmaps).
- [ ] Mobile-responsive web deployment profile.

---

## License
MIT License - see [LICENSE](LICENSE) file for details.
Copyright (c) 2025 Canopi (Monetoshi Project)

---

<div align="center">

**Built for the Solana community**

[Report Bug](https://github.com/jamesfredericks/solana-trading-bot/issues) • [Request Feature](https://github.com/jamesfredericks/solana-trading-bot/discussions)

</div>