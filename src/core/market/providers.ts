import type { MarketDataProvider } from './types';
import { geckoTerminalProvider } from './geckoTerminalProvider';

/** UI and token parsing depend on this contract, not on a specific vendor API. */
const providers: MarketDataProvider[] = [geckoTerminalProvider];

export function getMarketDataProvider(): MarketDataProvider {
  // A single selection point lets a future provider, local indexer, or self-hosted service
  // replace or supplement the current adapter without changing the Market UI.
  return providers[0];
}

export function getAvailableMarketProviders(): readonly Pick<MarketDataProvider, 'id' | 'displayName'>[] {
  return providers.map(({ id, displayName }) => ({ id, displayName }));
}
