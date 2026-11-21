/**
 * Staleness when `ref` cannot be resolved on either side (issue #17): rows identical to the previous
 * page's count as stale only while the listing container is the same node.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import { CollapseController } from '@/features/collapse';
import { query } from '@/github/selectors';
import { fixtureUrl, loadHtmlFixture, resetDocument } from '../helpers/fixture';

// A root with only files and no label suffixes leaves `ref` unresolved: model that directly.
vi.mock('@/github/page', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/github/page')>();
  return {
    ...real,
    readListingPage: (url: URL, doc: Document) => {
      const page = real.readListingPage(url, doc);
      return page ? { ...page, ref: null } : null;
    },
  };
});

let ctx: ContentScriptContext;
beforeEach(() => {
  ctx = new ContentScriptContext('test');
});
afterEach(() => {
  ctx.notifyInvalidated();
  resetDocument();
});

it('identical rows in the same node are stale; in a new node they are the new page', () => {
  const doc = loadHtmlFixture('root');
  const controller = new CollapseController(ctx, doc);
  expect(controller.apply(new URL(fixtureUrl('root')))).toBe('applied');
  const treeUrl = 'https://github.com/git/git/tree/master';
  history.pushState(null, '', treeUrl);
  // Before React renders: the same listing node, so stale.
  expect(controller.apply(new URL(treeUrl))).toBe('stale');
  // React renders /tree/master: a new container with the same rows.
  const old = query('listing', doc)?.element;
  old?.replaceWith(old.cloneNode(true));
  expect(controller.apply(new URL(treeUrl))).toBe('applied');
});
