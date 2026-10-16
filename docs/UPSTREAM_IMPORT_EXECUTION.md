# Trust Wallet Core source import

This file pins the upstream source candidate for the Tradingview X rebuild.

## Upstream source

- Repository: https://github.com/trustwallet/wallet-core
- License: Apache-2.0 (retain LICENSE, notices, and third-party license files)
- Pinned upstream commit: `adf80f8bac989e18a4ef1922e2b9eaeb4bf804a9`
- Upstream project: a cryptographic wallet engine, not the full Trust Wallet application.

## Import into this repository

Run from a clone of `t86162100-byte/Alchemix` while checked out on `trust-wallet-clone`:

```sh
git submodule add https://github.com/trustwallet/wallet-core.git vendor/trust-wallet-core
git -C vendor/trust-wallet-core checkout adf80f8bac989e18a4ef1922e2b9eaeb4bf804a9
git add .gitmodules vendor/trust-wallet-core
git commit -m "vendor: pin Trust Wallet Core upstream"
git push origin trust-wallet-clone
```

This uses a submodule so the upstream license and history remain intact rather than pretending upstream code was authored here. A clone of this repository must be initialized with:

```sh
git submodule update --init --recursive
```

## Web-app compatibility gate

Do not wire the native C++ library directly into the browser bundle. First inspect the actual web app toolchain and evaluate the upstream WebAssembly/NPM target, supported runtime, bundle size, CSP, and build compatibility. If that target is not production-ready for this app, keep the UI and introduce a separately tested signing boundary rather than inventing cryptography.

## Security gates before enabling sends

- Seed/private-key material must never leave the user's device or enter logs, analytics, RPC payloads, or server storage.
- Use official chain-specific transaction serialization and signing flows.
- Add deterministic vectors for key derivation, address derivation, signing, and signature verification.
- Test malformed inputs, chain/network mismatch, nonce/fee errors, rejection, broadcast failure, and duplicate submission.
- Keep send controls disabled until each supported chain passes its own test suite and review.
- Never use fabricated balances, token metadata, prices, or transaction confirmations.

## Scope and branding

This is an integration of open-source wallet-engine code, not a copy of the complete Trust Wallet app. Preserve attribution and all applicable license notices; do not imply Tradingview X is an official Trust Wallet product.
