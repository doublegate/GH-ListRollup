/**
 * parseTreeJson (T-GNR-202): docs/data-fetching.md §2, against every recorded tree-JSON fixture
 * (T-GNR-013), plus a seeded property test.
 */
import { describe, expect, it } from 'vitest';
import { SchemaError } from '@/data/errors';
import { parseTreeJson } from '@/data/parse';
import { loadJsonFixture } from '../helpers/fixture';

const parse = (name: string) => parseTreeJson(loadJsonFixture(name));

describe('parseTreeJson on the fixtures', () => {
  it('root: folders first, refName and commitOid from refInfo, totalCount', () => {
    const { listing, malformed } = parse('root');
    expect(malformed).toBe(0);
    expect(listing.source).toBe('tree-json');
    expect(listing.entries.length).toBeGreaterThan(0);
    expect(listing.totalCount).toBeGreaterThanOrEqual(listing.entries.length);
    expect(listing.refName).not.toBe('');
    expect(listing.commitOid).toMatch(/^[0-9a-f]{40}$/);
    // GitHub's order is kept: folders first, with submodules sorted among them, then files.
    const folderLike = (k: string) => k === 'dir' || k === 'submodule';
    const firstFile = listing.entries.findIndex((e) => !folderLike(e.kind));
    expect(firstFile).toBeGreaterThan(0);
    expect(listing.entries.slice(firstFile).some((e) => folderLike(e.kind))).toBe(false);
  });

  it('nested: paths are repository-relative', () => {
    const { listing } = parse('nested');
    for (const e of listing.entries) {
      expect(e.path.endsWith(e.name)).toBe(true);
      expect(e.path.startsWith('src/vs/')).toBe(true);
    }
  });

  it('capped-1000: keeps totalCount above the 1,000 items returned', () => {
    const { listing } = parse('capped-1000');
    expect(listing.entries).toHaveLength(1000);
    expect(listing.totalCount).toBeGreaterThan(1000);
  });

  it('simplified-chain: marks the chain and keeps the deepest path', () => {
    const chain = parse('simplified-chain').listing.entries.find((e) => e.simplified);
    expect(chain).toEqual({
      name: '.agents/skills/launch',
      path: '.agents/skills/launch',
      kind: 'dir',
      simplified: true,
    });
  });

  it('submodule and symlink-directory: map their content types', () => {
    expect(parse('submodule').listing.entries.some((e) => e.kind === 'submodule')).toBe(true);
    expect(parse('symlink-directory').listing.entries.some((e) => e.kind === 'symlink')).toBe(true);
  });

  it('slash-ref: refName keeps the slashes', () => {
    expect(parse('slash-ref').listing.refName).toBe('branch/with/slashes');
  });
});

describe('parseTreeJson defensively', () => {
  const route = (items: unknown, extra: Record<string, unknown> = {}) => ({
    payload: {
      someFutureRoute: {
        refInfo: { name: 'main', currentOid: 'a'.repeat(40) },
        tree: { items, totalCount: 3 },
        ...extra,
      },
    },
  });

  it('finds the route under any key, not only codeViewTreeRoute', () => {
    const { listing } = parseTreeJson(route([{ name: 'a', path: 'a', contentType: 'directory' }]));
    expect(listing.entries).toEqual([{ name: 'a', path: 'a', kind: 'dir', simplified: false }]);
  });

  it('maps unknown content types to "unknown"', () => {
    const { listing } = parseTreeJson(
      route([{ name: 'x', path: 'x', contentType: 'lfs_pointer' }]),
    );
    expect(listing.entries[0]?.kind).toBe('unknown');
  });

  it('drops and counts malformed items', () => {
    const { listing, malformed } = parseTreeJson(
      route([
        { name: 'ok', path: 'ok', contentType: 'file' },
        { name: '', path: 'x', contentType: 'file' },
        { name: 'x', contentType: 'file' },
        { name: 'x', path: 'x', contentType: 7 },
        null,
        'a string',
      ]),
    );
    expect(listing.entries.map((e) => e.name)).toEqual(['ok']);
    expect(malformed).toBe(5);
  });

  it('falls back when totalCount or the commit OID is missing or invalid', () => {
    const { listing } = parseTreeJson({
      payload: {
        r: { refInfo: { name: 'main', currentOid: 'not-an-oid' }, tree: { items: [] } },
      },
    });
    expect(listing.totalCount).toBe(0);
    expect(listing.commitOid).toBeNull();
  });

  it('uses the requested ref when refInfo is missing', () => {
    const json = { payload: { r: { tree: { items: [] } } } };
    expect(parseTreeJson(json, 'feature/x').listing.refName).toBe('feature/x');
    expect(() => parseTreeJson(json)).toThrow(SchemaError);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['no payload', {}],
    ['a payload without a route', { payload: { a: 1, b: { tree: {} } } }],
    ['items that are not an array', { payload: { r: { tree: { items: {} } } } }],
  ])('throws SchemaError for %s', (_label, json) => {
    expect(() => parseTreeJson(json, 'main')).toThrow(SchemaError);
  });
});

describe('parseTreeJson property: random extra fields never throw except SchemaError', () => {
  /** A small seeded PRNG (mulberry32), so a failure is reproducible from the seed. */
  const rng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const randomValue = (r: () => number, depth: number): unknown => {
    const pick = Math.floor(r() * (depth > 2 ? 5 : 7));
    switch (pick) {
      case 0:
        return null;
      case 1:
        return Math.floor(r() * 1e6) - 5e5;
      case 2:
        return r() < 0.5;
      case 3:
        return Math.random()
          .toString(36)
          .slice(2, 2 + Math.floor(r() * 8));
      case 4:
        return 'directory';
      case 5:
        return Array.from({ length: Math.floor(r() * 4) }, () => randomValue(r, depth + 1));
      default: {
        const o: Record<string, unknown> = {};
        for (let i = 0; i < Math.floor(r() * 4); i++) {
          o[
            ['tree', 'items', 'name', 'path', 'payload', `k${String(i)}`][Math.floor(r() * 6)] ??
              'k'
          ] = randomValue(r, depth + 1);
        }
        return o;
      }
    }
  };

  it('holds for 500 random documents (seed 20261121)', () => {
    const r = rng(20261121);
    const base = loadJsonFixture<{ payload: Record<string, unknown> }>('nested');
    for (let i = 0; i < 500; i++) {
      const doc = structuredClone(base);
      // Add random siblings, including unknown route keys before the real one.
      doc.payload = { [`route${String(i)}`]: randomValue(r, 0), ...doc.payload };
      doc.payload[`extra${String(i)}`] = randomValue(r, 0);
      try {
        parseTreeJson(r() < 0.3 ? randomValue(r, 0) : doc, 'main');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaError);
      }
    }
  });
});
