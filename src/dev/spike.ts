/**
 * T-GNR-201 spike, development builds only (`pnpm dev`, `pnpm dev:firefox`): does the same-origin
 * tree JSON work from the content script for the signed-in user, on private repositories, in both
 * browsers? The content script imports this only under `import.meta.env.DEV`, so production builds
 * do not contain it.
 *
 * It logs status codes, counts and booleans only. Never a repository, folder or file name, a path or
 * a body: the console output is meant to be pasted into an issue, including for private
 * repositories (to-dos/phase-2-inline-tree/sprint-1-data-layer.md, T-GNR-201).
 */
import { parseTreeJson } from '@/data/parse';
import type { FolderKey } from '@/data/types';
import { buildTreeUrl } from '@/data/url';

type FetchLike = (input: URL, init: RequestInit) => Promise<Response>;

const HEADERS = {
  Accept: 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'GitHub-Verified-Fetch': 'true',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Visibility flags from the route's `repo` object, when GitHub includes one. Booleans only. */
function repoFlags(json: unknown): string {
  const payload = isRecord(json) ? json.payload : undefined;
  if (!isRecord(payload)) return 'repo=?';
  for (const route of Object.values(payload)) {
    if (isRecord(route) && isRecord(route.repo)) {
      const r = route.repo;
      return `private=${String(r.private === true)} orgOwned=${String(r.isOrgOwned === true)}`;
    }
  }
  return 'repo=?';
}

/** One line per attempt: how the request went, never what it returned. */
export function summarize(
  via: string,
  response: { status: number; redirected: boolean; url: string } | null,
  json: unknown,
  error?: unknown,
): string {
  if (!response) {
    const name = error instanceof Error ? error.name : typeof error;
    return `spike T-GNR-201 via=${via} request-failed=${name}`;
  }
  const host = (() => {
    try {
      return new URL(response.url).host;
    } catch {
      return '?';
    }
  })();
  const parts = [
    `spike T-GNR-201 via=${via}`,
    `status=${String(response.status)}`,
    `redirected=${String(response.redirected)}`,
    `finalHost=${host}`,
  ];
  if (json === undefined) {
    parts.push('json=no');
  } else {
    try {
      const { listing, malformed } = parseTreeJson(json, 'requested-ref');
      parts.push(
        'json=yes',
        `items=${String(listing.entries.length)}`,
        `total=${String(listing.totalCount)}`,
        `malformed=${String(malformed)}`,
        `oid=${listing.commitOid ? 'yes' : 'no'}`,
        repoFlags(json),
      );
    } catch (e) {
      parts.push(`json=yes schema=${e instanceof Error ? e.name : 'error'}`);
    }
  }
  return parts.join(' ');
}

async function attempt(via: string, fetchFn: FetchLike, url: URL): Promise<string> {
  let response: Response;
  try {
    response = await fetchFn(url, { credentials: 'same-origin', headers: { ...HEADERS } });
  } catch (error) {
    return summarize(via, null, undefined, error);
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    json = undefined;
  }
  return summarize(via, response, json);
}

/**
 * Runs the spike once for `key` and reports each line through `log`. Tries the global `fetch` and,
 * in Firefox, `content.fetch` (the page-principal fetch available to content scripts).
 */
export async function runTreeJsonSpike(key: FolderKey, log: (line: string) => void): Promise<void> {
  let url: URL;
  try {
    url = buildTreeUrl(key);
  } catch (error) {
    log(`spike T-GNR-201 invalid-key=${error instanceof Error ? error.name : 'error'}`);
    return;
  }
  log(await attempt('fetch', (u, init) => fetch(u, init), url));
  const pageFetch = (globalThis as { content?: { fetch?: typeof fetch } }).content?.fetch;
  if (typeof pageFetch === 'function') {
    log(await attempt('content.fetch', (u, init) => pageFetch(u, init), url));
  }
}
