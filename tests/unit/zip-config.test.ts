/**
 * The AMO sources zip (docs/release.md §3 and §6): WXT does not read `.gitignore` when it builds
 * `sources.zip` (only dotfiles are excluded by default), so every other gitignored pattern must be
 * in `zip.excludeSources`, or a local file (a log, a key, `CLAUDE.local.md`) in a dirty working
 * tree would be published to Mozilla's reviewers (agy, #25).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../wxt.config';

/** A `.gitignore` pattern as the glob WXT's `excludeSources` expects. */
function toGlob(pattern: string): string {
  let p = pattern.replace(/^\//, '');
  if (p.endsWith('/')) p = `${p}**`;
  else if (!p.includes('/')) p = `**/${p}`;
  return p;
}

describe('zip.excludeSources', () => {
  const ignored = readFileSync('.gitignore', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#') && !l.startsWith('!'))
    // Dotfiles are already excluded by WXT, and node_modules is never zipped.
    .filter((l) => !l.replace(/^\//, '').startsWith('.') && l !== 'node_modules/');
  const excluded = new Set(config.zip?.excludeSources ?? []);

  it.each(ignored.map((p) => [p, toGlob(p)]))('excludes the gitignored %s (%s)', (_p, glob) => {
    expect(excluded.has(glob)).toBe(true);
  });
});
