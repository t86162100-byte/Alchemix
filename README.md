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

Run the automated derivation regression suite with `npm test`, then build the static web application with `npm run build`; output is written to `dist/`. The prebuild step copies the Wallet Core WASM binary into Vite's public assets. CI is configured to run the regression suite before building.

## Implemented in the first wallet-creation milestone

- Generate a 12-word BIP-39 recovery phrase with Wallet Core.
- Show the phrase for offline backup and require users to type it back in the correct order.
- Require a local encryption password of at least 12 characters.
- Encrypt the recovery phrase and optional BIP-39 passphrase with AES-256-GCM using a PBKDF2-HMAC-SHA-256-derived key (600,000 iterations), random salt, and random IV.
- Store only the encrypted vault envelope in browser local storage.
- Restore from a recovery phrase, including an optional BIP-39 passphrase.
- Unlock an encrypted vault and derive receiving addresses from the pinned Wallet Core multichain registry where the installed runtime supports them.
- Lock the UI or remove the encrypted local copy.

## Step 2 — multichain key derivation (in progress)

- The app now vendors the upstream Trust Wallet Core 4.8.4 `registry.json` snapshot, containing **168 chain entries** with native tickers and default derivation paths. It matches each entry to the installed Wallet Core WASM coin-type enum and derives addresses locally where that runtime supports it. Entries that cannot be derived are omitted instead of fabricated.
- Common EVM networks are shown first. EVM chains using `m/44'/60'/0'/0/0` intentionally share the same Ethereum-format account address; other chains use their registry-defined derivation path. The UI shows the number of locally derived addresses.
- Bitcoin uses the native-SegWit BIP-84 path (`m/84'/0'/0'/0/0`). Solana uses a separate BIP-39/SLIP-0010 fallback with the published default path (`m/44'/501'/0'`), because the installed WASM build does not expose the expected Solana coin-type API. The alternative Solana path (`m/44'/501'/0'/0'`) yields a different address.
- The browser self-test now checks Ethereum, Bitcoin, Solana reference vectors and whether the runtime can derive **100 or more** addresses from the pinned registry. The automated suite also checks registry size/metadata and Solana derivation behavior. Public test-only mnemonic fixtures are never used for funds.

**This expands local address derivation, not live network support.** RPC connections, balances, token discovery, fee estimation, transaction building/signing, and broadcast are still separate work; sending remains disabled.

See [docs/WALLET_CORE_REGISTRY.md](docs/WALLET_CORE_REGISTRY.md) and [docs/WALLET_ARCHITECTURE.md](docs/WALLET_ARCHITECTURE.md) for registry provenance and implementation gates.

## Security status — development only

This is **not production-ready and must not be used with real funds**. The Wallet Core NPM WASM integration is beta. The current implementation needs broader automated BIP-39 and address test vectors, independent cross-implementation verification of Solana derivation, browser/device testing, dependency review, and security review. Browser local storage and JavaScript execution are exposed to same-origin script compromise; encryption at rest does not protect secrets from malicious code running in the page while a wallet is unlocked.

Balance retrieval, token discovery, network adapters, transaction construction, transaction signing, broadcast, and send UI remain unimplemented/disabled. Wallet Core does not itself connect to blockchain nodes or broadcast transactions.
