/**
 * The same-origin tree JSON source (T-GNR-204, docs/data-fetching.md §2, §3, §5).
 *
 * - **Cache:** per tab, in memory, LRU (200 entries), keyed `owner/repo@commitOid:path`. Until a
 *   response has supplied the ref's commit OID, the ref name stands in. Nothing is persisted.
 * - **De-duplication:** a second `list()` for a key in flight shares its request.
 * - **Concurrency:** at most 4 requests in flight; the rest wait in FIFO order.
 * - **Abort:** `clear()` (navigation to another repository or ref) and the lifetime signal
 *   (`ctx.signal`) abort every request. A caller's own signal rejects only that caller; a request
 *   still queued for it alone never starts.
 * - **Timeout:** 10 seconds per request, as `TimeoutError`.
 */
import { HttpError, NetworkError, SchemaError, TimeoutError } from './errors';
import { parseTreeJson } from './parse';
import type { FolderKey, FolderListing, FolderSource } from './types';
import { buildTreeUrl } from './url';

export interface TreeJsonSourceOptions {
  /** The fetch to use; in a content script, the one that carries the page's session. */
  fetch?: (input: URL, init: RequestInit) => Promise<Response>;
  /** Aborts everything when it fires: pass `ctx.signal`. */
  signal?: AbortSignal;
  cacheSize?: number;
  concurrency?: number;
  timeoutMs?: number;
}

/** The headers GitHub's own code view sends for the tree JSON (docs/data-fetching.md §2). */
const HEADERS: Readonly<Record<string, string>> = {
  Accept: 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'GitHub-Verified-Fetch': 'true',
};

function abortError(): DOMException {
  return new DOMException('The request was aborted.', 'AbortError');
}

interface Waiter {
  start: () => void;
  cancelled: boolean;
}

export class TreeJsonSource implements FolderSource {
  private readonly fetch: (input: URL, init: RequestInit) => Promise<Response>;
  private readonly cacheSize: number;
  private readonly concurrency: number;
  private readonly timeoutMs: number;
  private readonly lifetime: AbortSignal | undefined;
  /** Aborted and replaced by `clear()`. */
  private generation = new AbortController();
  private readonly cache = new Map<string, FolderListing>();
  /** `owner/repo@ref` -> the commit OID that ref last resolved to. */
  private readonly oids = new Map<string, string>();
  private readonly inFlight = new Map<string, Promise<FolderListing>>();
  private active = 0;
  private readonly queue: Waiter[] = [];

  constructor(options: TreeJsonSourceOptions = {}) {
    this.fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.cacheSize = options.cacheSize ?? 200;
    this.concurrency = options.concurrency ?? 4;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.lifetime = options.signal;
    this.lifetime?.addEventListener('abort', () => {
      this.clear();
    });
  }

  list(key: FolderKey, signal?: AbortSignal): Promise<FolderListing> {
    let url: URL;
    try {
      url = buildTreeUrl(key);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    if (this.lifetime?.aborted || signal?.aborted) return Promise.reject(abortError());

    const repo = `${key.owner.toLowerCase()}/${key.repo.toLowerCase()}`;
    const repoRef = `${repo}@${key.ref}`;
    const cacheKey = `${repo}@${this.oids.get(repoRef) ?? key.ref}:${key.path}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cache.delete(cacheKey); // most recently used last
      this.cache.set(cacheKey, cached);
      return Promise.resolve(cached);
    }

    let shared = this.inFlight.get(cacheKey);
    if (!shared) {
      shared = this.request(url, key.ref, this.generation.signal, signal)
        .then((listing) => {
          // Stored once: under the commit OID when the response names one (later lookups for this
          // ref resolve to it), otherwise under the ref name. Two copies halved the capacity.
          if (listing.commitOid) {
            this.oids.set(repoRef, listing.commitOid);
            this.remember(`${repo}@${listing.commitOid}:${key.path}`, listing);
          } else {
            this.remember(cacheKey, listing);
          }
          return listing;
        })
        .finally(() => {
          this.inFlight.delete(cacheKey);
        });
      this.inFlight.set(cacheKey, shared);
    }
    return signal ? raceAbort(shared, signal) : shared;
  }

  /** Empties the cache and aborts everything in flight or queued (navigation, teardown). */
  clear(): void {
    this.generation.abort(abortError());
    this.generation = new AbortController();
    this.cache.clear();
    this.oids.clear();
    this.inFlight.clear();
  }

  private remember(cacheKey: string, listing: FolderListing): void {
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, listing);
    while (this.cache.size > this.cacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  private async request(
    url: URL,
    ref: string,
    generation: AbortSignal,
    caller: AbortSignal | undefined,
  ): Promise<FolderListing> {
    await this.acquire(generation, caller);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException('Timed out.', 'TimeoutError'));
    }, this.timeoutMs);
    const onAbort = () => {
      controller.abort(abortError());
    };
    generation.addEventListener('abort', onAbort);
    try {
      let response: Response;
      try {
        response = await this.fetch(url, {
          method: 'GET',
          credentials: 'same-origin',
          headers: { ...HEADERS },
          signal: controller.signal,
        });
      } catch {
        if (timedOut) throw new TimeoutError(this.timeoutMs);
        if (generation.aborted) throw abortError();
        throw new NetworkError();
      }
      if (!response.ok) throw new HttpError(response.status);
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        if (timedOut) throw new TimeoutError(this.timeoutMs);
        if (generation.aborted) throw abortError();
        throw new SchemaError('the response is not JSON');
      }
      return parseTreeJson(json, ref).listing;
    } finally {
      clearTimeout(timer);
      generation.removeEventListener('abort', onAbort);
      this.release();
    }
  }

  /** Waits for a request slot. Rejects, leaving the queue, if aborted while waiting. */
  private acquire(generation: AbortSignal, caller: AbortSignal | undefined): Promise<void> {
    if (this.active < this.concurrency) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        cancelled: false,
        start: () => {
          cleanup();
          resolve();
        },
      };
      const cancel = () => {
        waiter.cancelled = true;
        cleanup();
        reject(abortError());
      };
      const cleanup = () => {
        generation.removeEventListener('abort', cancel);
        caller?.removeEventListener('abort', cancel);
      };
      generation.addEventListener('abort', cancel);
      // A queued request belongs to its first caller only until it starts: if that caller gives up
      // before then, the request is dropped (a later caller for the same key starts a new one).
      caller?.addEventListener('abort', cancel);
      this.queue.push(waiter);
    });
  }

  private release(): void {
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next && !next.cancelled) {
        next.start();
        return;
      }
    }
    this.active--;
  }
}

/** Resolves or rejects with `promise`, or rejects with AbortError when `signal` fires first. */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
