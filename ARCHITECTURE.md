# Ferra Wallet architecture

## Principles
- Preserve the prior dashboard's visual design only; do not reuse its business logic or secret-handling code.
- Wallet custody, chain adapters, portfolio data, and market data remain separate modules.
- Never store a recovery phrase or plaintext private key in localStorage, IndexedDB, URLs, logs, analytics, or backend requests.
- Store only a password-encrypted wallet keystore at rest; keep the unlocked signer in memory only for the active session.
- Do not show fabricated balances or enable transaction actions before the required chain implementation and tests exist.
- Chain discovery is not transaction support. Each chain family requires its own reviewed address, balance, signing, and broadcast adapter.

## Current implementation

### Stage 1 — wallet foundation
- `src/core/wallet/walletService.ts`: uses ethers for wallet generation, BIP-39 validation, address derivation, keystore encryption and unlock.
- `src/core/wallet/secureStore.ts`: IndexedDB adapter stores only encrypted JSON keystore content.
- UI: create, recovery phrase backup, phrase verification, import, unlock, and lock flows.
- The UI is deliberately explicit that live balances and transaction capabilities are not available yet.

### Known limitations
- Web platform; IndexedDB is not hardware-backed secure storage and does not protect against XSS or a compromised browser environment.
- No automated security audit has been performed.
- No chain RPC adapter or transaction signing/broadcasting feature is exposed yet.

## Delivery sequence
1. Wallet foundation and recovery tests.
2. One EVM test-network adapter for native balance, address display, fee estimates, and transaction history.
3. Market data and portfolio valuation with provider interfaces, caching, and explicit unavailable states.
4. Send/receive flows on a test network with address validation, preview, fee review, signing, and confirmation tracking.
5. Swaps and additional chain-family adapters, each independently tested.
6. Security review, threat model, performance checks, monitoring, and controlled release.
