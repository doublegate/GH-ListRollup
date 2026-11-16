/**
 * Selector report across HTML fixtures (T-GNR-012).
 *
 * Prints how many elements each selector from docs/dom-integration.md section 2 matches in every
 * HTML fixture, and flags rows where a signed-out fixture and its signed-in twin disagree. Run it
 * after re-capturing fixtures to see at a glance whether GitHub's markup moved.
 *
 *   pnpm fixtures:report
 */
import { readdirSync } from 'node:fs';
import { HTML_DIR, report } from './lib/dom-report.ts';

const names = readdirSync(HTML_DIR)
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.replace(/\.html$/, ''))
  .sort();
const table = await report(names);
const labels = Object.keys(table[names[0] ?? ''] ?? {});
const width = Math.max(...labels.map((l) => l.length)) + 2;
console.info(`${'selector'.padEnd(width)}${names.map((n) => n.padEnd(18)).join('')}`);
for (const label of labels) {
  const values = names.map((n) => table[n]?.[label] ?? '');
  const differs = names.some((n) => {
    const twin = n.endsWith('-logged-in') ? n.slice(0, -'-logged-in'.length) : null;
    return twin !== null && names.includes(twin) && table[n]?.[label] !== table[twin]?.[label];
  });
  console.info(
    `${label.padEnd(width)}${values.map((v) => String(v).padEnd(18)).join('')}${differs ? '<-- differs' : ''}`,
  );
}
