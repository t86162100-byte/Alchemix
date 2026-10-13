export type NativePriceMap = Record<string, number>;

/** Pricing is optional portfolio enrichment, never a source of wallet balances or ownership. */
export interface PriceDataProvider {
  readonly id: string;
  fetchNativePrices(assetIds: string[], quoteCurrency?: string): Promise<NativePriceMap>;
}
