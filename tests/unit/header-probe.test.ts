/**
 * T-GNR-104 (header-line locator) and T-GNR-102 (probe), against the HTML fixtures.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { findHeaderLine } from '@/github/header';
import { formatProbe, probe } from '@/github/probe';
import { query } from '@/github/selectors';
import { loadHtmlFixture, resetDocument } from '../helpers/fixture';

afterEach(() => {
  resetDocument();
});

const LISTINGS = ['root', 'folder', 'root-logged-in', 'folder-logged-in'] as const;

/** Removes every primary hook the fallbacks exist for: the stripped-hooks page of T-GNR-102. */
function stripPrimaryHooks(doc: Document): void {
  query('codeView', doc)?.element.removeAttribute('app-name');
  for (const el of doc.querySelectorAll('[data-testid]')) el.removeAttribute('data-testid');
  for (const el of doc.querySelectorAll('.react-directory-row'))
    el.classList.remove('react-directory-row');
  for (const el of doc.querySelectorAll('.react-directory-filename-cell')) {
    el.classList.remove('react-directory-filename-cell');
  }
}

describe('findHeaderLine (T-GNR-104)', () => {
  it.each(LISTINGS)('%s: the inner row of the commit bar, inside a bordered box', (name) => {
    const doc = loadHtmlFixture(name);
    const line = findHeaderLine(doc);
    expect(line?.rank).toBe('primary');
    const details = query('commitDetails', doc)?.element;
    expect(line?.insertionPoint.contains(details ?? null)).toBe(true);
    expect(line?.box.classList.contains('border')).toBe(true);
    expect(line?.insertionPoint.parentElement).toBe(line?.box);
    // The inner row never contains the listing itself: collapsing must keep this line visible.
    expect(line?.insertionPoint.contains(query('listing', doc)?.element ?? null)).toBe(false);
  });

  it.each(LISTINGS)('%s: the screen-reader heading fallback finds the same inner row', (name) => {
    const doc = loadHtmlFixture(name);
    const primary = findHeaderLine(doc)?.insertionPoint;
    query('commitDetails', doc)?.element.removeAttribute('data-testid');
    const fallback = findHeaderLine(doc);
    expect(fallback?.rank).toBe('fallback1');
    expect(fallback?.insertionPoint).toBe(primary);
  });

  it.each(LISTINGS)(
    '%s: the h2.sr-only rank is tried when only this heading lost its testid (Codex, #14)',
    (name) => {
      const doc = loadHtmlFixture(name);
      const primary = findHeaderLine(doc)?.insertionPoint;
      query('commitDetails', doc)?.element.removeAttribute('data-testid');
      for (const h of doc.querySelectorAll('h2[data-testid="screen-reader-heading"]')) {
        if (h.textContent?.trim() === 'Latest commit') h.removeAttribute('data-testid');
      }
      // Other screen-reader headings ("History", "Folders and files") still carry the testid.
      expect(
        doc.querySelectorAll('h2[data-testid="screen-reader-heading"]').length,
      ).toBeGreaterThan(0);
      expect(findHeaderLine(doc)?.insertionPoint).toBe(primary);
    },
  );

  it('returns null, and probe reports none, when the commit bar is removed', () => {
    const doc = loadHtmlFixture('root');
    const line = findHeaderLine(doc);
    line?.insertionPoint.remove();
    expect(findHeaderLine(doc)).toBeNull();
    expect(probe(doc).headerLine).toBe('none');
  });
});

describe('probe (T-GNR-102)', () => {
  it.each(LISTINGS)('%s: every purpose primary on a fresh fixture', (name) => {
    const report = probe(loadHtmlFixture(name));
    const expectBreadcrumbs = name.startsWith('folder') ? 'primary' : 'none';
    expect(report).toEqual({
      codeView: 'primary',
      listing: 'primary',
      rows: 'primary',
      nameLink: 'primary',
      headerLine: 'primary',
      breadcrumbs: expectBreadcrumbs,
    });
  });

  it('a root page with its primary hooks stripped reports the fallbacks', () => {
    const doc = loadHtmlFixture('root');
    stripPrimaryHooks(doc);
    expect(probe(doc)).toEqual({
      codeView: 'fallback1',
      listing: 'fallback1',
      rows: 'fallback1',
      nameLink: 'fallback1',
      headerLine: 'fallback1',
      breadcrumbs: 'none',
    });
  });

  it('is serializable and formats as one line', () => {
    const report = probe(loadHtmlFixture('folder'));
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    expect(formatProbe(report)).toBe(
      'codeView=primary listing=primary rows=primary nameLink=primary headerLine=primary breadcrumbs=primary',
    );
  });

  it('reports none everywhere on the empty repository except the gate fallback', () => {
    expect(probe(loadHtmlFixture('empty-repo'))).toEqual({
      codeView: 'fallback1',
      listing: 'none',
      rows: 'none',
      nameLink: 'none',
      headerLine: 'none',
      breadcrumbs: 'none',
    });
  });
});
