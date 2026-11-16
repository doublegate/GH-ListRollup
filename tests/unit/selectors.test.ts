/**
 * T-GNR-101: the selectors module, against the HTML fixtures (docs/dom-integration.md section 2).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SELECTORS, query, queryAll } from '@/github/selectors';
import { classifyRows } from '@/github/rows';
import { loadHtmlFixture, resetDocument } from '../helpers/fixture';

afterEach(() => {
  resetDocument();
});

const LISTING_FIXTURES = ['root', 'folder', 'root-logged-in', 'folder-logged-in'] as const;

describe('selectors on the listing fixtures', () => {
  it.each(LISTING_FIXTURES)('%s: every page-level purpose matches at primary rank', (name) => {
    const doc = loadHtmlFixture(name);
    expect(query('codeView', doc)?.rank).toBe('primary');
    const listing = query('listing', doc);
    expect(listing?.rank).toBe('primary');
    const rows = queryAll('rows', listing?.element ?? doc);
    expect(rows.rank).toBe('primary');
    expect(rows.elements.length).toBeGreaterThan(0);
    expect(query('commitDetails', doc)?.rank).toBe('primary');
    expect(query('nameLink', rows.elements[0] ?? doc)?.rank).toBe('primary');
  });

  it.each(LISTING_FIXTURES)('%s: every fallback also matches when used alone', (name) => {
    const doc = loadHtmlFixture(name);
    const listingEl = doc.querySelector(SELECTORS.listing.fallbacks[0]);
    expect(listingEl).not.toBeNull();
    const row = doc.querySelector(
      '[data-testid="directory-content"] tbody > tr.react-directory-row',
    );
    expect(row?.querySelector(SELECTORS.nameLink.fallbacks[0])).not.toBeNull();
    expect(row?.querySelectorAll(SELECTORS.nameCells.fallbacks[0]).length).toBe(2);
  });

  it.each(['root', 'root-logged-in'] as const)('%s has no parent row, at any rank', (name) => {
    const listing = query('listing', loadHtmlFixture(name))?.element;
    expect(listing && query('upTree', listing)).toBeNull();
  });

  it.each(['folder', 'folder-logged-in', 'folder-deep'] as const)(
    '%s: the parent row is found at both ranks and excluded from entry rows',
    (name) => {
      const doc = loadHtmlFixture(name);
      const listing = query('listing', doc)?.element;
      if (!listing) throw new Error('no listing');
      expect(listing.querySelector(SELECTORS.upTree.primary)).not.toBeNull();
      expect(listing.querySelector(SELECTORS.upTree.fallbacks[0])).not.toBeNull();
      const entries = classifyRows(listing, 'git', 'git');
      // The fallback rows selector includes the parent row; classifyRows must drop it.
      expect(listing.querySelectorAll(SELECTORS.rows.fallbacks[0]).length).toBe(entries.length + 1);
    },
  );

  it('classifies the root fixture rows by their label suffixes', () => {
    const listing = query('listing', loadHtmlFixture('root'))?.element;
    if (!listing) throw new Error('no listing');
    const kinds = new Set(classifyRows(listing, 'git', 'git').map((r) => r.kind));
    expect(kinds).toEqual(new Set(['directory', 'file', 'submodule', 'symlink']));
  });

  it('uses the folder fallback only for suffix-less rows with the icon and an in-repo /tree/ link', () => {
    const listing = query('listing', loadHtmlFixture('root'))?.element;
    if (!listing) throw new Error('no listing');
    for (const a of listing.querySelectorAll('a[aria-label]')) {
      a.setAttribute(
        'aria-label',
        (a.getAttribute('aria-label') ?? '').replace(/, \([^)]+\)$/, ''),
      );
    }
    const rows = classifyRows(listing, 'git', 'git');
    const dirs = rows.filter((r) => r.kind === 'directory');
    expect(dirs.length).toBeGreaterThan(0);
    for (const r of dirs) expect(r.href).toMatch(/^\/git\/git\/tree\//);
    // Files, the submodule and the symlink are never expandable without their suffix.
    expect(rows.some((r) => r.kind === 'file' || r.kind === 'submodule')).toBe(false);
    // The submodule links to another repository's /tree/, so the fallback must not take it.
    const submodule = rows.find((r) => r.href?.startsWith('/cr-marcstevens/'));
    expect(submodule).toBeDefined();
    expect(submodule?.kind).toBe('unknown');
  });
});

describe('selector strings stay in selectors.ts (T-GNR-101)', () => {
  const SRC = join(import.meta.dirname, '..', '..', 'src');
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? files(join(dir, e.name))
        : e.name.endsWith('.ts')
          ? [join(dir, e.name)]
          : [],
    );

  it('no file in src/ other than selectors.ts calls a DOM selector API with a string', () => {
    const offenders = files(SRC)
      .filter((f) => !f.endsWith(join('github', 'selectors.ts')))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((line, i) => ({ f, line, n: i + 1 }))
          // DOM method calls (`.closest('tr')`), not this module's own helpers, which take a purpose name.
          .filter(({ line }) => /\.(querySelector(All)?|closest|matches)\(\s*['"`]/.test(line))
          .map(({ f, n }) => `${f.slice(SRC.length + 1)}:${n}`),
      );
    expect(offenders).toEqual([]);
  });

  it('no file in src/ other than selectors.ts calls querySelector at all', () => {
    const offenders = files(SRC).filter(
      (f) =>
        !f.endsWith(join('github', 'selectors.ts')) &&
        /\bquerySelector(All)?\(/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
