# Ferra Wallet

Ferra Wallet is a self-custody EVM wallet foundation. The original dashboard visual design is retained while wallet behavior is rebuilt in isolated modules.

## Implemented

- Generate a new EVM wallet locally and import a valid BIP-39 recovery phrase.
- Encrypt wallet JSON with the user's password and persist only the encrypted keystore in IndexedDB.
- Unlock and lock the wallet for the current browser session.
- Read real native ETH balances over public RPC for Ethereum Mainnet and Base Mainnet.
- Display selected network, chain ID, latest block number, RPC connection status, and clear connection errors.
- Validate recipient addresses and estimate native ETH transfer gas/fees using live RPC data.
- Keep transfer preparation read-only: the app does not sign or broadcast transactions.

## Not yet implemented

- Transaction signing, broadcasting, sending, replacement/cancellation, or transaction receipt tracking.
- Token balances, token prices, swaps, dApp connections, or complete transaction history.
- Automated end-to-end/browser tests, external security audit, and production readiness.

The app must not fabricate balances or claim a transaction succeeded. Transfer estimates are indicative only and can change before a future submission.

## Development

```bash
npm install
npm run test
npm run typecheck
npm run build
```

## Security notes

This is not an independently audited production wallet. Browser-based storage is exposed to risks from compromised devices, malicious extensions, and same-origin script injection. Use a strong unique password, store the recovery phrase offline, and do not use significant funds until threat modeling, automated testing, and independent security review are complete.

The recovery phrase and plaintext private key must never be sent to a server, analytics system, crash report, or support agent. Blockchain RPC requests in this phase use only the public wallet address and public transaction fields for read-only balance/fee estimation.
