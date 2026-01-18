# Security Policy

## Supported Versions

Only the latest version of Canopi is currently supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Features

### Encryption at Rest
All sensitive data, including private keys and API tokens, is encrypted using **AES-256-GCM** before being saved to disk. The `wallet.enc.json` file is unreadable without the user's password.

### Auto-Lock
The application automatically locks the wallet session after **15 minutes** of inactivity (no mouse/keyboard interaction). This requires the user to re-enter their password to authorize new trades or view sensitive data.

### Secure Memory
Private keys are kept in memory only as long as necessary and are never logged. Key material is cleared from memory when the wallet is locked.

## Reporting a Vulnerability

**DO NOT** open a public GitHub issue for security vulnerabilities. This puts users at risk.

If you discover a security vulnerability, please report it privately via email to: **monetoshi@proton.me**

We will respond within 48 hours to acknowledge your report.

### Process

1.  **Report**: Email details to monetoshi@proton.me.
2.  **Triage**: We will confirm the vulnerability.
3.  **Fix**: We will develop a patch.
4.  **Disclosure**: Once patched, we will publicly announce the fix and credit you (if desired).

Thank you for keeping the Solana community safe.
