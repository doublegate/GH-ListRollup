/**
 * The Level 2 data model (docs/data-fetching.md §1). The tree controller depends only on
 * `FolderSource`; `fetcher.ts` provides the same-origin tree JSON implementation.
 */

export type EntryKind = 'dir' | 'file' | 'submodule' | 'symlink' | 'unknown';

export interface TreeEntry {
  /** Display name; `a/b/c` for a simplified single-child chain. */
  name: string;
  /** Repository-relative path (the deepest folder for a chain). */
  path: string;
  kind: EntryKind;
  /** A single-child folder chain (`hasSimplifiedPath`). */
  simplified: boolean;
}

export interface FolderListing {
  /** GitHub's order: folders first, then files. */
  entries: TreeEntry[];
  /** May exceed `entries.length`: GitHub returns at most 1,000 items, with no paging. */
  totalCount: number;
  refName: string;
  commitOid: string | null;
  source: 'tree-json' | 'rest-contents';
}

export interface FolderKey {
  owner: string;
  repo: string;
  ref: string;
  /** Repository-relative folder path; `''` for the root. */
  path: string;
}

export interface FolderSource {
  list(key: FolderKey, signal?: AbortSignal): Promise<FolderListing>;
}
