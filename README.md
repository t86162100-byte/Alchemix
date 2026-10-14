# Ferra Wallet

Ferra Wallet is being rebuilt on the `tradingview-x-clean-rebuild` branch. The prior implementation is used only as a visual reference: the existing dark dashboard styling and layout are retained, while wallet and application logic are being replaced with a clean foundation.

## Current phase: Stage 1 — wallet foundation

Implemented in this phase:
- Create a new Ethereum-compatible wallet using ethers' maintained wallet and BIP-39 implementations.
- Display the recovery phrase once during setup and require a three-word backup check.
- Import a valid BIP-39 recovery phrase locally.
- Encrypt the wallet JSON with a user password using ethers' keystore encryption.
- Store only the encrypted keystore in IndexedDB; no recovery phrase or plaintext private key is written to localStorage or sent to a backend.
- Unlock the stored encrypted wallet with the password and lock the in-memory wallet session.

Not implemented yet: live balances, token discovery, prices, transaction history, send, receive QR codes, swaps, dApp connections, other chain families, or mainnet transaction signing/broadcasting. The dashboard intentionally shows unavailable/empty states instead of fabricated values.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Important security boundaries

This is a web wallet foundation, not a completed or independently audited production wallet. Browser storage is not equivalent to hardware-backed mobile secure storage: a successful same-origin script injection or compromised browser extension may access data available to the app, and JavaScript cannot guarantee immediate zeroization of secrets from memory. Use a strong unique password, keep the recovery phrase offline, and do not use significant funds until a threat model, automated tests, independent security review, and controlled release process are complete.

Never send the recovery phrase to a server, analytics tool, crash report, or support agent. Future blockchain reads and market-data services must not receive wallet secrets.
