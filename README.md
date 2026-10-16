# Tradingview X

A clean, self-custodial multichain wallet project. This branch starts with a fresh web application shell and pins the official Trust Wallet Core source as a Git submodule.

## Source import

- Upstream: https://github.com/trustwallet/wallet-core
- Pinned revision: `adf80f8bac989e18a4ef1922e2b9eaeb4bf804a9`
- License: Apache-2.0; preserve upstream and third-party notices.
- Initialize the source after cloning: `git submodule update --init --recursive`

Trust Wallet Core is the cryptographic engine, not the complete Trust Wallet application. Tradingview X is an independent project and is not affiliated with Trust Wallet.

## Run the web shell

Requirements: Node.js 20 or newer.

```sh
npm install
npm run dev
```

Build the static web shell with `npm run build`; output is written to `dist/`.

## Security status

This is the clean starting scaffold, not a production wallet yet. Wallet creation, encrypted local key storage, recovery, address derivation, chain adapters, token discovery, transaction construction, signing, and broadcast must be implemented and tested before real funds are used. No real-money send action is enabled in this scaffold.
