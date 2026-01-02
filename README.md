# Canopi

<div align="center">

![Canopi Logo](frontend/public/canopi-logo.svg)

**Privacy-first algorithmic trading.**

An intelligent trading bot for Solana with 16 automated exit strategies, ZK-Privacy, and a native macOS experience.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Mainnet-9945FF.svg)](https://solana.com/)
[![Desktop](https://img.shields.io/badge/Platform-macOS-lightgrey.svg)]()

[Features](#features) • [Privacy](#privacy-architecture) • [Quick Start](#quick-start) • [Documentation](#documentation)

</div>

> **⚠️ BETA STATUS**
>
> Canopi is currently in **public beta**. While the privacy and trading features have been tested, this software deals with real financial assets and carries inherent risks.
> **Use cautiously and at your own risk.** We welcome your feedback and bug reports to help improve the platform.

---

## Why Canopi?

Canopi is not just another sniper bot. It is a **complete portfolio management system** designed for privacy-conscious traders who value risk management over gambling.

**16 Exit Strategies** - From 1-minute scalping to 30-day HODL positions.
**Zero-Knowledge Privacy** - Trade without linking your main wallet to your degen plays.
**Native Desktop App** - A secure, local-first application that keeps your keys on your machine.

---

## Features

### Automated Trading Engine
The heart of Canopi is its strategy engine, which monitors your positions every 5 seconds.
- **Entry Modes**: Instant Buy, Limit Orders, and Dollar Cost Averaging (DCA).
- **Exit Strategies**:
  - **Fast**: Scalping (1-3m), Aggressive (8m), Moderate (20m).
  - **Swing**: Multi-day holds with percentage-based targets.
  - **Advanced**: Trailing Stop, Breakout Detection, and Grid Trading.
- **Risk Management**: Automatic stop-losses and take-profit levels for every trade.

### Privacy Architecture
Powered by **ShadowWire ZK-Proofs**, Canopi introduces "Stealth Mode" to Solana trading.
- **Privacy Shield**: Deposit SOL into a shielded pool to break on-chain links.
- **Ephemeral Wallets**: The bot automatically spins up one-time "burner" wallets for trades.
- **Stealth Limit Orders**: Funds are moved from the shielded pool to a burner wallet *only* when your price target is hit, keeping your intentions hidden until the last second.
- **Internal Consolidation**: Profits are swept back into the shielded pool via internal transfers.

### User Experience
- **Native macOS App**: A polished Electron app with a hidden-inset title bar and dark mode.
- **Telegram Companion**: Link your bot securely to get real-time notifications on buys, sells, and errors. Control your bot remotely with simple commands.
- **Local Database**: All data is stored in an embedded **PGLite** (PostgreSQL) database within the app, ensuring high performance without external dependencies.

### Security
- **Encrypted Storage**: Your wallet is encrypted with AES-256 and stored locally (`wallet.enc.json`).
- **Server-Side Signing**: Transactions are constructed and signed within the secure backend process.
- **API Protection**: All sensitive endpoints require an `ADMIN_API_KEY`.
- **Log Masking**: RPC parameters and keys are automatically redacted from logs.

---

## Quick Start

### Prerequisites
- **Node.js 20+**
- **Solana wallet** (Phantom recommended for initial setup)
- **Telegram Bot Token** (Get from @BotFather)

### Installation

1. **Clone & Install**
```bash
git clone https://github.com/monetoshi/canopi.git
cd canopi
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

### 1. Authenticate & Unlock
Upon launching, enter your `ADMIN_API_KEY` in the **Admin Access** section. This unlocks your data and fund movements. If you have an encrypted wallet, you will be prompted to enter your password to unlock the signing capability.

### 2. Fund the Shield
Navigate to the **Privacy Shield** card. Enter an amount (e.g., 1 SOL) and click **Shield Funds**. This moves your SOL into the ShadowWire ZK-pool.

### 3. Set a Stealth Order
1. Go to **Token Search** and find a pair.
2. Select **Limit Order** as your entry strategy.
3. Toggle **Stealth Limit Order** to **ON**.
4. The bot will monitor the price. When the target is hit, it will:
   - Withdraw funds from the shield to a fresh burner wallet.
   - Execute the buy.
   - Manage the position using the burner wallet.

---

## Roadmap

### Completed
- [x] 16 automated exit strategies.
- [x] ZK-Privacy integration (ShadowWire).
- [x] Stealth Limit Orders and Private DCA.
- [x] Native macOS App (Electron).
- [x] Secure Telegram Bot integration.
- [x] Embedded PGLite database support.

### Near-Term
- [ ] Live OHLCV charts via DexScreener API.
- [ ] "Trending Sniper" dashboard for hot Solana pairs.
- [ ] Advanced performance analytics (Strategy Win Rate, P&L Heatmaps).
- [ ] Mobile-responsive web deployment profile.

---

## License
MIT License - see [LICENSE](LICENSE) file for details.
Copyright (c) 2025 Canopi (Monetoshi Project)

---

<div align="center">

**Built with love for the Solana Community**

[Report Bug](https://github.com/monetoshi/canopi/issues) • [Request Feature](https://github.com/monetoshi/canopi/discussions)

</div>