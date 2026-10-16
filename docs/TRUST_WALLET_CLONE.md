# Trust Wallet clone/rebuild branch

This branch is reserved for a Trust Wallet-inspired rebuild of Tradingview X.

## Upstream open-source references
- Trust Wallet Core (cryptographic wallet engine): https://github.com/trustwallet/wallet-core
- Trust Wallet developer integration guide: https://github.com/trustwallet/developer/blob/master/wallet-core/integration-guide.md

Trust Wallet Core is Apache-2.0 licensed. Preserve its license and notices for any code incorporated, and review third-party licenses. Do not use Trust Wallet branding or imply this product is official Trust Wallet.

## Important compatibility note
The current Alchemix/Tradingview X project is a web app. Trust Wallet Core is primarily a cross-platform native wallet library (with additional WebAssembly/NPM options). The full Trust Wallet product is not just Wallet Core; app code, platform integrations, assets, and services differ. We must inspect the web app and choose a compatible integration route before transplanting source code.

## Status
- Branch created from `main`: `trust-wallet-clone`.
- This commit documents upstream references only; it does not contain a copy of Trust Wallet's full application or Wallet Core source tree.
- Next action: import/vendor the licensed upstream source using Git tooling, then audit build compatibility and connect it behind Tradingview X's existing UI. Do not enable real-money sends until transaction tests and security review pass.
