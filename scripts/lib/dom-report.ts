/**
 * Selector match counts per HTML fixture (T-GNR-012). Used by scripts/fixture-dom-report.ts and by
 * tests/unit/fixtures.test.ts. T-GNR-101 moves the selector table into src/github/selectors.ts;
 * import it from there then.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Window } from 'happy-dom';

export const HTML_DIR = join(import.meta.dirname, '..', '..', 'tests', 'fixtures', 'html');

export const SELECTORS: Record<string, string> = {
  'gate: react-app code-view': 'react-app[app-name="code-view"]',
  'gate fallback: route-controller=files': 'meta[name="route-controller"][content="files"]',
  'listing: directory-content': '[data-testid="directory-content"]',
  'listing fallback: table folders-and-files': 'table[aria-labelledby="folders-and-files"]',
  'rows: tr.react-directory-row':
    '[data-testid="directory-content"] tbody > tr.react-directory-row',
  'rows fallback: tr[id^=folder-row-]': 'tr[id^="folder-row-"]',
  'parent row: up-tree': 'a[data-testid="up-tree"]',
  'links: ", (Directory)"': 'a[aria-label$=", (Directory)"]',
  'links: ", (File)"': 'a[aria-label$=", (File)"]',
  'icon: file-directory-fill': 'svg.octicon-file-directory-fill',
  'name cell: small-screen': 'td.react-directory-row-name-cell-small-screen',
  'name cell: large-screen': 'td.react-directory-row-name-cell-large-screen',
  'name link: filename-cell a': '.react-directory-filename-cell a',
  'name link fallback: truncate a': '.react-directory-truncate a',
  'header line: latest-commit-details': '[data-testid="latest-commit-details"]',
  'footer: view-all-files-row': 'tr[data-testid="view-all-files-row"]',
  'branch picker (root)': '#ref-picker-repos-header-ref-selector',
  'branch picker (folder)': '#ref-picker-repos-header-ref-selector-wide',
  breadcrumbs: '[data-testid="breadcrumbs"]',
  'file-tree sidebar': '#repos-file-tree-sidebar',
};

export async function report(
  names: string[],
): Promise<Record<string, Record<string, string | number>>> {
  const result: Record<string, Record<string, string | number>> = {};
  for (const name of names) {
    const window = new Window({ url: 'https://github.com/' });
    try {
      const doc = new window.DOMParser().parseFromString(
        readFileSync(join(HTML_DIR, `${name}.html`), 'utf8'),
        'text/html',
      );
      const row: Record<string, string | number> = {};
      for (const [label, selector] of Object.entries(SELECTORS))
        row[label] = doc.querySelectorAll(selector).length;
      const suffixes = new Set(
        [...doc.querySelectorAll('.react-directory-filename-cell a[aria-label]')].map((a) =>
          (a.getAttribute('aria-label') ?? '').replace(/^.*, /, ''),
        ),
      );
      row['aria-label suffixes'] = [...suffixes].sort().join(' ');
      result[name] = row;
    } finally {
      await window.happyDOM.close();
    }
  }
  return result;
}
