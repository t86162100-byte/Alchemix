# Nova Wallet Web

A web-first, multichain wallet dashboard foundation built with React, TypeScript and Vite.

## Current scope
- Connect to an injected EVM wallet (for example, MetaMask or another EIP-1193-compatible wallet).
- Read the connected address and native-token balance on supported EVM networks.
- Switch networks through the connected wallet.
- Send native assets after the wallet provider presents its confirmation prompt.
- Responsive dashboard interface.

## Security scope
This initial release connects to an existing browser wallet; it does **not** generate, import, store, or recover seed phrases/private keys. Private keys stay with the connected wallet provider. Never enter a recovery phrase or private key into this site. Verify transaction details in the wallet confirmation screen.

## Development
```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Render static site
- Build command: `npm install && npm run build`
- Publish directory: `dist`

Future work: add a reviewed multichain adapter (for example Reown AppKit) for WalletConnect and supported Bitcoin/Solana connections, then expand token indexing, swaps, NFT views, and transaction history.