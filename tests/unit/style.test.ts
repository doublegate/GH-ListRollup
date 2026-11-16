/**
 * T-GNR-107: every rule in the content stylesheet is scoped to the extension
 * (docs/dom-integration.md section 5), so it can never restyle GitHub on its own.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(
  join(import.meta.dirname, '..', '..', 'src', 'entrypoints', 'content', 'style.css'),
  'utf8',
);

/** Every selector of every style rule, with comments and at-rule preludes removed. */
function selectors(css: string): string[] {
  const out: string[] = [];
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of noComments.matchAll(/([^{}]+)\{/g)) {
    const prelude = (match[1] ?? '').trim();
    if (prelude === '' || prelude.startsWith('@')) continue;
    out.push(...prelude.split(',').map((s) => s.trim()));
  }
  return out;
}

describe('content stylesheet (T-GNR-107)', () => {
  const all = selectors(CSS);

  it('has rules to check', () => {
    expect(all.length).toBeGreaterThan(5);
  });

  it.each(all)('"%s" is scoped to html[data-gnr-pending], .gnr-* or [data-gnr', (selector) => {
    expect(selector).toMatch(/^(html\[data-gnr-pending\]|\.gnr-|\[data-gnr)/);
  });

  it('uses Primer variables for every color', () => {
    const colorDecls = [...CSS.matchAll(/(?:^|[\s;{])(color|background|outline)\s*:\s*([^;]+);/g)];
    for (const [, prop, value] of colorDecls) {
      if (/^(transparent|none|0)$/.test((value ?? '').trim())) continue;
      if (prop === 'outline') expect(value).toMatch(/var\(--focus-outlineColor/);
      else expect(value, `${prop}: ${value}`).toMatch(/^var\(--/);
    }
  });

  it('disables the chevron transition for reduced motion', () => {
    expect(CSS).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.gnr-chevron\s*\{\s*transition:\s*none/,
    );
  });
});
