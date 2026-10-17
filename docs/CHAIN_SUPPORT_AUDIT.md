# Chain Support Audit — Trust Wallet Clone

**Branch:** `trust-wallet-clone`  
**Registry snapshot:** pinned Trust Wallet Core 4.8.4, 168 entries.  
**Purpose:** classify metadata and separate address derivation from live balance/token integration. This is a source-level inventory, not proof that every provider endpoint is live.

## Current implementation facts

- The registry has 168 entries across 57 blockchain labels.
- 61 entries are labeled `Ethereum`; these are candidates for EVM JSON-RPC, but an entry is only included in live EVM balance polling when it has a numeric chain ID, a derivation path, and a configured RPC URL or an explicit RPC override.
- Native balance retrieval and token discovery are separate capabilities. A successful native balance does **not** prove token enumeration is complete.
- EVM token discovery uses Routescan holdings as a fallback indexer; Alchemy Portfolio integration currently has explicit mappings only for Ethereum, BNB Chain, Base, and Solana.
- Solana RPC reads SOL and SPL/Token-2022 token accounts. Bitcoin currently reads BTC UTXO balances; it does not imply every Bitcoin-family registry entry is implemented.
- The 168 entries must not be advertised as 168 fully integrated networks until each row has address-vector tests, a live native balance provider, and a token-discovery status appropriate to its ecosystem.

## Implementation order

1. **Derivation verification:** test every supported path against official/reference vectors, including address format and network-specific derivation caveats.
2. **EVM:** native balances via chain RPC, ERC-20 holdings via an indexer, per-network failure state, token contract deduplication.
3. **UTXO families:** chain-specific address encodings and explorer APIs; avoid treating all UTXO coins as Bitcoin mainnet.
4. **Non-EVM:** implement separate provider adapters for Solana, Cosmos SDK, Aptos, Sui, XRPL, Stellar, TON, and other distinct ecosystems.
5. **Coverage reporting:** show each chain as `verified`, `native-only`, `token-discovery-partial`, or `unavailable`; never equate registry presence with live support.
6. **Regression:** test raw integer balances, decimals, zero vs provider failure, duplicate tokens, pagination, timeout/fallback behavior, and portfolio aggregation.

## Registry family counts

- Ethereum: 61
- Cosmos: 32
- Bitcoin: 14
- Verge: 2
- Zcash: 2
- BitcoinCash: 2
- Stellar: 2
- EOS: 2
- Polkadot: 2
- Binance: 2
- Groestlcoin: 1
- Decred: 1
- Icon: 1
- Zen: 1
- Aptos: 1
- Sui: 1
- Komodo: 1
- Ripple: 1
- Nano: 1
- Tron: 1
- FIO: 1
- Nimiq: 1
- Algorand: 1
- IoTeX: 1
- Nervos: 1
- Zilliqa: 1
- Everscale: 1
- NEAR: 1
- Aion: 1
- Kusama: 1
- Aeternity: 1
- Filecoin: 1
- Theta: 1
- Solana: 1
- MultiversX: 1
- Vechain: 1
- NEO: 1
- BitcoinDiamond: 1
- Harmony: 1
- OasisNetwork: 1
- Ontology: 1
- Tezos: 1
- Cardano: 1
- Nebulas: 1
- NULS: 1
- Waves: 1
- Thorchain: 1
- Ronin: 1
- IOST: 1
- NativeEvmos: 1
- Greenfield: 1
- Hedera: 1
- NativeInjective: 1
- TheOpenNetwork: 1
- InternetComputer: 1
- Pactus: 1
- Polymesh: 1

## Per-entry inventory

| Registry ID | Name | Family | Symbol | Decimals | Chain ID | Default derivation path | RPC metadata |
|---|---|---|---|---:|---|---|---|
| `bitcoin` | Bitcoin | Bitcoin | BTC | 8 | — | `m/84'/0'/0'/0/0` | missing |
| `litecoin` | Litecoin | Bitcoin | LTC | 8 | — | `m/84'/2'/0'/0/0` | missing |
| `doge` | Dogecoin | Bitcoin | DOGE | 8 | — | `m/44'/3'/0'/0/0` | missing |
| `dash` | Dash | Bitcoin | DASH | 8 | — | `m/44'/5'/0'/0/0` | missing |
| `viacoin` | Viacoin | Bitcoin | VIA | 8 | — | `m/84'/14'/0'/0/0` | missing |
| `groestlcoin` | Groestlcoin | Groestlcoin | GRS | 8 | — | `m/84'/17'/0'/0/0` | missing |
| `digibyte` | DigiByte | Bitcoin | DGB | 8 | — | `m/84'/20'/0'/0/0` | missing |
| `monacoin` | Monacoin | Bitcoin | MONA | 8 | — | `m/44'/22'/0'/0/0` | missing |
| `decred` | Decred | Decred | DCR | 8 | — | `m/44'/42'/0'/0/0` | missing |
| `syscoin` | Syscoin | Bitcoin | SYS | 8 | — | `m/84'/57'/0'/0/0` | present |
| `base` | Base | Ethereum | ETH | 18 | 8453 | `m/44'/60'/0'/0/0` | present |
| `linea` | Linea | Ethereum | ETH | 18 | 59144 | `m/44'/60'/0'/0/0` | present |
| `mantle` | Mantle | Ethereum | MNT | 18 | 5000 | `m/44'/60'/0'/0/0` | present |
| `zeneon` | Zen EON | Ethereum | ZEN | 18 | 7332 | `m/44'/60'/0'/0/0` | present |
| `ethereum` | Ethereum | Ethereum | ETH | 18 | 1 | `m/44'/60'/0'/0/0` | present |
| `classic` | Ethereum Classic | Ethereum | ETC | 18 | 61 | `m/44'/61'/0'/0/0` | present |
| `icon` | ICON | Icon | ICX | 18 | — | `m/44'/74'/0'/0/0` | present |
| `verge` | Verge | Verge | XVG | 6 | — | `m/84'/77'/0'/0/0` | missing |
| `pivx` | Pivx | Bitcoin | PIVX | 8 | — | `m/44'/119'/0'/0/0` | missing |
| `zen` | Zen | Zen | ZEN | 8 | — | `m/44'/121'/0'/0/0` | missing |
| `aptos` | Aptos | Aptos | APT | 8 | 1 | `m/44'/637'/0'/0'/0'` | present |
| `sui` | Sui | Sui | SUI | 9 | — | `m/44'/784'/0'/0'/0'` | present |
| `cosmos` | Cosmos | Cosmos | ATOM | 6 | cosmoshub-4 | `m/44'/118'/0'/0/0` | present |
| `stargaze` | Stargaze | Cosmos | STARS | 6 | stargaze-1 | `m/44'/118'/0'/0/0` | present |
| `juno` | Juno | Cosmos | JUNO | 6 | juno-1 | `m/44'/118'/0'/0/0` | present |
| `stride` | Stride | Cosmos | STRD | 6 | stride-1 | `m/44'/118'/0'/0/0` | present |
| `axelar` | Axelar | Cosmos | AXL | 6 | axelar-dojo-1 | `m/44'/118'/0'/0/0` | present |
| `crescent` | Crescent | Cosmos | CRE | 6 | crescent-1 | `m/44'/118'/0'/0/0` | present |
| `kujira` | Kujira | Cosmos | KUJI | 6 | kaiyo-1 | `m/44'/118'/0'/0/0` | present |
| `comdex` | Comdex | Cosmos | CMDX | 6 | comdex-1 | `m/44'/118'/0'/0/0` | missing |
| `neutron` | Neutron | Cosmos | NTRN | 6 | neutron-1 | `m/44'/118'/0'/0/0` | missing |
| `sommelier` | Sommelier | Cosmos | SOMM | 6 | sommelier-3 | `m/44'/118'/0'/0/0` | missing |
| `fetchai` | FetchAI | Cosmos | FET | 6 | fetchhub-4 | `m/44'/118'/0'/0/0` | missing |
| `mars` | Mars | Cosmos | MARS | 6 | mars-1 | `m/44'/118'/0'/0/0` | missing |
| `umee` | Umee | Cosmos | UMEE | 6 | umee-1 | `m/44'/118'/0'/0/0` | missing |
| `noble` | Noble | Cosmos | USDC | 6 | noble-1 | `m/44'/118'/0'/0/0` | missing |
| `sei` | Sei | Cosmos | SEI | 6 | pacific-1 | `m/44'/118'/0'/0/0` | missing |
| `tia` | Tia | Cosmos | TIA | 6 | celestia | `m/44'/118'/0'/0/0` | missing |
| `coreum` | Coreum | Cosmos | CORE | 6 | coreum-mainnet-1 | `m/44'/990'/0'/0/0` | missing |
| `quasar` | Quasar | Cosmos | QSR | 6 | quasar-1 | `m/44'/118'/0'/0/0` | missing |
| `persistence` | Persistence | Cosmos | XPRT | 6 | core-1 | `m/44'/118'/0'/0/0` | missing |
| `akash` | Akash | Cosmos | AKT | 6 | akashnet-2 | `m/44'/118'/0'/0/0` | missing |
| `zcash` | Zcash | Zcash | ZEC | 8 | — | `m/44'/133'/0'/0/0` | missing |
| `firo` | Firo | Bitcoin | FIRO | 8 | — | `m/44'/136'/0'/0/0` | missing |
| `komodo` | Komodo | Komodo | KMD | 8 | — | `m/44'/141'/0'/0/0` | missing |
| `ripple` | XRP | Ripple | XRP | 6 | — | `m/44'/144'/0'/0/0` | present |
| `bitcoincash` | Bitcoin Cash | BitcoinCash | BCH | 8 | — | `m/44'/145'/0'/0/0` | missing |
| `stellar` | Stellar | Stellar | XLM | 7 | — | `m/44'/148'/0'` | present |
| `bitcoingold` | Bitcoin Gold | Bitcoin | BTG | 8 | — | `m/84'/156'/0'/0/0` | missing |
| `nano` | Nano | Nano | XNO | 30 | — | `m/44'/165'/0'` | missing |
| `ravencoin` | Ravencoin | Bitcoin | RVN | 8 | — | `m/44'/175'/0'/0/0` | missing |
| `poa` | POA Network | Ethereum | POA | 18 | 99 | `m/44'/178'/0'/0/0` | present |
| `eos` | EOS | EOS | EOS | 4 | — | `m/44'/194'/0'/0/0` | missing |
| `wax` | WAX | EOS | WAXP | 4 | — | `m/44'/194'/0'/0/0` | present |
| `tron` | Tron | Tron | TRX | 6 | — | `m/44'/195'/0'/0/0` | present |
| `fio` | FIO | FIO | FIO | 9 | — | `m/44'/235'/0'/0/0` | present |
| `nimiq` | Nimiq | Nimiq | NIM | 5 | — | `m/44'/242'/0'/0'` | missing |
| `algorand` | Algorand | Algorand | ALGO | 6 | — | `m/44'/283'/0'/0'/0'` | present |
| `iotex` | IoTeX | IoTeX | IOTX | 18 | — | `m/44'/304'/0'/0/0` | missing |
| `iotexevm` | IoTeX EVM | Ethereum | IOTX | 18 | 4689 | `m/44'/304'/0'/0/0` | missing |
| `nervos` | Nervos | Nervos | CKB | 8 | — | `m/44'/309'/0'/0/0` | present |
| `zilliqa` | Zilliqa | Zilliqa | ZIL | 12 | — | `m/44'/313'/0'/0/0` | present |
| `terra` | Terra | Cosmos | LUNC | 6 | columbus-5 | `m/44'/330'/0'/0/0` | present |
| `terrav2` | TerraV2 | Cosmos | LUNA | 6 | phoenix-1 | `m/44'/330'/0'/0/0` | present |
| `polkadot` | Polkadot | Polkadot | DOT | 10 | — | `m/44'/354'/0'/0'/0'` | missing |
| `everscale` | Everscale | Everscale | EVER | 9 | — | `m/44'/396'/0'/0/0` | present |
| `near` | NEAR | NEAR | NEAR | 24 | — | `m/44'/397'/0'` | present |
| `aion` | Aion | Aion | AION | 18 | — | `m/44'/425'/0'/0'/0'` | missing |
| `kusama` | Kusama | Kusama | KSM | 12 | — | `m/44'/434'/0'/0'/0'` | present |
| `acala` | Acala | Polkadot | ACA | 12 | — | `m/44'/787'/0'/0'/0'` | present |
| `acalaevm` | Acala EVM | Ethereum | ACA | 18 | 787 | `m/44'/60'/0'/0/0` | present |
| `aeternity` | Aeternity | Aeternity | AE | 18 | — | `m/44'/457'/0'/0'/0'` | present |
| `kava` | Kava | Cosmos | KAVA | 6 | kava_2222-10 | `m/44'/459'/0'/0/0` | present |
| `filecoin` | Filecoin | Filecoin | FIL | 18 | — | `m/44'/461'/0'/0/0` | missing |
| `bluzelle` | Bluzelle | Cosmos | BLZ | 6 | — | `m/44'/483'/0'/0/0` | present |
| `band` | BandChain | Cosmos | BAND | 6 | laozi-mainnet | `m/44'/494'/0'/0/0` | present |
| `theta` | Theta | Theta | THETA | 18 | — | `m/44'/500'/0'/0/0` | missing |
| `tfuelevm` | Theta Fuel | Ethereum | TFUEL | 18 | 361 | `m/44'/500'/0'/0/0` | present |
| `solana` | Solana | Solana | SOL | 9 | — | `m/44'/501'/0'` | present |
| `elrond` | MultiversX | MultiversX | eGLD | 18 | — | `m/44'/508'/0'/0'/0'` | present |
| `binance` | Binance | Binance | BNB | 8 | Binance-Chain-Tigris | `m/44'/714'/0'/0/0` | present |
| `tbinance` | TBinance | Binance | BNB | 8 | — | `m/44'/714'/0'/0/0` | present |
| `vechain` | VeChain | Vechain | VET | 18 | 74 | `m/44'/818'/0'/0/0` | missing |
| `callisto` | Callisto | Ethereum | CLO | 18 | 820 | `m/44'/820'/0'/0/0` | present |
| `neo` | NEO | NEO | NEO | 8 | — | `m/44'/888'/0'/0/0` | present |
| `viction` | Viction | Ethereum | VIC | 18 | 88 | `m/44'/889'/0'/0/0` | present |
| `bitcoindiamond` | Bitcoin Diamond | BitcoinDiamond | BCD | 7 | — | `m/84'/999'/0'/0/0` | missing |
| `thundertoken` | ThunderCore | Ethereum | TT | 18 | 108 | `m/44'/1001'/0'/0/0` | present |
| `harmony` | Harmony | Harmony | ONE | 18 | — | `m/44'/1023'/0'/0/0` | missing |
| `oasis` | Oasis | OasisNetwork | ROSE | 9 | — | `m/44'/474'/0'` | present |
| `ontology` | Ontology | Ontology | ONT | 0 | — | `m/44'/1024'/0'/0/0` | present |
| `tezos` | Tezos | Tezos | XTZ | 6 | — | `m/44'/1729'/0'/0'` | present |
| `cardano` | Cardano | Cardano | ADA | 6 | — | `m/1852'/1815'/0'/0/0` | missing |
| `kin` | Kin | Stellar | KIN | 5 | — | `m/44'/2017'/0'` | present |
| `qtum` | Qtum | Bitcoin | QTUM | 8 | — | `m/44'/2301'/0'/0/0` | missing |
| `nebulas` | Nebulas | Nebulas | NAS | 18 | — | `m/44'/2718'/0'/0/0` | present |
| `gochain` | GoChain | Ethereum | GO | 18 | 60 | `m/44'/6060'/0'/0/0` | present |
| `nuls` | NULS | NULS | NULS | 8 | — | `m/44'/8964'/0'/0/0` | present |
| `zelcash` | Zelcash | Zcash | FLUX | 8 | — | `m/44'/19167'/0'/0/0` | present |
| `wanchain` | Wanchain | Ethereum | WAN | 18 | 888 | `m/44'/5718350'/0'/0/0` | missing |
| `waves` | Waves | Waves | WAVES | 8 | — | `m/44'/5741564'/0'/0'/0'` | present |
| `bsc` | Smart Chain Legacy | Ethereum | BNB | 18 | 56 | `m/44'/714'/0'/0/0` | present |
| `smartchain` | Smart Chain | Ethereum | BNB | 18 | 56 | `m/44'/60'/0'/0/0` | present |
| `polygon` | Polygon | Ethereum | POL | 18 | 137 | `m/44'/60'/0'/0/0` | present |
| `rootstock` | Rootstock | Ethereum | RBTC | 18 | 30 | `m/44'/137'/0'/0/0` | present |
| `thorchain` | THORChain | Thorchain | RUNE | 8 | thorchain-1 | `m/44'/931'/0'/0/0` | present |
| `optimism` | Optimism | Ethereum | ETH | 18 | 10 | `m/44'/60'/0'/0/0` | present |
| `polygonzkevm` | Polygon zkEVM | Ethereum | ETH | 18 | 1101 | `m/44'/60'/0'/0/0` | present |
| `zksync` | Zksync | Ethereum | ETH | 18 | 324 | `m/44'/60'/0'/0/0` | present |
| `scroll` | Scroll | Ethereum | ETH | 18 | 534352 | `m/44'/60'/0'/0/0` | present |
| `arbitrum` | Arbitrum | Ethereum | ETH | 18 | 42161 | `m/44'/60'/0'/0/0` | present |
| `arbitrumnova` | Arbitrum Nova | Ethereum | ETH | 18 | 42170 | `m/44'/60'/0'/0/0` | present |
| `heco` | ECO Chain | Ethereum | HT | 18 | 128 | `m/44'/60'/0'/0/0` | present |
| `avalanchec` | Avalanche C-Chain | Ethereum | AVAX | 18 | 43114 | `m/44'/60'/0'/0/0` | missing |
| `xdai` | xDai | Ethereum | xDAI | 18 | 100 | `m/44'/60'/0'/0/0` | missing |
| `fantom` | Fantom | Ethereum | FTM | 18 | 250 | `m/44'/60'/0'/0/0` | missing |
| `cryptoorg` | CryptoOrg | Cosmos | CRO | 8 | crypto-org-chain-mainnet-1 | `m/44'/394'/0'/0/0` | missing |
| `celo` | Celo | Ethereum | CELO | 18 | 42220 | `m/44'/60'/0'/0/0` | missing |
| `ronin` | Ronin | Ronin | RON | 18 | 2020 | `m/44'/60'/0'/0/0` | missing |
| `secret` | Secret | Cosmos | SCRT | 6 | secret-4 | `m/44'/529'/0'/0/0` | present |
| `osmosis` | Osmosis | Cosmos | OSMO | 6 | osmosis-1 | `m/44'/118'/0'/0/0` | missing |
| `ecash` | eCash | BitcoinCash | XEC | 2 | — | `m/44'/899'/0'/0/0` | present |
| `iost` | IOST | IOST | IOST | 2 | — | `m/44'/899'/0'/0/0` | missing |
| `cronos` | Cronos Chain | Ethereum | CRO | 18 | 25 | `m/44'/60'/0'/0/0` | missing |
| `kavaevm` | KavaEvm | Ethereum | KAVA | 18 | 2222 | `m/44'/60'/0'/0/0` | present |
| `smartbch` | Smart Bitcoin Cash | Ethereum | BCH | 18 | 10000 | `m/44'/60'/0'/0/0` | present |
| `kcc` | KuCoin Community Chain | Ethereum | KCS | 18 | 321 | `m/44'/60'/0'/0/0` | present |
| `boba` | Boba | Ethereum | BOBAETH | 18 | 288 | `m/44'/60'/0'/0/0` | present |
| `metis` | Metis | Ethereum | METIS | 18 | 1088 | `m/44'/60'/0'/0/0` | present |
| `aurora` | Aurora | Ethereum | ETH | 18 | 1313161554 | `m/44'/60'/0'/0/0` | present |
| `evmos` | Evmos | Ethereum | EVMOS | 18 | 9001 | `m/44'/60'/0'/0/0` | present |
| `nativeevmos` | NativeEvmos | NativeEvmos | EVMOS | 18 | evmos_9001-2 | `m/44'/60'/0'/0/0` | missing |
| `moonriver` | Moonriver | Ethereum | MOVR | 18 | 1285 | `m/44'/60'/0'/0/0` | present |
| `moonbeam` | Moonbeam | Ethereum | GLMR | 18 | 1284 | `m/44'/60'/0'/0/0` | present |
| `kaia` | Kaia | Ethereum | KAIA | 18 | 8217 | `m/44'/60'/0'/0/0` | present |
| `meter` | Meter | Ethereum | MTR | 18 | 82 | `m/44'/60'/0'/0/0` | present |
| `okc` | OKX Chain | Ethereum | OKT | 18 | 66 | `m/44'/60'/0'/0/0` | present |
| `cfxevm` | Conflux eSpace | Ethereum | CFX | 18 | 1030 | `m/44'/60'/0'/0/0` | present |
| `greenfield` | Greenfield | Greenfield | BNB | 18 | 1017 | `m/44'/60'/0'/0/0` | present |
| `opbnb` | OpBNB | Ethereum | BNB | 18 | 204 | `m/44'/60'/0'/0/0` | present |
| `stratis` | Stratis | Bitcoin | STRAX | 8 | — | `m/44'/105105'/0'/0/0` | missing |
| `Nebl` | Nebl | Verge | NEBL | 8 | — | `m/44'/146'/0'/0/0` | missing |
| `hedera` | Hedera | Hedera | HBAR | 8 | — | `m/44'/3030'/0'/0'/0` | missing |
| `agoric` | Agoric | Cosmos | BLD | 6 | agoric-3 | `m/44'/564'/0'/0/0` | present |
| `dydx` | Dydx | Cosmos | DYDX | 18 | dydx-mainnet-1 | `m/44'/118'/0'/0/0` | present |
| `nativeinjective` | NativeInjective | NativeInjective | INJ | 18 | injective-1 | `m/44'/60'/0'/0/0` | missing |
| `nativecanto` | NativeCanto | Cosmos | CANTO | 18 | canto_7700-1 | `m/44'/60'/0'/0/0` | missing |
| `zetachain` | NativeZetaChain | Cosmos | ZETA | 18 | zetachain_7000-1 | `m/44'/60'/0'/0/0` | missing |
| `zetaevm` | Zeta EVM | Ethereum | ZETA | 18 | 7000 | `m/44'/60'/0'/0/0` | missing |
| `ton` | TON | TheOpenNetwork | GRAM | 9 | — | `m/44'/607'/0'` | present |
| `neon` | Neon | Ethereum | NEON | 18 | 245022934 | `m/44'/60'/0'/0/0` | present |
| `internet_computer` | Internet Computer | InternetComputer | ICP | 8 | — | `m/44'/223'/0'/0/0` | missing |
| `manta` | Manta Pacific | Ethereum | ETH | 18 | 169 | `m/44'/60'/0'/0/0` | present |
| `merlin` | Merlin | Ethereum | BTC | 18 | 4200 | `m/44'/60'/0'/0/0` | present |
| `lightlink` | Lightlink | Ethereum | ETH | 18 | 1890 | `m/44'/60'/0'/0/0` | present |
| `blast` | Blast | Ethereum | ETH | 18 | 81457 | `m/44'/60'/0'/0/0` | present |
| `bouncebit` | BounceBit | Ethereum | BB | 18 | 6001 | `m/44'/60'/0'/0/0` | present |
| `zklinknova` | ZkLinkNova | Ethereum | ETH | 18 | 810180 | `m/44'/60'/0'/0/0` | present |
| `sonic` | Sonic | Ethereum | S | 18 | 146 | `m/44'/60'/0'/0/0` | present |
| `pactus` | Pactus | Pactus | PAC | 9 | — | `m/44'/21888'/3'/0'` | present |
| `polymesh` | Polymesh | Polymesh | POLYX | 6 | — | `m/44'/595'/0'/0'/0'` | present |
| `plasma` | Plasma | Ethereum | XPL | 18 | 9745 | `m/44'/60'/0'/0/0` | present |
| `monad` | Monad | Ethereum | MON | 18 | 143 | `m/44'/60'/0'/0/0` | present |
| `megaeth` | MegaETH | Ethereum | ETH | 18 | 4326 | `m/44'/60'/0'/0/0` | present |
| `seievm` | Sei EVM | Ethereum | SEI | 18 | 1329 | `m/44'/60'/0'/0/0` | present |
| `hyperevm` | HyperEVM | Ethereum | HYPE | 18 | 999 | `m/44'/60'/0'/0/0` | present |
| `robinhoodchain` | Robinhood Chain | Ethereum | ETH | 18 | 4663 | `m/44'/60'/0'/0/0` | present |
| `arc` | Arc | Ethereum | USDC | 18 | 5042 | `m/44'/60'/0'/0/0` | missing |

## Important caveats

- Registry fields are metadata and can be stale or incomplete. RPC URLs must be health-checked before a network is considered live.
- A chain-specific symbol or decimals value is not sufficient to determine an asset's full metadata.
- For chains with multiple derivation variants (e.g. Bitcoin SegWit/legacy/Taproot), one default path does not represent all address formats.
- Unknown tokens should be identified by verified contract/mint/asset ID rather than guessed symbol or name.
