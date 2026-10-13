export type MarketNetwork = { id: string; name: string };

export type MarketTokenRecord = {
  id: string;
  type?: string;
  attributes?: {
    address?: string; name?: string; symbol?: string; image_url?: string;
    price_usd?: string; fdv_usd?: string; market_cap_usd?: string;
    volume_usd?: { h24?: string };
    price_change_percentage?: { h1?: string; h24?: string; h7d?: string };
  };
};

export type MarketPoolRecord = {
  id?: string;
  attributes?: {
    base_token_price_usd?: string; quote_token_price_usd?: string;
    volume_usd?: { h24?: string };
    price_change_percentage?: { h1?: string; h24?: string; h7d?: string };
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
    quote_token?: { data?: { id?: string } };
  };
};

export type MarketPoolPage = { data?: MarketPoolRecord[]; included?: MarketTokenRecord[] };

/** Implement this contract to add or replace a market-data source without changing UI code. */
export interface MarketDataProvider {
  readonly id: string;
  readonly displayName: string;
  discoverNetworks(): Promise<MarketNetwork[]>;
  fetchPools(networkId: string, page?: number): Promise<MarketPoolPage>;
}
