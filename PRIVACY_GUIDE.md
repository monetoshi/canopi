# Zero Logging & Anonymity Guide

To ensure the Canopi Trading Bot operates with **zero logging** and maximum anonymity, follow these configuration steps.

## 1. Zero Logging Mode

To completely disable all console output, file logging, and error reporting to standard output:

1.  Open your `backend/.env` file.
2.  Add or update the following line:

```env
LOG_LEVEL=NONE
```

When this is set, the application will not output any text to the terminal or logs. This ensures no transaction signatures, wallet addresses, or IP addresses are ever displayed or recorded in the process output.

## 2. Network Anonymity (Tor / VPN)

The bot connects to Solana RPC nodes and third-party APIs (Jupiter, Birdeye). To hide your IP address:

1.  **Use a VPN:** Run the bot on a machine with a system-wide VPN enabled.
2.  **Use Tor (Advanced):** Route the bot's traffic through Tor using `torsocks` or a similar wrapper.

```bash
# Example using torsocks
torsocks npm run dev
```

**Note on RPCs:** Ensure your RPC provider (e.g., Helius, QuickNode) supports connections from VPN/Tor exit nodes, or run your own node.

## 3. On-Chain Anonymity (ShadowWire)

To break the on-chain link between your main wallet and your trading activity, use the integrated **Privacy Mode**:

1.  In the UI, toggle "Private" mode for trades.
2.  This uses **ShadowWire** to:
    *   Shield funds into a private pool.
    *   Generate a fresh "Ephemeral Wallet" for the trade.
    *   Fund the ephemeral wallet anonymously.
    *   Execute the trade.
    *   Return funds to the shielded pool.

## 4. Database Privacy

The bot uses a local embedded database (PGLite) stored in `backend/data/`. This file resides **only on your machine**.

To strictly ensure no permanent record:
*   Run the bot on an encrypted disk (FileVault/BitLocker).
*   For "amnesic" operation, you can mount the `backend/data/` directory to a RAM disk, though you will lose all open positions and trade history upon restart.

```bash
# Example: Point DB to temporary location (if supported by your setup)
# This requires modifying database config paths if not using default.
```

## 5. Telegram Notifications

**Warning:** The Telegram integration sends trade details, profit reports, and wallet balances to the Telegram servers.

*   **For Zero Leakage:** Do **not** configure `TELEGRAM_BOT_TOKEN` or `TELEGRAM_BOT_USERNAME` in your `.env` file. Leave them empty.
*   If configured, your trade data leaves your local machine and passes through Telegram's infrastructure.

## Summary Checklist

- [ ] Set `LOG_LEVEL=NONE` in `.env`
- [ ] Connect via VPN or Tor
- [ ] Use "Private" toggle for all trades
- [ ] Ensure `backend/data` is on an encrypted volume
- [ ] Ensure Telegram tokens are NOT configured
