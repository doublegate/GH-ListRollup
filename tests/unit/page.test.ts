import { describe, expect, it } from 'vitest';
import { detectPage, pageKey } from '@/github/page';

const at = (path: string) => detectPage(new URL(`https://github.com${path}`));

describe('detectPage', () => {
  it('classifies a repository root', () => {
    expect(at('/wxt-dev/wxt')).toEqual({ kind: 'repo-root', owner: 'wxt-dev', repo: 'wxt' });
  });

  it('classifies the root listing at a ref as repo-root', () => {
    expect(at('/wxt-dev/wxt/tree/main').kind).toBe('repo-root');
  });

  it('classifies folder pages as repo-tree', () => {
    expect(at('/microsoft/vscode/tree/main/src/vs').kind).toBe('repo-tree');
  });

  it('treats a slash-containing ref plus path as repo-tree without parsing the ref', () => {
    expect(at('/refined-github/sandbox/tree/branch/with/slashes').kind).toBe('repo-tree');
  });

  it('treats a bare /tree with no ref as other, not repo-root (bootstrap review, #8)', () => {
    expect(at('/wxt-dev/wxt/tree').kind).toBe('other');
    expect(at('/wxt-dev/wxt/tree/').kind).toBe('other');
  });

  it('ignores trailing slashes and query strings', () => {
    expect(at('/wxt-dev/wxt/?tab=readme-ov-file').kind).toBe('repo-root');
  });

  it.each([
    '/',
    '/wxt-dev',
    '/wxt-dev/wxt/blob/main/README.md',
    '/wxt-dev/wxt/issues',
    '/wxt-dev/wxt/pulls/1',
    '/settings/profile',
    '/orgs/wxt-dev/repositories',
    '/search/code',
  ])('returns other for %s', (path) => {
    expect(at(path).kind).toBe('other');
  });

  it('returns other for non-github hosts', () => {
    expect(detectPage(new URL('https://gist.github.com/a/b')).kind).toBe('other');
  });

  it('rejects owner names with characters GitHub does not allow', () => {
    expect(at('/bad%20name/repo').kind).toBe('other');
  });
});

describe('pageKey', () => {
  const key = (u: string) => pageKey(new URL(u));

  it('ignores the fragment, so in-page anchors do not count as navigations (#8)', () => {
    expect(key('https://github.com/o/r#readme')).toBe(key('https://github.com/o/r'));
  });

  it('distinguishes path and query changes', () => {
    expect(key('https://github.com/o/r/tree/main/src')).not.toBe(key('https://github.com/o/r'));
    expect(key('https://github.com/o/r?tab=x')).not.toBe(key('https://github.com/o/r'));
  });
});
