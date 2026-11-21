/**
 * URL builder (T-GNR-203): docs/data-fetching.md §2, docs/security-privacy.md §2.2, and the
 * hostile-name rows of docs/testing-strategy.md §2.
 */
import { describe, expect, it } from 'vitest';
import { InvalidKeyError } from '@/data/errors';
import { buildEntryHref, buildTreeUrl } from '@/data/url';

const key = (over: Partial<{ owner: string; repo: string; ref: string; path: string }> = {}) => ({
  owner: 'git',
  repo: 'git',
  ref: 'master',
  path: '',
  ...over,
});

describe('buildTreeUrl', () => {
  it('builds the root and a folder', () => {
    expect(buildTreeUrl(key()).href).toBe('https://github.com/git/git/tree/master');
    expect(buildTreeUrl(key({ path: 'contrib/completion' })).href).toBe(
      'https://github.com/git/git/tree/master/contrib/completion',
    );
  });

  it('keeps a slash ref in GitHub’s canonical shape', () => {
    expect(
      buildTreeUrl(key({ owner: 'refined-github', repo: 'sandbox', ref: 'branch/with/slashes' }))
        .href,
    ).toBe('https://github.com/refined-github/sandbox/tree/branch/with/slashes');
    expect(buildTreeUrl(key({ ref: 'v1.0', path: 'a' })).pathname).toBe('/git/git/tree/v1.0/a');
  });

  it.each([
    ['#', 'a#b', '/git/git/tree/master/a%23b'],
    ['?', 'a?b', '/git/git/tree/master/a%3Fb'],
    ['%', '100%', '/git/git/tree/master/100%25'],
    ['a literal %2e', '%2e', '/git/git/tree/master/%252e'],
    ['a space', 'my dir', '/git/git/tree/master/my%20dir'],
    ['unicode', 'données', '/git/git/tree/master/donn%C3%A9es'],
    ['an RTL override', 'a‮b', '/git/git/tree/master/a%E2%80%AEb'],
    ['dots inside a name', 'a..b', '/git/git/tree/master/a..b'],
  ])('encodes a name with %s', (_label, path, pathname) => {
    const url = buildTreeUrl(key({ path }));
    expect(url.origin).toBe('https://github.com');
    expect(url.pathname).toBe(pathname);
  });

  it.each([
    ['path traversal', { path: 'a/../../settings' }],
    ['a "." path', { path: '.' }],
    ['a ".." path', { path: '..' }],
    ['an empty segment', { path: 'a//b' }],
    ['a trailing slash', { path: 'a/' }],
    ['a ".." ref segment', { ref: 'main/..' }],
    ['an empty ref', { ref: '' }],
    ['a ".." repo', { repo: '..' }],
    ['a "." owner', { owner: '.' }],
    ['an owner with a slash', { owner: 'a/b' }],
    ['a repo with a space', { repo: 'a b' }],
    ['an over-long owner', { owner: 'a'.repeat(101) }],
  ])('refuses %s with InvalidKeyError', (_label, over) => {
    expect(() => buildTreeUrl(key(over))).toThrow(InvalidKeyError);
  });
});

describe('buildEntryHref', () => {
  const page = { owner: 'git', repo: 'git', ref: 'branch/with/slashes' };

  it('links folders to /tree and files to /blob', () => {
    expect(buildEntryHref(page, { path: 'contrib', kind: 'dir' })).toBe(
      'https://github.com/git/git/tree/branch/with/slashes/contrib',
    );
    expect(buildEntryHref(page, { path: 'contrib/README', kind: 'file' })).toBe(
      'https://github.com/git/git/blob/branch/with/slashes/contrib/README',
    );
  });

  it('encodes hostile names and refuses traversal', () => {
    expect(buildEntryHref(page, { path: 'a#b/c d', kind: 'file' })).toBe(
      'https://github.com/git/git/blob/branch/with/slashes/a%23b/c%20d',
    );
    expect(() => buildEntryHref(page, { path: '../../settings', kind: 'file' })).toThrow(
      InvalidKeyError,
    );
  });
});
