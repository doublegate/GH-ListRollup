/**
 * Fixture capture tool (T-GNR-011, T-GNR-013; docs/testing-strategy.md section 3).
 *
 * Fetches public github.com pages and tree JSON logged out (no cookies, generic User-Agent),
 * sanitizes them (scripts/lib/sanitize.ts) and writes:
 *
 *   tests/fixtures/html/<name>.html   and   tests/fixtures/html/<name>.md
 *   tests/fixtures/json/<name>.json   and   tests/fixtures/json/<name>.md
 *
 * The .md sidecar records provenance and is rewritten only when the fixture content changes, so
 * re-capturing an unchanged page leaves both files byte-identical.
 *
 * Usage (Node 26 runs TypeScript directly):
 *   pnpm fixtures:capture                    # every fixture in tests/fixtures/manifest.json
 *   pnpm fixtures:capture root nested        # selected names (both kinds when names collide)
 *   pnpm fixtures:capture --kind json        # one kind only
 *   pnpm fixtures:capture --url <github url> --name <name> [--json]   # ad hoc
 *   pnpm fixtures:capture --check            # fetch and compare, write nothing; exit 1 on drift
 *   pnpm fixtures:capture --reprocess        # re-sanitize committed signed-in fixtures in place
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  findEncodedIdentity,
  identityLeftovers,
  type Identity,
  sanitizeGitHubHtml,
  sanitizeTreeJson,
} from './lib/sanitize.ts';

type Kind = 'html' | 'json';

interface FixtureSpec {
  name: string;
  kind: Kind;
  url: string;
  purpose?: string;
  maxItems?: number;
  expectStatus?: number;
  /**
   * Captured from a signed-in browser, never fetched by this script (it sends no credentials).
   * Re-capture with `--from-file` (T-GNR-012). Bulk capture skips these entries.
   */
  loggedIn?: boolean;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'tests', 'fixtures');
const USER_AGENT = 'gh-listrollup-fixture-capture/0.1';
const NAME = /^[a-z0-9][a-z0-9-]*$/;

function fail(message: string): never {
  console.error(`capture-fixture: ${message}`);
  process.exit(2);
}

function validate(spec: FixtureSpec): FixtureSpec {
  if (!NAME.test(spec.name))
    fail(`invalid fixture name "${spec.name}" (lowercase, digits, hyphens)`);
  const url = new URL(spec.url);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com')
    fail(`only https://github.com URLs are allowed: ${spec.url}`);
  return spec;
}

async function loadManifest(): Promise<FixtureSpec[]> {
  const raw = JSON.parse(await readFile(join(FIXTURES, 'manifest.json'), 'utf8')) as {
    fixtures: FixtureSpec[];
  };
  return raw.fixtures.map(validate);
}

async function fetchFixture(spec: FixtureSpec): Promise<{ status: number; body: string }> {
  const res = await fetch(spec.url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: spec.kind === 'json' ? 'application/json' : 'text/html',
      ...(spec.kind === 'json' ? { 'X-Requested-With': 'XMLHttpRequest' } : {}),
    },
    redirect: 'error',
    credentials: 'omit',
  });
  const body = await res.text();
  const expected = spec.expectStatus ?? 200;
  if (res.status !== expected) fail(`${spec.url}: expected HTTP ${expected}, got ${res.status}`);
  if (
    spec.kind === 'json' &&
    !(res.headers.get('content-type') ?? '').includes('application/json')
  ) {
    fail(`${spec.url}: expected application/json, got ${res.headers.get('content-type')}`);
  }
  return { status: res.status, body };
}

/** Depth-first search for the first `refInfo` object with a string name and commit oid. */
function findRefInfo(value: unknown): { name: string; currentOid: string } | null {
  if (Array.isArray(value)) {
    for (const v of value) {
      const hit = findRefInfo(v);
      if (hit) return hit;
    }
  } else if (value !== null && typeof value === 'object') {
    const ref = (value as { refInfo?: { name?: unknown; currentOid?: unknown } }).refInfo;
    if (ref && typeof ref.name === 'string' && typeof ref.currentOid === 'string') {
      return { name: ref.name, currentOid: ref.currentOid };
    }
    for (const v of Object.values(value)) {
      const hit = findRefInfo(v);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Extracts ref name and commit oid for the provenance note, if present. Parses the JSON (the tree
 * response, or the HTML page's embedded code-view payload) rather than regex-matching it, so key
 * order inside `refInfo` does not matter (agy review, PR #3).
 */
function refInfoOf(kind: Kind, content: string): string {
  let json: string | undefined = content;
  if (kind === 'html') {
    json = /data-target="react-app\.embeddedData">(.*?)<\/script>/s.exec(content)?.[1];
  }
  let ref: { name: string; currentOid: string } | null;
  try {
    ref = json === undefined ? null : findRefInfo(JSON.parse(json));
  } catch {
    ref = null;
  }
  if (ref) return `ref \`${ref.name}\` at commit \`${ref.currentOid}\``;
  return kind === 'json' ? 'no refInfo in response' : 'ref not found in embedded data';
}

function sidecar(
  spec: FixtureSpec,
  file: string,
  content: string,
  status: number,
  captured: string,
): string {
  const sha = createHash('sha256').update(content).digest('hex');
  const lines = [
    `# Fixture: ${spec.kind}/${spec.name}`,
    '',
    `- **Source:** <${spec.url}>`,
    `- **Captured:** ${captured} (${
      spec.loggedIn
        ? 'signed in; saved from a browser, then sanitized by `scripts/capture-fixture.ts --from-file` with the user identity replaced by `fixture-user`, and reviewed by hand'
        : 'logged out, by `scripts/capture-fixture.ts`'
    })`,
    `- **HTTP status:** ${status}`,
    `- **Content:** ${refInfoOf(spec.kind, content)}`,
    `- **SHA-256 of \`${file}\`:** \`${sha}\``,
  ];
  if (spec.maxItems !== undefined)
    lines.push(
      `- **Trimmed:** tree items limited to ${spec.maxItems}; \`totalCount\` kept as captured.`,
    );
  if (spec.purpose) lines.push('', spec.purpose);
  lines.push(
    '',
    'Sanitized: scripts other than the code-view payload, links, styles, non-allowlisted meta tags,',
  );
  lines.push(
    'nonces, analytics/hydro attributes, HMACs, CSRF and other tokens, and avatars are removed or',
  );
  lines.push('redacted. Re-capture deliberately; see `tests/fixtures/README.md`.');
  return `${lines.join('\n')}\n`;
}

type Result = 'unchanged' | 'written' | 'drift' | 'skipped';

async function capture(spec: FixtureSpec, check: boolean): Promise<Result> {
  if (spec.loggedIn) return 'skipped';
  const { status, body } = await fetchFixture(spec);
  const content =
    spec.kind === 'html'
      ? await sanitizeGitHubHtml(body, { sourceUrl: spec.url, name: spec.name })
      : sanitizeTreeJson(body, spec.maxItems !== undefined ? { maxItems: spec.maxItems } : {});
  return store(spec, content, status, check);
}

/**
 * Sanitizes a page saved from a signed-in browser (T-GNR-012). The identity is replaced
 * everywhere; the result still needs the manual review described in tests/fixtures/README.md.
 */
async function captureFromFile(
  spec: FixtureSpec,
  file: string,
  identity: Identity,
  check: boolean,
): Promise<Result> {
  if (spec.kind !== 'html') fail('--from-file supports HTML fixtures only');
  const body = await readFile(file, 'utf8');
  const content = await sanitizeGitHubHtml(body, {
    sourceUrl: spec.url,
    name: spec.name,
    identity,
  });
  const leftovers = identityLeftovers(content, identity);
  if (leftovers.length > 0)
    fail(`identity still present after sanitizing: ${leftovers.length} value(s)`);
  const encoded = findEncodedIdentity(content, identity);
  if (encoded.length > 0)
    fail(`identity still present inside base64-encoded data: ${encoded.length} value(s)`);
  return store(spec, content, 200, check);
}

/** The `Captured:` date recorded in an existing sidecar, if any. */
async function capturedDateOf(sidecarPath: string): Promise<string | undefined> {
  const md = await readFile(sidecarPath, 'utf8').catch(() => '');
  return /- \*\*Captured:\*\* (\d{4}-\d{2}-\d{2})/.exec(md)?.[1];
}

/**
 * Writes a fixture and its sidecar. `keepCapturedDate` (used by --reprocess) keeps the sidecar's
 * original capture date: re-sanitizing a committed fixture is not a new capture (agy review, PR #3).
 */
async function store(
  spec: FixtureSpec,
  content: string,
  status: number,
  check: boolean,
  keepCapturedDate = false,
): Promise<Result> {
  const dir = join(FIXTURES, spec.kind);
  const file = `${spec.name}.${spec.kind}`;
  const path = join(dir, file);
  const previous = await readFile(path, 'utf8').catch(() => null);
  if (previous === content) return 'unchanged';
  if (check) return 'drift';

  const sidecarPath = join(dir, `${spec.name}.md`);
  const today = new Date().toISOString().slice(0, 10);
  const captured = (keepCapturedDate ? await capturedDateOf(sidecarPath) : undefined) ?? today;
  await mkdir(dir, { recursive: true });
  await writeFile(path, content);
  await writeFile(sidecarPath, sidecar(spec, file, content, status, captured));
  return 'written';
}

/** Filters specs to the named ones, failing on any name that matches nothing (agy review, PR #3). */
function selectByName(specs: FixtureSpec[], names: string[]): FixtureSpec[] {
  const unknown = names.filter((n) => !specs.some((s) => s.name === n));
  if (unknown.length > 0) fail(`no fixture named: ${unknown.join(', ')}`);
  return specs.filter((s) => names.includes(s.name));
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      url: { type: 'string' },
      name: { type: 'string' },
      json: { type: 'boolean', default: false },
      kind: { type: 'string' },
      check: { type: 'boolean', default: false },
      'from-file': { type: 'string' },
      login: { type: 'string' },
      'user-id': { type: 'string' },
      'node-id': { type: 'string' },
      email: { type: 'string' },
      reprocess: { type: 'boolean', default: false },
    },
  });

  // Validate --kind up front, and refuse combinations that would silently ignore it (agy review,
  // PR #3): an unknown kind used to filter everything out, and --kind was ignored with --url. Runs
  // before every mode branch, so --reprocess and --from-file cannot ignore it either (PR #7).
  if (values.kind !== undefined) {
    if (values.kind !== 'html' && values.kind !== 'json') fail('--kind must be html or json');
    if (values.url !== undefined) fail('--kind does not apply to --url; use --json for JSON');
    if (values.json) fail('--json and --kind are mutually exclusive');
    if (values.reprocess) fail('--kind does not apply to --reprocess (signed-in HTML only)');
    if (values['from-file'] !== undefined) fail('--kind does not apply to --from-file (HTML only)');
  }

  if (values.reprocess) {
    // Re-run the current sanitizer over committed signed-in fixtures, which cannot be re-fetched
    // (the raw browser captures are deleted after review). Sanitizing is idempotent, so an
    // unchanged sanitizer leaves the files byte-identical.
    let specs = (await loadManifest()).filter((s) => s.kind === 'html' && s.loggedIn);
    if (positionals.length > 0) specs = selectByName(specs, positionals);
    if (specs.length === 0) fail('no logged-in html fixtures matched');
    let drift = 0;
    for (const spec of specs) {
      const current = await readFile(join(FIXTURES, 'html', `${spec.name}.html`), 'utf8');
      const content = await sanitizeGitHubHtml(current, { sourceUrl: spec.url, name: spec.name });
      const result = await store(spec, content, 200, values.check, true);
      if (result === 'drift') drift++;
      console.info(
        `${result.padEnd(9)} ${relative(ROOT, join(FIXTURES, 'html', `${spec.name}.html`))}`,
      );
    }
    if (values.check && drift > 0) process.exit(1);
    return;
  }

  if (values['from-file'] !== undefined) {
    const name =
      values.name ?? fail('--from-file requires --name (a manifest entry with loggedIn: true)');
    // Every identifier is required and must be non-empty (agy reviews, PR #3): `??` alone let
    // `--login ""` through, which builds an empty-match regex, and an omitted identifier is
    // neither replaced nor checked for. `gh api user` gives login, id and node_id.
    const nonEmpty = (flag: string, v: string | undefined): string =>
      v !== undefined && v.trim() !== ''
        ? v.trim()
        : fail(`--from-file requires a non-empty --${flag}`);
    const login = nonEmpty('login', values.login);
    const nodeId = nonEmpty('node-id', values['node-id']);
    const email = nonEmpty('email', values.email);
    const spec = (await loadManifest()).find(
      (s) => s.name === name && s.kind === 'html' && s.loggedIn,
    );
    if (!spec) fail(`no logged-in html entry named "${name}" in tests/fixtures/manifest.json`);
    // Required, not optional (agy review, PR #3): without it the page's numeric user id
    // (currentUser.id and others) is neither replaced nor checked for, so a capture could pass
    // the fail-closed leftovers check while still carrying the real id.
    const rawId =
      values['user-id'] ?? fail('--from-file requires --user-id (the numeric id to replace)');
    if (!/^[1-9][0-9]*$/.test(rawId)) fail('--user-id must be a positive integer');
    const id = Number(rawId);
    const identity: Identity = {
      login,
      id,
      nodeId,
      email,
    };
    // --check is honoured here too: compare only, write nothing, exit 1 on drift.
    const result = await captureFromFile(spec, values['from-file'], identity, values.check);
    console.info(`${result.padEnd(9)} ${relative(ROOT, join(FIXTURES, 'html', `${name}.html`))}`);
    if (result === 'drift') {
      console.error('capture-fixture: the saved page differs from the committed fixture');
      process.exit(1);
    }
    return;
  }

  let specs: FixtureSpec[];
  if (values.url !== undefined) {
    if (values.name === undefined) fail('--url requires --name');
    specs = [validate({ name: values.name, kind: values.json ? 'json' : 'html', url: values.url })];
  } else {
    specs = await loadManifest();
    if (values.kind !== undefined) specs = specs.filter((s) => s.kind === values.kind);
    if (positionals.length > 0) specs = selectByName(specs, positionals);
    if (specs.length === 0) fail('no fixtures matched');
  }

  let drift = 0;
  for (const spec of specs) {
    const result = await capture(spec, values.check);
    if (result === 'drift') drift++;
    console.info(
      `${result.padEnd(9)} ${relative(ROOT, join(FIXTURES, spec.kind, `${spec.name}.${spec.kind}`))}`,
    );
    if (result === 'skipped') continue; // logged-in fixtures are captured with --from-file
    // Be polite to github.com: sequential requests with a short pause.
    await new Promise((r) => setTimeout(r, 750));
  }
  if (values.check && drift > 0) {
    console.error(`capture-fixture: ${drift} fixture(s) differ from live GitHub`);
    process.exit(1);
  }
}

await main();
