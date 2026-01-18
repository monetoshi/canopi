# API Documentation

Complete API reference for the Solana Trading Bot backend.

## Base URL

```
http://localhost:3001
```

## Authentication

No authentication required. Wallet signatures are used for transaction authorization.

## Response Format

All responses follow this structure:

```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}
```

---

## Wallet Endpoints

### Get Wallet Balance

Get SOL balance and USD value for a wallet.

**Endpoint:** `GET /api/wallet/balance/:publicKey`

**Parameters:**
- `publicKey` (path) - Solana wallet public key

**Response:**
```json
{
  "success": true,
  "data": {
    "publicKey": "ABC123...",
    "sol": 1.5,
    "solUsd": 150.00
  },
  "timestamp": 1234567890
}
```

### Get User Positions

Get all positions for a wallet.

**Endpoint:** `GET /api/wallet/positions/:publicKey`

**Parameters:**
- `publicKey` (path) - Solana wallet public key

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "mint": "TOKEN123...",
      "walletPublicKey": "ABC123...",
      "entryTime": 1234567890,
      "entryPrice": 0.00015,
      "tokenAmount": 1000000,
      "solSpent": 0.1,
      "exitStagesCompleted": 0,
      "strategy": "moderate",
      "isPercentageBased": false,
      "highestProfit": 50.5,
      "status": "active",
      "currentPrice": 0.00020,
      "currentProfit": 33.33
    }
  ],
  "timestamp": 1234567890
}
```

---

## Trading Endpoints

### Prepare Buy Transaction

Prepare a buy transaction using Jupiter.

**Endpoint:** `POST /api/snipe/prepare`

**Body:**
```json
{
  "walletPublicKey": "ABC123...",
  "tokenMint": "TOKEN123...",
  "solAmount": 0.1,
  "slippageBps": 200,
  "strategy": "moderate"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction": "base64_encoded_transaction",
    "quote": { /* Jupiter quote data */ },
    "expectedOutput": "1000000",
    "priceImpact": 0.5
  },
  "timestamp": 1234567890
}
```

### Execute Buy Transaction

Execute a signed buy transaction and create position.

**Endpoint:** `POST /api/snipe/execute`

**Body:**
```json
{
  "walletPublicKey": "ABC123...",
  "signedTransaction": "base64_encoded_signed_transaction",
  "tokenMint": "TOKEN123...",
  "solAmount": 0.1,
  "strategy": "moderate"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signature": "TX_SIGNATURE...",
    "position": { /* Position object */ }
  },
  "timestamp": 1234567890
}
```

### Prepare Sell Transaction

Prepare a sell transaction.

**Endpoint:** `POST /api/exit/prepare`

**Body:**
```json
{
  "walletPublicKey": "ABC123...",
  "tokenMint": "TOKEN123...",
  "percentage": 50,
  "slippageBps": 200
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction": "base64_encoded_transaction",
    "quote": { /* Jupiter quote data */ },
    "expectedOutput": "0.15",
    "priceImpact": 0.3
  },
  "timestamp": 1234567890
}
```

### Execute Sell Transaction

Execute a signed sell transaction.

**Endpoint:** `POST /api/exit/execute`

**Body:**
```json
{
  "walletPublicKey": "ABC123...",
  "tokenMint": "TOKEN123...",
  "signedTransaction": "base64_encoded_signed_transaction",
  "percentage": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signature": "TX_SIGNATURE..."
  },
  "timestamp": 1234567890
}
```

---

## Chart Endpoints

### Get OHLCV Data

Get candlestick data for charting.

**Endpoint:** `GET /api/chart/ohlcv/:mint`

**Parameters:**
- `mint` (path) - Token mint address
- `timeframe` (query) - Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
- `limit` (query) - Number of candles (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "mint": "TOKEN123...",
    "timeframe": "15m",
    "candles": [
      {
        "time": 1234567890,
        "open": 0.00015,
        "high": 0.00018,
        "low": 0.00014,
        "close": 0.00017,
        "volume": 1000000
      }
    ]
  },
  "timestamp": 1234567890
}
```

### Get Current Price

Get current price for a token.

**Endpoint:** `GET /api/chart/price/:mint`

**Parameters:**
- `mint` (path) - Token mint address

**Response:**
```json
{
  "success": true,
  "data": {
    "mint": "TOKEN123...",
    "price": 0.00015
  },
  "timestamp": 1234567890
}
```

### Get Multiple Prices

Get prices for multiple tokens.

**Endpoint:** `POST /api/chart/prices`

**Body:**
```json
{
  "mints": ["TOKEN1...", "TOKEN2..."]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "TOKEN1...": 0.00015,
    "TOKEN2...": 0.00020
  },
  "timestamp": 1234567890
}
```

---

## Strategy Endpoints

### Get All Strategies

Get all available exit strategies.

**Endpoint:** `GET /api/strategies`

**Response:**
```json
{
  "success": true,
  "data": {
    "aggressive": {
      "exitStages": [
        { "timeMinutes": 2, "sellPercent": 40, "minProfitPercent": 30 }
      ],
      "maxHoldTime": 10,
      "stopLossPercent": -20,
      "isPercentageBased": false,
      "description": "⚡ AGGRESSIVE: Fast exits (8min)"
    }
  },
  "timestamp": 1234567890
}
```

---

## Statistics Endpoints

### Get Statistics

Get bot statistics.

**Endpoint:** `GET /api/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPositions": 10,
    "activeCount": 3,
    "closedCount": 7,
    "totalInvested": 1.5,
    "avgHoldTimeMinutes": 25.5
  },
  "timestamp": 1234567890
}
```

---

---

## Bot Status Endpoints

### Get Bot Status

Check if the bot is configured, locked, or active.

**Endpoint:** `GET /api/bot/status`

**Response:**
```json
{
  "success": true,
  "data": {
    "configured": true,
    "isLocked": false,
    "publicKey": "ABC123...",
    "balance": 1.5,
    "isRunning": true
  },
  "timestamp": 1234567890
}
```

### Unlock Wallet

Unlock the wallet (and migrate from legacy keys if needed).

**Endpoint:** `POST /api/wallet/unlock`

**Body:**
```json
{
  "password": "your_secure_password"
}
```

---

## WebSocket API

### Connection

```
ws://localhost:3001/ws
```

### Message Types

**Subscribe to Wallet**
```json
{
  "type": "subscribe_wallet",
  "walletPublicKey": "ABC123..."
}
```

**Subscribe to Token**
```json
{
  "type": "subscribe_token",
  "mint": "TOKEN123..."
}
```

**Unsubscribe from Token**
```json
{
  "type": "unsubscribe_token",
  "mint": "TOKEN123..."
}
```

**Ping**
```json
{
  "type": "ping"
}
```

### Server Messages

**Position Update**
```json
{
  "type": "position_update",
  "data": { /* Position object or array */ },
  "timestamp": 1234567890
}
```

**Price Update**
```json
{
  "type": "price_update",
  "data": {
    "mint": "TOKEN123...",
    "price": 0.00015
  },
  "timestamp": 1234567890
}
```

**Trade Executed**
```json
{
  "type": "trade_executed",
  "data": { /* Trade data */ },
  "timestamp": 1234567890
}
```

---

## Error Codes

- `400` - Bad Request (invalid parameters)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error

Error responses include an error message:
```json
{
  "success": false,
  "error": "Error message here",
  "timestamp": 1234567890
}
```
