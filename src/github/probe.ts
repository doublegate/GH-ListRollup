/**
 * Breakage probe (T-GNR-102, docs/dom-integration.md section 6).
 *
 * Reports which rank of each page-level purpose matched, so a GitHub deploy that breaks a primary
 * selector shows up as `fallbackN` or `none` before it breaks the feature. The result holds plain
 * strings only, so it serializes as JSON for the weekly live probe (T-GNR-403).
 */
import { findHeaderLine } from './header';
import { classifyRows } from './rows';
import { type Rank, query, queryAll } from './selectors';

export interface ProbeReport {
  codeView: Rank;
  listing: Rank;
  rows: Rank;
  nameLink: Rank;
  headerLine: Rank;
  breadcrumbs: Rank;
}

/**
 * Probes `doc`. Scoped purposes are probed inside their container: rows inside the listing, the
 * name link inside the first entry row (the parent `..` row excluded). The header line uses the
 * same lookup as the controller (`findHeaderLine`), so the probe reports what the feature sees.
 */
export function probe(doc: Document): ProbeReport {
  const listing = query('listing', doc);
  const rows = listing ? queryAll('rows', listing.element) : null;
  // The owner and repo only affect the folder fallback's href check, which the probe does not use.
  const firstRow = listing ? classifyRows(listing.element, '', '')[0]?.row : undefined;
  return {
    codeView: query('codeView', doc)?.rank ?? 'none',
    listing: listing?.rank ?? 'none',
    rows: rows?.rank ?? 'none',
    nameLink: (firstRow && query('nameLink', firstRow)?.rank) ?? 'none',
    headerLine: findHeaderLine(doc)?.rank ?? 'none',
    breadcrumbs: query('breadcrumbs', doc)?.rank ?? 'none',
  };
}

/** One log line per page: `codeView=primary listing=primary rows=fallback1 ...`. */
export function formatProbe(report: ProbeReport): string {
  return Object.entries(report)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
}
