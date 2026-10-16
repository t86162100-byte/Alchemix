# Wallet Core registry snapshot

Tradingview X vendors `registry.json` from the upstream Trust Wallet Core **4.8.4** release/tag to keep chain metadata versioned with the installed `@trustwallet/wallet-core@4.8.4` runtime.

- Upstream source: https://github.com/trustwallet/wallet-core/blob/4.8.4/registry.json
- Upstream registry documentation: https://github.com/trustwallet/wallet-core/blob/4.8.4/docs/registry-fields.md
- Snapshot size: 168 registry entries.
- Each entry supplies a chain identifier, display name, native ticker, and default derivation path.

At wallet creation/recovery, the app matches registry identifiers/names to the installed WASM `CoinType` enum and asks Wallet Core to derive each available receiving address locally. The Solana entry is handled by the separately validated BIP-39/SLIP-0010 fallback because this WASM build does not expose the expected Solana coin-type API. An entry is omitted if the installed runtime cannot derive a non-empty address; the app does not invent one. The in-app regression check verifies that the runtime derives at least 100 addresses before this milestone is considered to have broad coverage.

**Important boundary:** this is an address-derivation directory, not 168 live network integrations. A listed chain does not imply an RPC connection, balance query, token discovery, fee estimator, transaction builder, signer, or broadcaster. Those must be implemented and tested as separate chain adapters. Sending remains disabled.

The registry is upstream open-source material; retain the Trust Wallet Core license and notices when redistributing. Tradingview X is independent and is not affiliated with Trust Wallet.
