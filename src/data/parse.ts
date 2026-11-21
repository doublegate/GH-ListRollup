/**
 * The tree JSON parser (T-GNR-202, docs/data-fetching.md §2).
 *
 * GitHub's tree JSON is an undocumented internal, so nothing is assumed beyond what the fixtures
 * show: the route object is found as the first `payload.*.tree.items` array (its key has differed
 * between page types), each item is validated, and malformed items are dropped and counted instead of
 * failing the folder. Only a document with no items array at all is a `SchemaError`.
 */
import { SchemaError } from './errors';
import type { EntryKind, FolderListing, TreeEntry } from './types';

export interface ParseResult {
  listing: FolderListing;
  /** Items dropped for a missing or mistyped field, reported under `debug.logging`. */
  malformed: number;
}

const KINDS: Readonly<Record<string, EntryKind>> = {
  directory: 'dir',
  file: 'file',
  submodule: 'submodule',
  symlink_file: 'symlink',
  symlink_directory: 'symlink',
};

const OID = /^[0-9a-f]{40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The first route object under `payload` whose `tree.items` is an array. */
function findRoute(json: unknown): { route: Record<string, unknown>; items: unknown[] } {
  const payload = isRecord(json) ? json.payload : undefined;
  if (!isRecord(payload)) throw new SchemaError('no payload object');
  for (const route of Object.values(payload)) {
    if (!isRecord(route) || !isRecord(route.tree)) continue;
    const items = route.tree.items;
    if (Array.isArray(items)) return { route, items };
  }
  throw new SchemaError('no payload.*.tree.items array');
}

function toEntry(item: unknown): TreeEntry | null {
  if (!isRecord(item)) return null;
  const { name, path, contentType } = item;
  if (typeof name !== 'string' || name === '') return null;
  if (typeof path !== 'string' || path === '') return null;
  if (typeof contentType !== 'string') return null;
  return {
    name,
    path,
    kind: KINDS[contentType] ?? 'unknown',
    simplified: item.hasSimplifiedPath === true,
  };
}

/**
 * Parses a tree JSON response. `requestedRef` names the listing when the response has no
 * `refInfo.name`. Throws `SchemaError` when no items array is found or no ref name is available.
 */
export function parseTreeJson(json: unknown, requestedRef?: string): ParseResult {
  const { route, items } = findRoute(json);
  const entries: TreeEntry[] = [];
  let malformed = 0;
  for (const item of items) {
    const entry = toEntry(item);
    if (entry) entries.push(entry);
    else malformed++;
  }

  const refInfo = isRecord(route.refInfo) ? route.refInfo : {};
  const refName =
    typeof refInfo.name === 'string' && refInfo.name !== '' ? refInfo.name : requestedRef;
  if (refName === undefined || refName === '') throw new SchemaError('no ref name');
  const oid = refInfo.currentOid;
  const tree = route.tree as Record<string, unknown>;
  const total = tree.totalCount;

  return {
    listing: {
      entries,
      totalCount:
        typeof total === 'number' && Number.isInteger(total) && total >= entries.length
          ? total
          : entries.length,
      refName,
      commitOid: typeof oid === 'string' && OID.test(oid) ? oid : null,
      source: 'tree-json',
    },
    malformed,
  };
}
