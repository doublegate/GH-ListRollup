/**
 * T-GNR-103: the DOM-backed page model (docs/dom-integration.md section 3).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readListingPage } from '@/github/page';
import { query } from '@/github/selectors';
import { fixtureUrl, loadHtmlFixture, resetDocument } from '../helpers/fixture';

afterEach(() => {
  resetDocument();
});

/** Loads a fixture at its source URL (or `url`) and reads the page model from it. */
const read = (name: string, url?: string) => {
  const doc = loadHtmlFixture(name, url === undefined ? {} : { url });
  return readListingPage(new URL(url ?? fixtureUrl(name)), doc);
};

describe('readListingPage', () => {
  it('reads the default-branch root (main ref from a row, URL without a ref)', () => {
    expect(read('root')).toEqual({
      owner: 'git',
      repo: 'git',
      ref: 'master',
      path: '',
      layout: 'root',
    });
  });

  it('reads a folder page: path from the breadcrumb, ref by subtraction', () => {
    expect(read('folder')).toEqual({
      owner: 'git',
      repo: 'git',
      ref: 'master',
      path: 'contrib',
      layout: 'folder',
    });
  });

  it('reads a two-level folder path from the breadcrumb', () => {
    expect(read('folder-deep')).toMatchObject({ ref: 'master', path: 'contrib/completion' });
  });

  it('reads a tag ref', () => {
    expect(read('root-tag')).toMatchObject({ ref: 'v2.47.0', path: '', layout: 'root' });
  });

  it('reads a full commit SHA ref', () => {
    expect(read('root-sha')).toMatchObject({
      ref: '7fb6055e678f800320d8ab8cd8f201d9493d1ba0',
      layout: 'root',
    });
  });

  it('reads a ref containing slashes, which the URL alone cannot delimit', () => {
    expect(read('root-slash-ref')).toEqual({
      owner: 'refined-github',
      repo: 'sandbox',
      ref: 'branch/with/slashes',
      path: '',
      layout: 'root',
    });
  });

  it('reads the signed-in pages exactly like the signed-out ones', () => {
    expect(read('root-logged-in')).toEqual(read('root'));
    expect(read('folder-logged-in')).toEqual(read('folder'));
  });

  it('treats owner and repo case-insensitively, as GitHub does', () => {
    expect(read('folder', 'https://github.com/Git/GIT/tree/master/contrib')).toMatchObject({
      ref: 'master',
      path: 'contrib',
    });
  });

  it('returns null when the code-view gate fails', () => {
    const doc = loadHtmlFixture('root');
    query('codeView', doc)?.element.removeAttribute('app-name');
    doc.querySelector('meta[name="route-controller"]')?.remove();
    expect(readListingPage(new URL(fixtureUrl('root')), doc)).toBeNull();
  });

  it('returns null on a URL that is not a listing', () => {
    expect(read('root', 'https://github.com/git/git/blob/master/README.md')).toBeNull();
  });

  it('empty repository: a page with the ref unresolved, without throwing', () => {
    // No code-view app and no listing, but the fallback gate (route-controller meta plus the
    // listing-shaped URL) matches (ref-docs/research-update-2026-11-16-phase1-fixtures.md).
    expect(read('empty-repo')).toEqual({
      owner: 'bihealth',
      repo: 'dafthelper',
      ref: null,
      path: '',
      layout: 'root',
    });
  });

  it('never uses a submodule row as the reference row', () => {
    const doc = loadHtmlFixture('root');
    const listing = query('listing', doc)?.element;
    const submoduleRow = [...(listing?.getElementsByTagName('a') ?? [])]
      .find((a) => a.getAttribute('aria-label')?.endsWith('(Submodule)'))
      ?.closest('tr');
    const tbody = submoduleRow?.parentElement;
    if (!submoduleRow || !tbody) throw new Error('no submodule row in the root fixture');
    tbody.insertBefore(submoduleRow, tbody.firstElementChild);
    expect(readListingPage(new URL(fixtureUrl('root')), doc)?.ref).toBe('master');
  });

  it('gives ref null when the rows belong to another page (soft-navigation leftovers)', () => {
    // The folder page's rows, but the URL of a different folder.
    expect(read('folder', 'https://github.com/git/git/tree/master/Documentation')?.ref).toBeNull();
  });

  it('gives ref null and path null when a folder page has no readable breadcrumb', () => {
    const doc = loadHtmlFixture('folder');
    for (const el of doc.querySelectorAll('[data-testid="breadcrumbs"]')) el.remove();
    expect(readListingPage(new URL(fixtureUrl('folder')), doc)).toMatchObject({
      layout: 'folder',
      ref: null,
      path: null,
    });
  });

  // --- review findings on #14 -------------------------------------------------------------------

  it('a root page that lost react-directory-row still reads as a root (Codex, #14)', () => {
    const doc = loadHtmlFixture('root');
    for (const el of doc.querySelectorAll('.react-directory-row')) {
      el.classList.remove('react-directory-row');
    }
    expect(readListingPage(new URL(fixtureUrl('root')), doc)).toMatchObject({
      layout: 'root',
      ref: 'master',
      path: '',
    });
  });

  it('a folder page whose parent link lost its testid still reads as a folder (Codex, #14)', () => {
    const doc = loadHtmlFixture('folder');
    doc.querySelector('a[data-testid="up-tree"]')?.removeAttribute('data-testid');
    for (const el of doc.querySelectorAll('[data-testid="breadcrumbs"]')) {
      el.setAttribute('data-testid', 'gone');
    }
    // Neither the up-tree testid nor the breadcrumb: only the parent link's ARIA label remains.
    expect(readListingPage(new URL(fixtureUrl('folder')), doc)?.layout).toBe('folder');
  });

  const rowLinks = (doc: Document) =>
    [...(query('listing', doc)?.element.getElementsByTagName('a') ?? [])].filter((a) =>
      a.getAttribute('aria-label')?.endsWith(', (Directory)'),
    );

  it('ignores a row link on another origin, even with a matching path (agy, #14)', () => {
    const doc = loadHtmlFixture('root');
    for (const a of rowLinks(doc)) {
      a.setAttribute('href', `https://evil.example${a.getAttribute('href') ?? ''}`);
    }
    // Every folder link is now cross-origin; the ref must come from a file row or not at all.
    const page = readListingPage(new URL(fixtureUrl('root')), doc);
    expect(page?.ref === 'master' || page?.ref === null).toBe(true);
    for (const a of query('listing', doc)?.element.getElementsByTagName('a') ?? []) {
      if (a.getAttribute('aria-label')?.endsWith(', (File)')) a.remove();
    }
    expect(readListingPage(new URL(fixtureUrl('root')), doc)?.ref).toBeNull();
  });

  it('does not accept /tree-other/ as /tree/ (agy, #14)', () => {
    const doc = loadHtmlFixture('root');
    for (const a of query('listing', doc)?.element.getElementsByTagName('a') ?? []) {
      a.setAttribute(
        'href',
        (a.getAttribute('href') ?? '').replace(/^\/git\/git\/(tree|blob)\//, '/git/git/$1-other/'),
      );
    }
    expect(readListingPage(new URL(fixtureUrl('root')), doc)?.ref).toBeNull();
  });

  describe('simplified chains (agy, #14)', () => {
    /** Turns the folder fixture's first directory row into a chain `contrib/<name>/inner`. */
    const makeChain = (doc: Document) => {
      const link = rowLinks(doc)[0];
      if (!link) throw new Error('no directory row');
      const name = (link.getAttribute('aria-label') ?? '').replace(/, \(Directory\)$/, '');
      link.setAttribute('title', 'This path skips through empty directories');
      link.setAttribute('aria-label', `${name}/inner, (Directory)`);
      link.setAttribute('href', `/git/git/tree/master/contrib/${name}/inner`);
      return link;
    };

    it('resolves the ref from a chain when only chains qualify', () => {
      const doc = loadHtmlFixture('folder');
      const chain = makeChain(doc);
      const chainRow = chain.closest('tr');
      for (const row of [...(query('listing', doc)?.element.getElementsByTagName('tr') ?? [])]) {
        if (
          row !== chainRow &&
          row.getElementsByTagName('a')[0]?.getAttribute('data-testid') !== 'up-tree'
        ) {
          row.remove();
        }
      }
      expect(readListingPage(new URL(fixtureUrl('folder')), doc)?.ref).toBe('master');
    });

    it('prefers an ordinary row over an earlier chain', () => {
      const doc = loadHtmlFixture('folder');
      const chain = makeChain(doc);
      // A chain whose href would subtract to a WRONG ref: it must not be used while others exist.
      chain.setAttribute(
        'href',
        `/git/git/tree/wrong/contrib/${chain.getAttribute('aria-label')?.replace(/, \(Directory\)$/, '') ?? ''}`,
      );
      expect(readListingPage(new URL(fixtureUrl('folder')), doc)?.ref).toBe('master');
    });
  });
});
