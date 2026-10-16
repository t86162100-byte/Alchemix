# Tradingview X

A clean, self-custodial multichain wallet project. This branch starts with a fresh web application shell and uses the official Trust Wallet Core WebAssembly package for local cryptographic operations.

## Source and licensing

- Wallet Core upstream: https://github.com/trustwallet/wallet-core
- Pinned source submodule revision: `adf80f8bac989e18a4ef1922e2b9eaeb4bf804a9`
- NPM runtime: `@trustwallet/wallet-core@4.8.4`
- Preserve upstream and third-party license notices. Check package and upstream licensing before redistribution.
- Initialize the source submodule after cloning if you need the upstream C++ source: `git submodule update --init --recursive`

Trust Wallet Core is a cryptographic engine, not the complete Trust Wallet application. Tradingview X is an independent project and is not affiliated with Trust Wallet.

## Run locally

Requirements: Node.js 20 or newer.

```sh
npm install
npm run dev
```

Build the static web application with `npm run build`; output is written to `dist/`. The prebuild step copies the Wallet Core WASM binary into Vite's public assets.

## Implemented in the first wallet-creation milestone

- Generate a 12-word BIP-39 recovery phrase with Wallet Core.
- Show the phrase for offline backup and require users to type it back in the correct order.
- Require a local encryption password of at least 12 characters.
- Encrypt the recovery phrase and optional BIP-39 passphrase with AES-256-GCM using a PBKDF2-HMAC-SHA-256-derived key (600,000 iterations), random salt, and random IV.
- Store only the encrypted vault envelope in browser local storage.
- Restore from a recovery phrase, including an optional BIP-39 passphrase.
- Unlock an encrypted vault and derive initial Ethereum and Bitcoin receiving addresses locally.
- Lock the UI or remove the encrypted local copy.

## Step 2 — multichain key derivation (in progress)

- Derive the default Ethereum account and display it for Ethereum, BNB Chain, Base, Polygon, Arbitrum, Optimism, Avalanche C-Chain, Mantle, Linea, Scroll, zkSync Era, opBNB, Celo, Gnosis, Moonbeam, Moonriver, and Fantom. These EVM networks intentionally share the same Ethereum account path/address; listing them does not mean RPC, balances, or transactions are connected.
- Derive the default Bitcoin native-SegWit address and show the BIP-84 path (`m/84'/0'/0'/0/0`).
- Derive Solana locally with BIP-39 plus SLIP-0010 using Trust Wallet Core's published default path (`m/44'/501'/0'`). This fallback is used because the installed Wallet Core WASM build does not expose the expected Solana coin-type API. Trust Wallet Core documents an alternative Solana path (`m/44'/501'/0'/0'`) that produces a different address; do not assume every wallet uses the same path.
- Browser self-tests compare Ethereum, Bitcoin, and Solana derivation against published Trust Wallet Core reference outputs and check Solana address format.
- The self-test button uses public test-only mnemonic fixtures, never the user's wallet phrase. Do not use those fixtures for funds.

The detailed module boundaries and completion gates are documented in [docs/WALLET_ARCHITECTURE.md](docs/WALLET_ARCHITECTURE.md).

## Security status — development only

This is **not production-ready and must not be used with real funds**. The Wallet Core NPM WASM integration is beta. The current implementation needs broader automated BIP-39 and address test vectors, independent cross-implementation verification of Solana derivation, browser/device testing, dependency review, and security review. Browser local storage and JavaScript execution are exposed to same-origin script compromise; encryption at rest does not protect secrets from malicious code running in the page while a wallet is unlocked.

Balance retrieval, token discovery, network adapters, transaction construction, transaction signing, broadcast, and send UI remain unimplemented/disabled. Wallet Core does not itself connect to blockchain nodes or broadcast transactions.
