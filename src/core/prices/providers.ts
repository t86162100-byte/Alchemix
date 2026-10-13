import type { PriceDataProvider } from './types';
import { coinGeckoPriceProvider } from './coingeckoProvider';

const providers: PriceDataProvider[] = [coinGeckoPriceProvider];

export function getPriceDataProvider(): PriceDataProvider {
  return providers[0];
}
