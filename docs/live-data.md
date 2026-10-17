# Live portfolio data (Step 2)

## Why the wallet uses more than raw RPC

A standard EVM JSON-RPC node can answer `eth_getBalance` for a native coin and `eth_call` for a known ERC-20 contract. It does not provide a standard method to enumerate every token contract an address owns. A wallet needs either:
- an indexed portfolio/token-balance API; or
- a maintained candidate-token list plus on-chain balance checks (which is not complete token discovery).

For that reason, Tradingview X uses an indexed holdings provider for EVM/Solana token discovery and direct chain/explorer APIs for independently checkable native balances. A token registry is metadata, not proof of ownership; only positive holder balances should be shown as owned assets.

## Provider choices and primary documentation

- Alchemy Portfolio API, Tokens By Wallet: https://www.alchemy.com/docs/data/portfolio-apis/portfolio-api-endpoints/portfolio-api-endpoints/get-tokens-by-address
  - Supports native, ERC-20, and SPL holdings across supported EVM networks and Solana.
  - The response can include metadata and USD prices; requests may have per-network partial errors and pagination.
- Ethereum JSON-RPC: https://ethereum.org/developers/docs/apis/json-rpc/
  - `eth_getBalance` returns the native balance in wei.
- Solana RPC: https://solana.com/docs/rpc/http/gettokenaccountsbyowner
  - `getBalance` returns lamports; `getTokenAccountsByOwner` enumerates SPL token accounts for the Token and Token-2022 programs.
  - Solana explicitly warns that shared public RPC endpoints are rate-limited and not production infrastructure: https://solana.com/docs/rpc/providers
- Bitcoin Esplora/mempool API: https://mempool.space/es/docs/api/rest
  - Address stats derive balance from funded minus spent outputs, including confirmed and mempool stats.
- TronGrid account API: https://developers.tron.network/reference/account-getaccount
  - `POST /wallet/getaccount` reads TRX account balance.
- TronScan account token list: https://docs.tronscan.org/en/api/account/account-tokens
  - Indexed TRC-20 holdings endpoint requires an API key.

## Render build environment

Set these under the Render static site's environment variables, then trigger/redeploy the site so Vite embeds the values into the build:

- `VITE_ALCHEMY_API_KEY`: an Alchemy API key. The frontend uses Alchemy Portfolio API for indexed EVM/Solana holdings and metadata, with Routescan retained as an EVM fallback.
- `VITE_SOLANA_RPC_URL`: optional full HTTPS RPC URL for Solana, including any provider query parameters/API key. Prefer a dedicated provider endpoint over shared public RPCs.

**Important:** every `VITE_*` value is included in browser-delivered JavaScript and is visible to users. Restrict the Alchemy key by allowed origins and quotas. Do not put an unrestricted secret in a `VITE_*` variable. The current static-site integration reads `VITE_TRONSCAN_API_KEY` in the browser, so that key would also be public; production TRC-20 access should move behind a server-side API proxy with rate limiting and CORS restrictions before a real TronScan key is added.

Do not use a wallet recovery phrase, private key, or password as a provider credential. These balance requests need public wallet addresses only.

## Correctness rules

- Keep chain/network identifiers separate; do not merge same-symbol assets across chains.
- Store the contract/mint address and decimals returned by the chain/provider.
- Parse raw token quantities with integer arithmetic before formatting; never use JavaScript floating-point math for raw base-unit conversion.
- Deduplicate by chain + contract/mint, not symbol.
- Treat provider failure, partial indexer failure, and a verified zero balance as different states.
- Do not display a token from a token list as owned unless a positive balance is returned.
- Only include positive holdings in priced/unpriced asset counts. A total is partial if any positive holding lacks a verifiable price.
- Prices are estimates and should be timestamped; never substitute a guessed price.
- Add pagination for indexed holdings and surface provider partial errors rather than reporting an empty portfolio.

## Deployment validation checklist

After changing provider configuration and waiting for Render to finish a successful build:

1. Open the wallet, unlock it, and press **Refresh**.
2. Confirm the network address displayed in the receive section matches the address queried for that chain.
3. Compare native balances against an independent explorer for that exact address.
4. For a known ERC-20/SPL/TRC-20 holding, compare the contract/mint and raw balance with the explorer/provider.
5. Test an address with no holdings. It should show a verified zero only when the provider request succeeded.
6. Temporarily test an invalid/unavailable provider URL; the UI should show an error/partial state, never fabricate zero.
7. Test a wallet with more tokens than one API page to verify pagination.
8. Inspect browser Network/Console for CORS, HTTP 401/403/429/400, and malformed response errors.

A successful Vite build confirms compilation only. It does not prove that public providers allow browser CORS, that an API key is configured, or that an endpoint returns correct live data.