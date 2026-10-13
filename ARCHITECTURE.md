# Nova Wallet architecture

## Principles

1. **Wallet-first:** wallet identity, key custody, signing and recovery are separate from portfolio and market screens. Never store a recovery phrase or private key in localStorage or plaintext application state. Key generation and encrypted platform-backed storage must be implemented and security-reviewed before the app claims to create a wallet.
2. **Chain-family adapters:** chain discovery is not transaction support. EVM-compatible chains, Bitcoin/UTXO, Solana, Tron, TON, Aptos and Sui require family-specific address validation, balance reads, signing and broadcasting. A network is transaction-capable only when its adapter implements the required capabilities.
3. **Provider-independent data:** screens consume app-owned interfaces in src/core/market/types.ts. Provider-specific HTTP, pagination, rate limits and response shapes live in adapters. Add a provider by implementing MarketDataProvider; do not add vendor-specific endpoints to React components.
4. **Honest asset discovery:** distinguish a known network from a network with indexed pools, a token with verifiable on-chain identity, and a token with reliable price/liquidity data. Empty results are not evidence that a network does not exist. Missing data must be shown as unavailable, never fabricated or silently treated as zero.

## Current implementation status

- The existing wallet UI still connects to an injected EVM wallet; it does not yet generate or custody a recovery phrase.
- EVM chain directory discovery is separate from market network discovery.
- Market data now has a provider contract and a GeckoTerminal adapter. GeckoTerminal is currently the only configured adapter, so this is a replaceable integration boundary—not yet a multi-provider or provider-free market backend.
- Market pool listings show DEX-indexed assets only. This is not a complete registry of every token deployed to a chain.
- The chain adapter contract is a boundary for future reviewed integrations; it does not claim that non-EVM transaction signing is implemented.

## Recommended delivery sequence

1. Keep provider HTTP and response parsing outside UI components; add retry/backoff and restrained request concurrency.
2. Add provider-independent chain capability metadata and explicit unsupported states.
3. Implement wallet creation with vetted cryptographic libraries and platform secure storage, including recovery/restore tests and threat-model review.
4. Implement and test one chain-family adapter at a time before exposing send/sign actions.
5. Add more market/indexing adapters and/or a self-hosted indexer where independent coverage is needed; validate price, liquidity, token identity and provenance.
