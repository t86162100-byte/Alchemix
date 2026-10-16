# Tradingview X — Wallet Architecture Rebuild

## Goal
Rebuild the wallet internals on this branch using proven open-source wallet-engine patterns, while preserving the existing Tradingview X interface. This is not a claim that the product is Trust Wallet or an official Trust Wallet fork.

## Reference implementation
- Trust Wallet Core: https://github.com/trustwallet/wallet-core
- Official developer documentation: https://developer.trustwallet.com/developer/wallet-core
- Trust Wallet Core is Apache-2.0 licensed. If code or binaries are incorporated, retain the license and required notices, record the exact upstream version/commit, and review third-party dependency licenses. The license does not grant Trust Wallet trademark rights.
- Do not copy Trust Wallet branding, proprietary services, or assets. Reuse licensed code and follow public architectural patterns where compatible with this web application.

## Required sequence
1. **Inventory before edits** — map the current app, build/deploy setup, dependencies, wallet creation/recovery, key storage, derivation paths, chain adapters, token discovery, and tests.
2. **Threat model and boundaries** — document secret handling, browser threat assumptions, RPC trust, supply-chain risks, and supported-operation guarantees.
3. **Wallet core** — select and pin mature, compatible cryptographic dependencies; test mnemonic validation, derivation, encryption/unlock, and signing against known test vectors. Never log or transmit recovery phrases/private keys.
4. **Chain adapters** — define explicit capabilities per chain: derive/validate address, read native/token balances, estimate fees, build unsigned transaction, sign locally, broadcast, and verify status. Unsupported capabilities must remain disabled.
5. **Data services** — separate RPC transport, retries/timeouts, token metadata, price data, and transaction history. Registry membership is not proof that a token is safe or valuable.
6. **Application services** — coordinate accounts, portfolio, send/receive, transaction review, swaps, and network selection without embedding chain logic in UI components.
7. **Interface integration** — preserve the existing wallet-web-foundation visual design; replace underlying implementation incrementally behind stable interfaces.
8. **Verification gates** — unit tests, chain test vectors, integration tests, dependency/license review, build/deploy checks, and manual security review. Sending stays disabled for any chain whose complete transaction lifecycle has not passed tests.

## Safety rules
- Never migrate, print, or expose a user's real recovery phrase/private keys during development.
- Use test wallets and test networks for transaction tests.
- Never report mocked balances, prices, fees, or transaction confirmations as live data.
- Do not enable send merely because an asset or network appears in a directory.
- Keep this rebuild isolated on trust-wallet-architecture-rebuild; do not merge or deploy until reviewed.

## Initial status
This file records the plan only. It does not certify the existing wallet implementation or any chain as secure/production-ready. The next step is a repository inventory and audit before changing runtime code.
