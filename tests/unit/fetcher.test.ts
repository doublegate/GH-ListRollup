/**
 * The tree JSON fetcher (T-GNR-204): docs/data-fetching.md §2 (headers), §3 (cache, de-duplication,
 * concurrency, abort, timeout) and §5 (errors), with a stubbed fetch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, InvalidKeyError, NetworkError, SchemaError, TimeoutError } from '@/data/errors';
import { TreeJsonSource } from '@/data/fetcher';
import type { FolderKey } from '@/data/types';

afterEach(() => {
  vi.useRealTimers();
});

const OID_A = 'a'.repeat(40);
const OID_B = 'b'.repeat(40);

const body = (items: string[], oid = OID_A, ref = 'main') => ({
  payload: {
    codeViewTreeRoute: {
      refInfo: { name: ref, currentOid: oid },
      tree: {
        items: items.map((n) => ({ name: n, path: n, contentType: 'file' })),
        totalCount: items.length,
      },
    },
  },
});

const ok = (json: unknown) => new Response(JSON.stringify(json), { status: 200 });

const key = (path = '', ref = 'main'): FolderKey => ({ owner: 'git', repo: 'git', ref, path });

/** A fetch stub whose responses the test releases one by one. */
function controlledFetch() {
  const calls: { url: string; init: RequestInit; resolve: (r: Response) => void }[] = [];
  const fetch = vi.fn(
    (input: URL, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        calls.push({ url: input.href, init: init ?? {}, resolve });
        init?.signal?.addEventListener('abort', () => {
          // Like a real fetch: an aborted request rejects (the source decides what it means).
          reject(new DOMException('aborted', 'AbortError'));
        });
      }),
  );
  return { fetch, calls };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('TreeJsonSource requests', () => {
  it('sends exactly the documented headers, same-origin credentials, to the built URL', async () => {
    const fetch = vi.fn(() => Promise.resolve(ok(body(['a']))));
    const source = new TreeJsonSource({ fetch });
    await source.list(key('contrib'));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [URL | string, RequestInit];
    expect(String(url)).toBe('https://github.com/git/git/tree/main/contrib');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers).toEqual({
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'GitHub-Verified-Fetch': 'true',
    });
  });

  it('refuses an invalid key with InvalidKeyError and never calls fetch', async () => {
    const fetch = vi.fn();
    const source = new TreeJsonSource({ fetch });
    await expect(source.list(key('a/../../settings'))).rejects.toBeInstanceOf(InvalidKeyError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns the parsed listing', async () => {
    const source = new TreeJsonSource({ fetch: () => Promise.resolve(ok(body(['x', 'y']))) });
    const listing = await source.list(key());
    expect(listing.entries.map((e) => e.name)).toEqual(['x', 'y']);
    expect(listing.commitOid).toBe(OID_A);
  });
});

describe('TreeJsonSource errors', () => {
  it.each([
    ['a rejected fetch', () => Promise.reject(new TypeError('Failed to fetch')), NetworkError],
    ['a 404', () => Promise.resolve(new Response('{}', { status: 404 })), HttpError],
    ['a 500', () => Promise.resolve(new Response('x', { status: 500 })), HttpError],
    [
      'a body that is not JSON',
      () => Promise.resolve(new Response('<html>', { status: 200 })),
      SchemaError,
    ],
    ['JSON of the wrong shape', () => Promise.resolve(ok({ payload: {} })), SchemaError],
  ])('maps %s', async (_label, impl, type) => {
    const source = new TreeJsonSource({ fetch: impl });
    await expect(source.list(key())).rejects.toBeInstanceOf(type);
  });

  it('keeps the HTTP status and never puts the URL in the message', async () => {
    const source = new TreeJsonSource({
      fetch: () => Promise.resolve(new Response('{}', { status: 404 })),
    });
    const error = await source.list(key('private-folder')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(404);
    expect((error as Error).message).not.toContain('private-folder');
  });

  it('times out after 10 seconds with TimeoutError', async () => {
    vi.useFakeTimers();
    const { fetch } = controlledFetch();
    const source = new TreeJsonSource({ fetch });
    const result = source.list(key()).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toBeInstanceOf(TimeoutError);
  });

  it('a failed request is not cached', async () => {
    let n = 0;
    const source = new TreeJsonSource({
      fetch: () =>
        n++ === 0 ? Promise.reject(new TypeError('offline')) : Promise.resolve(ok(body(['a']))),
    });
    await expect(source.list(key())).rejects.toBeInstanceOf(NetworkError);
    await expect(source.list(key())).resolves.toMatchObject({ refName: 'main' });
  });
});

describe('TreeJsonSource cache', () => {
  it('answers a repeat from the cache', async () => {
    const fetch = vi.fn(() => Promise.resolve(ok(body(['a']))));
    const source = new TreeJsonSource({ fetch });
    await source.list(key('x'));
    await source.list(key('x'));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('treats owner and repo case-insensitively', async () => {
    const fetch = vi.fn(() => Promise.resolve(ok(body(['a']))));
    const source = new TreeJsonSource({ fetch });
    await source.list(key('x'));
    await source.list({ ...key('x'), owner: 'Git', repo: 'GIT' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keys by commit OID once known, so a moved branch is fetched again', async () => {
    let oid = OID_A;
    const fetch = vi.fn(() => Promise.resolve(ok(body(['a'], oid))));
    const source = new TreeJsonSource({ fetch });
    await source.list(key('x'));
    oid = OID_B; // the branch moved; the next folder reports the new head
    await source.list(key('y'));
    await source.list(key('x')); // cached under OID_A: the ref now points at OID_B
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('evicts the least recently used entry beyond the capacity', async () => {
    const fetch = vi.fn(() => Promise.resolve(ok(body(['a']))));
    const source = new TreeJsonSource({ fetch, cacheSize: 2 });
    await source.list(key('a'));
    await source.list(key('b'));
    await source.list(key('a')); // a is now the most recent
    await source.list(key('c')); // evicts b
    await source.list(key('a'));
    expect(fetch).toHaveBeenCalledTimes(3);
    await source.list(key('b'));
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('clear() empties the cache and aborts what is in flight', async () => {
    const { fetch, calls } = controlledFetch();
    const source = new TreeJsonSource({ fetch });
    const pending = source.list(key('x')).catch((e: unknown) => e);
    await flush();
    source.clear();
    expect(((await pending) as Error).name).toBe('AbortError');
    const again = source.list(key('x'));
    await flush();
    calls[1]?.resolve(ok(body(['a'])));
    await expect(again).resolves.toMatchObject({ refName: 'main' });
    expect(calls).toHaveLength(2);
  });
});

describe('TreeJsonSource concurrency and abort', () => {
  it('de-duplicates a request already in flight', async () => {
    const { fetch, calls } = controlledFetch();
    const source = new TreeJsonSource({ fetch });
    const a = source.list(key('x'));
    const b = source.list(key('x'));
    await flush();
    expect(calls).toHaveLength(1);
    calls[0]?.resolve(ok(body(['a'])));
    expect(await a).toBe(await b);
  });

  it('runs at most 4 requests at once, the rest in FIFO order', async () => {
    const { fetch, calls } = controlledFetch();
    const source = new TreeJsonSource({ fetch });
    const all = ['a', 'b', 'c', 'd', 'e', 'f'].map((p) => source.list(key(p)));
    await flush();
    expect(calls.map((c) => c.url.split('/').pop())).toEqual(['a', 'b', 'c', 'd']);
    calls[1]?.resolve(ok(body(['b'])));
    await flush();
    expect(calls.map((c) => c.url.split('/').pop())).toEqual(['a', 'b', 'c', 'd', 'e']);
    for (const c of calls) c.resolve(ok(body(['z'])));
    await flush();
    calls[5]?.resolve(ok(body(['z'])));
    await Promise.all(all);
    expect(calls).toHaveLength(6);
  });

  it('a caller’s abort rejects that caller with AbortError, and a queued request never starts', async () => {
    const { fetch, calls } = controlledFetch();
    const source = new TreeJsonSource({ fetch, concurrency: 1 });
    const first = source.list(key('a'));
    const controller = new AbortController();
    const second = source.list(key('b'), controller.signal).catch((e: unknown) => e);
    await flush();
    controller.abort();
    expect(((await second) as Error).name).toBe('AbortError');
    calls[0]?.resolve(ok(body(['a'])));
    await first;
    await flush();
    expect(calls).toHaveLength(1); // b was dropped from the queue
  });

  it('an already-aborted signal rejects without a request', async () => {
    const fetch = vi.fn();
    const source = new TreeJsonSource({ fetch });
    const controller = new AbortController();
    controller.abort();
    await expect(source.list(key(), controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('the lifetime signal (ctx.signal) aborts everything', async () => {
    const { fetch } = controlledFetch();
    const life = new AbortController();
    const source = new TreeJsonSource({ fetch, signal: life.signal });
    const pending = source.list(key('x')).catch((e: unknown) => e);
    await flush();
    life.abort();
    expect(((await pending) as Error).name).toBe('AbortError');
    await expect(source.list(key('y'))).rejects.toMatchObject({ name: 'AbortError' });
  });
});
