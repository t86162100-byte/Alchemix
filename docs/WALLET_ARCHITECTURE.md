# Tradingview X — Wallet Architecture and Implementation Gates

This document records the implementation boundaries for a self-custodial multichain wallet. It is intentionally conservative: a chain is not considered supported merely because its name appears in the network directory.

## Source material consulted

- Trust Wallet Core overview and supported-chain registry: https://github.com/trustwallet/wallet-core
- Trust Wallet Core usage guide: https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage
- Trust Wallet Core registry derivation fields: https://github.com/trustwallet/wallet-core/blob/master/docs/registry-fields.md
- Trust Wallet Core FAQ (network queries and broadcasting are outside Core): https://developer.trustwallet.com/developer/wallet-core/faq
- OWASP MASVS: https://mas.owasp.org/MASVS/
- OWASP storage control: https://mas.owasp.org/MASVS/controls/MASVS-STORAGE-1/
- OWASP cryptographic key-management control: https://mas.owasp.org/MASVS/controls/MASVS-CRYPTO-2/

## Architectural boundaries

Keep these responsibilities separate. They have different failure modes and need independent review.

1. **Vault and recovery** — BIP-39 phrase generation/validation, phrase confirmation, local encryption, password-based unlock, recovery import, and versioned encrypted-vault format.
2. **Key derivation** — chain-specific curve, derivation path, address encoding, and published reference vectors. Never silently change derivation paths during recovery.
3. **Chain adapters** — typed network configuration, RPC requests, response validation, timeouts, rate-limit handling, and normalized chain errors.
4. **Asset discovery and balances** — native assets, token registries, chain-specific token metadata, raw integer balances, decimal formatting, and stale/error states. Never fabricate values or infer a zero balance from a failed request.
5. **Transaction pipeline** — recipient/amount validation, chain-specific fee estimation, balance/nonce/UTXO checks, local signing, serialization, broadcast, and confirmation tracking.
6. **UI capability gates** — each network exposes only the operations that are actually implemented. Read-only must be explicit; send is disabled until the full chain pipeline has been independently verified.

## Current derivation notes

- The address directory is sourced from the pinned Wallet Core 4.8.4 `registry.json` snapshot (168 entries). Runtime derivation matches registry IDs/names to the WASM `CoinType` enum and omits entries that fail to derive; an in-app self-test requires at least 100 addresses.
- EVM networks sharing `m/44'/60'/0'/0/0` derive the same Ethereum-format account address; this does not establish that their RPC or transaction support is implemented.
- Bitcoin uses the native-SegWit BIP-84 account path currently recorded in the code.
- Trust Wallet Core's registry documents two Solana derivation paths: the default `m/44'/501'/0'` and an alternative `m/44'/501'/0'/0'`. They can produce different addresses from the same phrase. The current fallback implements the first path and must not be described as universal Solana-wallet compatibility.
- Solana derivation is currently implemented separately because the installed Wallet Core WASM build does not expose the expected coin-type API. Keep this fallback only while it is validated against the upstream Wallet Core published vector and independent reference material.
- Published test fixtures are public test-only data and must never be used to hold funds.

## Required acceptance evidence

### Gate A — wallet creation and recovery
- BIP-39 validity and checksum checks; no secret phrase in logs, telemetry, URL, or network requests.
- Confirm phrase confirmation cannot be bypassed by UI state alone.
- Confirm encrypted-vault format validation, authenticated decryption, incorrect-password handling, and recovery from a phrase.
- Review key lifetime and minimize copies; JavaScript memory cannot provide a hard guarantee of zeroization.
- Document browser threat boundaries: local encryption at rest does not protect a wallet from malicious same-origin JavaScript while it is unlocked.

### Gate B — derivation
- Test vectors for each enabled chain/path, including expected address, derivation path, and curve.
- Independent vectors where possible; do not use a self-generated output as its own oracle.
- Recovery compatibility must explicitly represent alternative paths where the ecosystem uses them.
- An unsupported derivation API must not silently fall back to a different path.

### Gate C — chain data
- Validate response shape and chain identity; reject malformed, stale, or mismatched responses.
- Distinguish a genuine zero balance from unavailable data.
- Bound request timeouts and retry only appropriate idempotent reads.
- Token discovery must report source/refresh failures without hiding known assets or inventing registry contents.

### Gate D — transactions
- Per-chain fee and transaction models, correct chain IDs/network identifiers, replay protection where applicable, and local signing.
- Review signed payload before broadcast; do not transmit private keys or recovery material to RPC providers.
- Verify rejected, underpriced, insufficient-funds, timeout, duplicate-broadcast, and confirmation cases.
- Keep sending disabled until the complete chain-specific path is implemented and reviewed.

## Security posture

This project is development software, not a production wallet. A successful build or passing local vector is necessary but not sufficient for production use. Before real funds are supported, require automated regression tests, independent security review, dependency review, and deployment verification.
