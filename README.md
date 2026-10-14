# Ferra Wallet

Ferra Wallet is a clean self-custody wallet foundation. The existing dashboard appearance is retained as a visual reference; application behavior is being rebuilt separately.

## Current phase: local wallet foundation

Implemented:
- Generate a new EVM wallet locally with ethers.
- Reveal the generated recovery phrase in the setup flow and require a backup confirmation before saving.
- Import a valid BIP-39 recovery phrase locally.
- Encrypt wallet JSON with the user's password.
- Persist only the encrypted keystore in IndexedDB.
- Unlock the encrypted keystore for the current browser session.

Not implemented and intentionally disabled:
- Live native/token balances and price feeds.
- Network switching and RPC-based asset discovery.
- Transaction signing or broadcasting, send flows, QR receive, swaps, dApp connections, or transaction history.
- Security audit or production readiness.

The UI must not fabricate balances or claim a transaction succeeded. These capabilities will be added in separate phases with tests before they are enabled.

## Development

```bash
npm install
npm run test
npm run typecheck
npm run build
```

## Security notes

This is not an independently audited production wallet. Browser-based storage is exposed to risks from compromised devices, malicious extensions, and same-origin script injection. Use a strong unique password, store the recovery phrase offline, and do not use significant funds until threat modeling, automated testing, and independent security review are complete.

The recovery phrase and plaintext private key must never be sent to a server, analytics system, crash report, or support agent. Future market-data and blockchain-read services must never receive wallet secrets.
