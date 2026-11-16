/**
 * Sanitizers for GitHub test fixtures (T-GNR-011, docs/testing-strategy.md section 3).
 *
 * Captured pages and JSON must be safe to commit and stable across re-captures. That means: no
 * executable script bodies, no per-request values (nonces, request ids, visitor payloads, HMACs),
 * no tokens, no analytics metadata, and no avatars. The rules are allowlist-first where possible,
 * so a new kind of noise that GitHub adds is dropped by default rather than leaking into fixtures.
 */
import { Window } from 'happy-dom';

/** `<meta name=...>` values kept in HTML fixtures; every other `<meta>` is removed. */
export const KEPT_META_NAMES = new Set([
  'route-controller',
  'route-action',
  'route-pattern',
  'hostname',
  'expected-hostname',
  'user-login',
  'turbo-body-classes',
  'turbo-cache-control',
  'disable-turbo',
  'selected-link',
  'color-scheme',
  'viewport',
]);

/** The only `<script>` kept: the code-view payload the page model may read. */
export const KEPT_SCRIPT_SELECTOR =
  'script[type="application/json"][data-target="react-app.embeddedData"]';

/** Attributes removed from every element. */
const DROPPED_ATTRIBUTES = [
  /(^|-)nonce$/, // nonce, data-nonce (in-product-messaging fragments when signed in)
  /^integrity$/,
  /^data-analytics-/,
  /^data-hydro-/,
  /hmac/i,
  /csrf/i,
  // Signed per-user live-update channel (encodes the user id), e.g. notification-shelf-watcher.
  /^data-channel$/,
];

/** Rails-style signed message: base64 payload, "--", hex HMAC. May encode user ids. */
const SIGNED_MESSAGE = /[A-Za-z0-9+/_-]{16,}={0,2}--[0-9a-f]{40,}/g;

/** JSON keys whose string values are replaced with REDACTED. */
const SECRET_KEY = /token|csrf|hmac|nonce|secret|password/i;

/** JSON keys holding avatar URLs; their string values are blanked like `<img>` avatars. */
const AVATAR_KEY = /avatar/i;

/**
 * JSON keys holding rendered markdown, such as a repository's README as HTML. This is third-party
 * prose the tests never need; blanking it keeps committed fixtures to structure and file names
 * (fixture minimization, 2026-11-16).
 */
const RENDERED_MARKDOWN_KEY = /^richText$/;

/**
 * Elements removed to keep HTML fixtures minimal: GitHub's site chrome and rendered markdown. Only
 * `header` elements outside the code-view app are removed; the folder page's breadcrumb lives in
 * one inside it.
 */
const MINIMIZE_SELECTORS = ['footer', 'article.markdown-body'];

/**
 * JSON keys whose numeric values change between requests without any content change: server
 * timings and live social counters. Zeroed so re-captures stay byte-identical.
 */
const VOLATILE_NUMBER_KEY =
  /ProcessingTime$|^(stargazerCount|forksCount|watcherCount|watchersCount)$/;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Text-level normalization applied to every fixture after serialization:
 *
 * - **UUIDs.** GitHub generates random UUIDs for some element ids, and other attributes refer to
 *   them. Each distinct UUID becomes a sequential placeholder in order of first appearance, so the
 *   references stay consistent.
 * - **Signed `jwt=` URL parameters.** README images are served as short-lived signed URLs; the
 *   token is redacted.
 */
export function normalizeVolatileText(text: string): string {
  const seen = new Map<string, string>();
  const renumbered = text.replace(UUID, (uuid) => {
    const key = uuid.toLowerCase();
    let replacement = seen.get(key);
    if (replacement === undefined) {
      replacement = `00000000-0000-4000-8000-${String(seen.size + 1).padStart(12, '0')}`;
      seen.set(key, replacement);
    }
    return replacement;
  });
  return renumbered
    .replace(/([?&](?:amp;)?jwt=)[A-Za-z0-9._-]+/g, `$1${REDACTED}`)
    .replace(SIGNED_MESSAGE, REDACTED);
}

/**
 * Returns the identity values (login, id, node id, email) that still appear inside any
 * base64/base64url-encoded run in `text`. Plain-text occurrences are checked separately; this
 * catches values hidden in encoded blobs such as signed channels.
 */
export function findEncodedIdentity(text: string, identity: Identity): string[] {
  const needles = [
    identity.login,
    identity.id !== undefined ? String(identity.id) : '',
    identity.nodeId ?? '',
    identity.email ?? '',
  ]
    .filter((s) => s.length > 0)
    .map((s) => s.toLowerCase());
  const found = new Set<string>();
  for (const run of text.match(/[A-Za-z0-9+/_-]{16,}={0,2}/g) ?? []) {
    const normalized = run.replace(/-/g, '+').replace(/_/g, '/');
    for (const offset of [0, 1, 2, 3]) {
      const decoded = Buffer.from(normalized.slice(offset), 'base64')
        .toString('latin1')
        .toLowerCase();
      for (const needle of needles) if (decoded.includes(needle)) found.add(needle);
    }
  }
  return [...found];
}

export const REDACTED = 'REDACTED';
export const PLACEHOLDER_LOGIN = 'fixture-user';
export const PLACEHOLDER_ID = '1000001';
export const PLACEHOLDER_NODE_ID = 'FIXTURE_NODE_ID';
export const PLACEHOLDER_EMAIL = 'fixture-user@example.invalid';

/** The signed-in user whose identifiers must not appear in a logged-in fixture. */
export interface Identity {
  login: string;
  id?: number;
  nodeId?: string;
  email?: string;
}

/** JSON keys holding email addresses; any string value is replaced, whoever it belongs to. */
const EMAIL_KEY = /email/i;

export interface HtmlSanitizeOptions {
  /** Page URL, used as the document base while parsing and in the provenance comment. */
  sourceUrl: string;
  /** Fixture name for the provenance comment. */
  name: string;
  /** For logged-in captures only: the identity to replace (see replaceIdentity). */
  identity?: Identity;
}

/**
 * Recursively redacts secret-looking keys and blanks avatar URLs. Returns a new value; the input
 * is not modified.
 */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if ((AVATAR_KEY.test(key) || RENDERED_MARKDOWN_KEY.test(key)) && typeof child === 'string') {
        out[key] = '';
      } else if (EMAIL_KEY.test(key) && typeof child === 'string') {
        out[key] = PLACEHOLDER_EMAIL;
      } else if (VOLATILE_NUMBER_KEY.test(key) && typeof child === 'number') {
        out[key] = 0;
      } else if (SECRET_KEY.test(key) && child !== null && typeof child !== 'object') {
        out[key] = REDACTED;
      } else if (SECRET_KEY.test(key) && child !== null && typeof child === 'object') {
        // A map of tokens (for example csrf_tokens keyed by form path): keep the keys, redact all leaves.
        out[key] = redactAll(child);
      } else {
        out[key] = redactSecrets(child);
      }
    }
    return out;
  }
  return value;
}

function redactAll(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAll);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactAll(v)]));
  }
  return REDACTED;
}

/**
 * Replaces a signed-in user's identity everywhere in `text`:
 *
 * - the login, matched as a whole word and case-insensitively, so it also covers a display name
 *   that equals the login, becomes PLACEHOLDER_LOGIN
 * - the numeric user id, matched as a whole number, becomes PLACEHOLDER_ID
 * - the GraphQL node id becomes PLACEHOLDER_NODE_ID
 */
export function replaceIdentity(text: string, identity: Identity | undefined): string {
  if (!identity) return text;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = text.replace(
    new RegExp(`(?<![A-Za-z0-9-])${esc(identity.login)}(?![A-Za-z0-9-])`, 'gi'),
    PLACEHOLDER_LOGIN,
  );
  if (identity.id !== undefined) {
    out = out.replace(new RegExp(`(?<![0-9])${identity.id}(?![0-9])`, 'g'), PLACEHOLDER_ID);
  }
  if (identity.nodeId) out = out.split(identity.nodeId).join(PLACEHOLDER_NODE_ID);
  if (identity.email) out = out.replace(new RegExp(esc(identity.email), 'gi'), PLACEHOLDER_EMAIL);
  return out;
}

/**
 * Sanitizes a captured GitHub page. Output is deterministic for identical input: no timestamps,
 * stable attribute order (happy-dom preserves source order), fixed provenance header.
 */
export async function sanitizeGitHubHtml(
  html: string,
  options: HtmlSanitizeOptions,
): Promise<string> {
  const window = new Window({ url: options.sourceUrl });
  try {
    // DOMParser never executes scripts; verified against happy-dom 21 (see T-GNR-011 notes).
    // trimEnd: the HTML parser moves text after </html> into <body>, so a trailing newline would
    // grow by one on every pass and break idempotence (re-processing committed fixtures).
    const doc = new window.DOMParser().parseFromString(html.trimEnd(), 'text/html');

    for (const script of doc.querySelectorAll('script')) {
      if (!script.matches(KEPT_SCRIPT_SELECTOR)) {
        script.remove();
        continue;
      }
      const parsed: unknown = JSON.parse(script.textContent ?? 'null');
      script.textContent = replaceIdentity(JSON.stringify(redactSecrets(parsed)), options.identity);
    }

    for (const el of doc.querySelectorAll('link, style, noscript')) el.remove();

    // Minimization: GitHub's site header and footer, and rendered markdown (READMEs), are not
    // needed by any test and are GitHub-authored or third-party content.
    for (const el of doc.querySelectorAll('header')) {
      if (!el.closest('react-app')) el.remove();
    }
    for (const el of doc.querySelectorAll(MINIMIZE_SELECTORS.join(', '))) el.remove();
    // The command palette is server-rendered only for signed-in users (about 37 KB of GitHub UI).
    for (const el of doc.querySelectorAll('command-palette')) {
      (el.closest('dialog-helper') ?? el).remove();
    }
    // Icon elements and classes stay (tests and selectors use them); the path drawings go.
    for (const path of doc.querySelectorAll('svg path')) path.removeAttribute('d');

    for (const meta of doc.querySelectorAll('meta')) {
      const name = meta.getAttribute('name');
      const keep = meta.hasAttribute('charset') || (name !== null && KEPT_META_NAMES.has(name));
      if (!keep) meta.remove();
    }

    for (const input of doc.querySelectorAll(
      'input[name="authenticity_token"], input[name="timestamp"], input[name="timestamp_secret"]',
    )) {
      input.remove();
    }

    for (const el of doc.querySelectorAll('*')) {
      for (const attr of [...el.getAttributeNames()]) {
        if (DROPPED_ATTRIBUTES.some((re) => re.test(attr))) el.removeAttribute(attr);
      }
    }

    for (const img of doc.querySelectorAll('img')) {
      const src = img.getAttribute('src') ?? '';
      if (/avatars\.githubusercontent\.com|\/avatars\//.test(src)) {
        img.setAttribute('src', '');
        img.removeAttribute('srcset');
      }
    }

    const header = `<!-- GH-ListRollup test fixture "${options.name}" from ${options.sourceUrl}. Generated by scripts/capture-fixture.ts; do not edit by hand. -->`;
    // Reading (not writing) outerHTML of a sandboxed, script-free happy-dom document to serialize
    // the fixture. This is dev tooling, not extension code; the sink ban targets writes into pages.
    // eslint-disable-next-line no-restricted-properties
    const serialized = doc.documentElement.outerHTML;
    const body = normalizeVolatileText(replaceIdentity(serialized, options.identity));
    return `<!DOCTYPE html>\n${header}\n${body}\n`;
  } finally {
    await window.happyDOM.close();
  }
}

/** Formats a JSON fixture: secrets redacted, optional item trim, stable 2-space formatting. */
export function sanitizeTreeJson(
  raw: string,
  options: { maxItems?: number; identity?: Identity } = {},
): string {
  const data = redactSecrets(JSON.parse(raw)) as Record<string, unknown>;
  if (options.maxItems !== undefined) trimTreeItems(data, options.maxItems);
  return `${normalizeVolatileText(replaceIdentity(JSON.stringify(data, null, 2), options.identity))}\n`;
}

/** Trims `payload.<route>.tree.items` to `maxItems`, keeping `totalCount` untouched. */
export function trimTreeItems(data: Record<string, unknown>, maxItems: number): void {
  const payload = data.payload;
  if (payload === null || typeof payload !== 'object') return;
  for (const route of Object.values(payload)) {
    const tree = (route as { tree?: { items?: unknown[] } } | null)?.tree;
    if (tree && Array.isArray(tree.items) && tree.items.length > maxItems) {
      tree.items = tree.items.slice(0, maxItems);
    }
  }
}
