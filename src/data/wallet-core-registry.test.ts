import { describe, expect, it } from 'vitest';
import registry from './wallet-core-registry.json';

describe('pinned Trust Wallet Core chain registry', () => {
  it('contains the complete 4.8.4 registry snapshot', () => {
    expect(registry).toHaveLength(168);
  });

  it('has unique identifiers and native ticker metadata', () => {
    const ids = registry.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(registry.every((entry) => entry.id && entry.name && entry.symbol)).toBe(true);
  });

  it('provides a default derivation path for each registry entry', () => {
    expect(registry.every((entry) => Boolean(entry.derivation?.[0]?.path))).toBe(true);
  });

  it('includes the key networks expected in the wallet directory', () => {
    const ids = new Set(registry.map((entry) => entry.id));
    for (const id of ['ethereum', 'smartchain', 'base', 'polygon', 'bitcoin', 'solana', 'tron', 'aptos', 'sui', 'cosmos']) {
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }
  });
});
