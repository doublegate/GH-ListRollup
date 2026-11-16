/**
 * Fixture loader for Vitest + happy-dom (T-GNR-014, docs/testing-strategy.md section 3).
 *
 * `loadHtmlFixture('root')` replaces the test `document` with `tests/fixtures/html/root.html`
 * and points `location` at the page's source URL, so code under test sees the same URL and DOM
 * it would on github.com. Call `resetDocument()` after each test (or use `useHtmlFixture`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach } from 'vitest';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

interface ManifestEntry {
  name: string;
  kind: 'html' | 'json';
  url: string;
}

const manifest = (
  JSON.parse(readFileSync(join(FIXTURES, 'manifest.json'), 'utf8')) as { fixtures: ManifestEntry[] }
).fixtures;

/** The page URL a fixture was captured from, per `tests/fixtures/manifest.json`. */
export function fixtureUrl(name: string, kind: 'html' | 'json' = 'html'): string {
  const entry = manifest.find((f) => f.name === name && f.kind === kind);
  if (!entry) throw new Error(`No ${kind} fixture named "${name}" in tests/fixtures/manifest.json`);
  return entry.url;
}

interface HappyDomWindow {
  happyDOM?: { setURL(url: string): void };
}

function setLocation(url: string): void {
  const happy = (window as unknown as HappyDomWindow).happyDOM;
  if (!happy) throw new Error('loadHtmlFixture requires the happy-dom test environment');
  happy.setURL(url);
}

function replaceDocumentElement(html: string): void {
  // DOMParser does not execute scripts; the fixture's only script is inert JSON anyway.
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const next = document.importNode(parsed.documentElement, true);
  // happy-dom's replaceChild inserts before removing, which a Document rejects ("Only one element
  // on document allowed"), so remove the old root first.
  document.documentElement.remove();
  document.appendChild(next);
}

/**
 * Loads an HTML fixture into the global `document`. `url` defaults to the fixture's source URL,
 * so for example `location.pathname` is `/git/git/tree/master/contrib` for `folder`.
 */
export function loadHtmlFixture(name: string, options: { url?: string } = {}): Document {
  const html = readFileSync(join(FIXTURES, 'html', `${name}.html`), 'utf8');
  setLocation(options.url ?? fixtureUrl(name, 'html'));
  replaceDocumentElement(html);
  return document;
}

/** Reads a JSON fixture (a recorded tree JSON response body). */
export function loadJsonFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, 'json', `${name}.json`), 'utf8')) as T;
}

/** Restores an empty document at `about:blank`. */
export function resetDocument(): void {
  replaceDocumentElement('<!DOCTYPE html><html><head></head><body></body></html>');
  setLocation('about:blank');
}

/** Registers beforeEach/afterEach hooks that load `name` fresh for every test in the suite. */
export function useHtmlFixture(name: string, options: { url?: string } = {}): void {
  beforeEach(() => {
    loadHtmlFixture(name, options);
  });
  afterEach(() => {
    resetDocument();
  });
}
