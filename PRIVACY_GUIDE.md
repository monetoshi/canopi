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

1.  **Use the Integrated Tor Switch:**
    *   Ensure Tor is running on your machine (default port `9050`).
    *   Open the app menu (Drawer) and toggle "Tor Network".
    *   This routes outgoing requests (Price API, Telegram, Solana RPC) through the Tor network.

2.  **Use a VPN (Alternative/Additional):** Run the bot on a machine with a system-wide VPN enabled.

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
## 6. Access Control & Recovery

### Admin Key
The application is secured by an **Admin API Key** which you set upon first launch. This key is required for all sensitive operations (trading, withdrawing funds, changing settings).

### Lost Admin Key?
If you lose your Admin Key, you can reset it without losing your funds:

1.  **Quit the Application.**
2.  Navigate to the Application Data directory:
    *   **macOS**: `~/Library/Application Support/canopi-trading-bot/`
    *   **Linux**: `~/.config/canopi-trading-bot/`
    *   **Windows**: `%APPDATA%\canopi-trading-bot\`
3.  Delete the `config.json` file.
    *   **WARNING:** Do **NOT** delete `wallet.enc.json` or `wallet.json`. That file contains your private keys and funds.
4.  **Restart the Application.**
5.  You will be prompted to create a new Admin Key.
6.  You will need to re-authenticate with your Wallet Password to re-enable encryption for the new configuration.

## 7. Local Data Security

### Encryption at Rest
*   **Wallet Data**: Your private keys are stored in `wallet.enc.json` encrypted with **AES-256-GCM**.
*   **Configuration**: API keys (Telegram, RPC) in `config.json` are also encrypted using your wallet password derived key.
*   **Protection**: Even if someone accesses your computer, they cannot read your keys or API tokens without your password.

### Auto-Lock
*   To protect against physical access attacks (e.g., leaving your laptop open), the application monitors user activity.
*   After **15 minutes** of inactivity (no mouse/keyboard events), the session automatically locks.
*   When locked:
    *   Decryption keys are wiped from memory.
    *   Trading and withdrawals are blocked.
    *   You must re-enter your password to resume.

## Summary Checklist

- [ ] Set `LOG_LEVEL=NONE` in `.env`
- [ ] Ensure Tor service is running (port 9050)
- [ ] Toggle "Tor Network" switch in the app menu
- [ ] Use "Private" toggle for all trades
- [ ] Ensure `backend/data` is on an encrypted volume
- [ ] Ensure Telegram tokens are NOT configured
