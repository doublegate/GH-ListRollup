import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_EMAIL,
  PLACEHOLDER_ID,
  PLACEHOLDER_LOGIN,
  PLACEHOLDER_NODE_ID,
  REDACTED,
  findEncodedIdentity,
  identityLeftovers,
  normalizeVolatileText,
  redactSecrets,
  replaceIdentity,
  sanitizeGitHubHtml,
  sanitizeTreeJson,
} from '../../scripts/lib/sanitize.ts';

const page = (head: string, body: string) =>
  `<!DOCTYPE html><html lang="en"><head>${head}</head><body>${body}</body></html>`;

const embedded = (obj: unknown) =>
  `<script type="application/json" data-target="react-app.embeddedData">${JSON.stringify(obj)}</script>`;

const opts = { sourceUrl: 'https://github.com/o/r', name: 'test' };

describe('sanitizeGitHubHtml', () => {
  it('removes executable and non-allowlisted scripts but keeps the code-view payload', async () => {
    const out = await sanitizeGitHubHtml(
      page(
        '<script>alert(1)</script><script src="https://x/app.js" type="module"></script>' +
          '<script type="application/json" id="client-env">{"a":1}</script>',
        embedded({ payload: { ok: true } }),
      ),
      opts,
    );
    expect(out).not.toContain('alert(1)');
    expect(out).not.toContain('app.js');
    expect(out).not.toContain('client-env');
    expect(out).toContain('data-target="react-app.embeddedData"');
    expect(out.match(/<script/g)).toHaveLength(1);
  });

  it('keeps only allowlisted meta tags', async () => {
    const out = await sanitizeGitHubHtml(
      page(
        '<meta charset="utf-8"><meta name="route-controller" content="files">' +
          '<meta name="request-id" content="A1:B2"><meta name="html-safe-nonce" content="abc">' +
          '<meta name="visitor-payload" content="xyz"><meta name="octolytics-url" content="u">' +
          '<meta property="og:image" content="i">',
        '',
      ),
      opts,
    );
    expect(out).toContain('route-controller');
    expect(out).toContain('charset="utf-8"');
    for (const gone of [
      'request-id',
      'html-safe-nonce',
      'visitor-payload',
      'octolytics',
      'og:image',
    ]) {
      expect(out).not.toContain(gone);
    }
  });

  it('strips nonce, integrity, analytics, hydro and hmac attributes, links and styles', async () => {
    const out = await sanitizeGitHubHtml(
      page(
        '<link rel="stylesheet" href="s.css"><style>.a{}</style>',
        '<a data-analytics-event="{}" data-hydro-click="x" data-hydro-click-hmac="y" nonce="n" integrity="i" data-testid="keep" href="/o/r">x</a><include-fragment data-nonce="v2:abc"></include-fragment>',
      ),
      opts,
    );
    expect(out).not.toMatch(/nonce=|integrity=|data-analytics-|data-hydro-|hmac|<link|<style/);
    expect(out).toContain('data-testid="keep"');
  });

  it('removes authenticity tokens and blanks avatars', async () => {
    const out = await sanitizeGitHubHtml(
      page(
        '',
        '<form><input type="hidden" name="authenticity_token" value="secret123"></form>' +
          '<img src="https://avatars.githubusercontent.com/u/1?v=4" srcset="a 2x" alt="me">',
      ),
      opts,
    );
    expect(out).not.toContain('secret123');
    expect(out).not.toContain('avatars.githubusercontent.com');
    expect(out).not.toContain('srcset');
    expect(out).toContain('alt="me"');
  });

  it('redacts tokens inside the embedded payload', async () => {
    const out = await sanitizeGitHubHtml(
      page(
        '',
        embedded({
          payload: { uploadToken: 'tok', csrf_tokens: { '/a/post': 'zzz' }, path: 'src' },
        }),
      ),
      opts,
    );
    expect(out).not.toContain('"tok"');
    expect(out).not.toContain('zzz');
    expect(out).toContain('"path":"src"');
  });

  it('replaces the logged-in login everywhere when asked', async () => {
    const out = await sanitizeGitHubHtml(
      page(
        '<meta name="user-login" content="SomeUser">',
        '<a href="/SomeUser">someuser</a> someuserx',
      ),
      { ...opts, identity: { login: 'someuser' } },
    );
    expect(out).not.toMatch(/someuser(?!x)/i);
    expect(out).toContain(`content="${PLACEHOLDER_LOGIN}"`);
    expect(out).toContain('someuserx'); // whole-word only
  });

  it('is deterministic and starts with a provenance header', async () => {
    const html = page(
      '<meta name="request-id" content="1">',
      '<div data-testid="directory-content"></div>',
    );
    const a = await sanitizeGitHubHtml(html, opts);
    const b = await sanitizeGitHubHtml(html.replace('content="1"', 'content="2"'), opts);
    expect(a).toBe(b);
    expect(
      a.startsWith(
        '<!DOCTYPE html>\n<!-- GH-ListRollup test fixture "test" from https://github.com/o/r.',
      ),
    ).toBe(true);
  });
});

describe('redactSecrets', () => {
  it('blanks avatar URLs in JSON at any depth', () => {
    expect(
      redactSecrets({
        repo: {
          ownerAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
          ownerAvatarUrl: 'u',
          id: 1,
        },
      }),
    ).toEqual({ repo: { ownerAvatar: '', ownerAvatarUrl: '', id: 1 } });
  });

  it('redacts secret-looking keys at any depth without touching other values', () => {
    expect(
      redactSecrets({
        a: 1,
        nested: { authToken: 'x', list: [{ hmac: 'y', name: 'n' }] },
        csrf_tokens: { p: 'q' },
      }),
    ).toEqual({
      a: 1,
      nested: { authToken: REDACTED, list: [{ hmac: REDACTED, name: 'n' }] },
      csrf_tokens: { p: REDACTED },
    });
  });

  it('does not redact non-string values or non-token maps whose key merely contains a secret word', () => {
    // agy review, PR #3: a folder path key like "src/token" wiped a whole file-tree map, and
    // booleans such as secretScanningEnabled became the string "REDACTED".
    const tree = {
      items: [{ name: 'a.ts', path: 'src/token/a.ts', contentType: 'file' }],
      totalCount: 1,
    };
    expect(
      redactSecrets({
        fileTree: { 'src/token': tree },
        secretScanningEnabled: false,
        tokenCount: 3,
        uploadToken: 'abc',
        csrf_tokens: { '/a/post': 'zzz' },
      }),
    ).toEqual({
      fileTree: { 'src/token': tree },
      secretScanningEnabled: false,
      tokenCount: 3,
      uploadToken: REDACTED,
      csrf_tokens: { '/a/post': REDACTED },
    });
  });

  it('does not wipe a file-tree entry for a folder literally named tokens', () => {
    const entry = { items: [{ name: 'k.json', path: 'tokens/k.json' }], totalCount: 1 };
    expect(redactSecrets({ fileTree: { tokens: entry, auth_tokens: entry } })).toEqual({
      fileTree: { tokens: entry, auth_tokens: entry },
    });
  });
});

describe('minimization (third-party and GitHub-authored content)', () => {
  const pageHtml = page(
    '<meta name="route-controller" content="files">',
    '<header class="site">Global nav, Product, Solutions</header>' +
      '<react-app app-name="code-view"><div id="StickyHeader"><header data-x="keep">Breadcrumb</header></div>' +
      '<div data-testid="directory-content"><table><tbody><tr class="react-directory-row"><td>' +
      '<svg class="octicon octicon-file-directory-fill" viewBox="0 0 16 16"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5Z"></path></svg>' +
      '<a aria-label="src, (Directory)" href="/o/r/tree/main/src">src</a></td></tr></tbody></table></div>' +
      '<article class="markdown-body"><h1>Third-party README</h1></article></react-app>' +
      '<footer>Terms Privacy</footer>' +
      embedded({
        payload: {
          overview: { overviewFiles: [{ richText: '<h1>README</h1>', displayName: 'README.md' }] },
        },
      }),
  );

  it('removes the site header and footer but keeps headers inside the code view', async () => {
    const out = await sanitizeGitHubHtml(pageHtml, opts);
    expect(out).not.toContain('Global nav');
    expect(out).not.toContain('Terms Privacy');
    expect(out).toContain('Breadcrumb');
  });

  it('removes rendered markdown (READMEs) in HTML and in the embedded JSON', async () => {
    const out = await sanitizeGitHubHtml(pageHtml, opts);
    expect(out).not.toContain('Third-party README');
    expect(out).not.toContain('<h1>README</h1>');
    expect(out).toContain('"displayName":"README.md"');
  });

  it('removes the signed-in command palette', async () => {
    const out = await sanitizeGitHubHtml(
      page(
        '',
        '<dialog-helper><dialog id="command-palette-pjax-container"><command-palette>Jump to</command-palette></dialog></dialog-helper><div data-testid="directory-content"></div>',
      ),
      opts,
    );
    expect(out).not.toMatch(/command-palette|dialog-helper|Jump to/);
    expect(out).toContain('directory-content');
  });

  it('removes plain-text READMEs (the #readme container), not just markdown articles', async () => {
    const out = await sanitizeGitHubHtml(
      page(
        '',
        '<div id="readme"><div class="plain"><pre>Third-party plain README</pre></div></div><div data-testid="directory-content"></div>',
      ),
      opts,
    );
    expect(out).not.toContain('Third-party plain README');
    expect(out).toContain('directory-content');
  });

  it('removes <template> elements, whose contents querySelectorAll cannot reach', async () => {
    const out = await sanitizeGitHubHtml(
      page(
        '',
        '<template id="t"><script>alert(1)</script><svg><path d="M1 1Z"></path></svg><img src="https://avatars.githubusercontent.com/u/1"></template><div data-testid="directory-content"></div>',
      ),
      opts,
    );
    expect(out).not.toMatch(/<template|alert\(1\)|M1 1Z|avatars\.githubusercontent/);
    expect(out).toContain('directory-content');
  });

  it('keeps icon elements and classes but drops path drawings', async () => {
    const out = await sanitizeGitHubHtml(pageHtml, opts);
    expect(out).toContain('octicon-file-directory-fill');
    expect(out).not.toContain('M1.75 1A1.75');
    expect(out).toContain('aria-label="src, (Directory)"');
  });

  it('is idempotent: sanitizing a sanitized page changes nothing', async () => {
    const once = await sanitizeGitHubHtml(pageHtml, opts);
    expect(await sanitizeGitHubHtml(once, opts)).toBe(once);
  });

  it('blanks richText in tree JSON', () => {
    expect(sanitizeTreeJson('{"overviewFiles":[{"richText":"<p>x</p>","tabName":"README"}]}')).toBe(
      '{\n  "overviewFiles": [\n    {\n      "richText": "",\n      "tabName": "README"\n    }\n  ]\n}\n',
    );
  });
});

describe('volatile values', () => {
  it('renumbers UUIDs in first-appearance order, keeping references consistent', () => {
    const a =
      'id="b-2a0d32cd-2c1b-4340-876d-0bf441153d07" for="b-2a0d32cd-2c1b-4340-876d-0bf441153d07" x="71c3fd5c-bd86-4d30-8c57-cf3b07144bf7"';
    const b =
      'id="b-d61efdfc-2d00-4c02-80e5-affdba7dcf14" for="b-d61efdfc-2d00-4c02-80e5-affdba7dcf14" x="11111111-bd86-4d30-8c57-cf3b07144bf7"';
    expect(normalizeVolatileText(a)).toBe(normalizeVolatileText(b));
    expect(normalizeVolatileText(a)).toBe(
      'id="b-00000000-0000-4000-8000-000000000001" for="b-00000000-0000-4000-8000-000000000001" x="00000000-0000-4000-8000-000000000002"',
    );
  });

  it('redacts Rails-style signed messages anywhere and drops data-channel', async () => {
    const signed =
      'eyJjIjoibm90aWZpY2F0aW9uLWNoYW5nZWQ6NjQ1In0=--be91498af9dfdf4063fac75a45bc3b692eeec455';
    expect(normalizeVolatileText(`x="${signed}" y`)).toBe(`x="${REDACTED}" y`);
    const out = await sanitizeGitHubHtml(
      page(
        '',
        `<notification-shelf-watcher data-channel="${signed}" data-base-url="/n"></notification-shelf-watcher><i data-x="${signed}"></i>`,
      ),
      opts,
    );
    expect(out).not.toContain('data-channel');
    expect(out).not.toContain('be91498af9');
  });

  it('finds identity values hidden in base64', () => {
    const blob = Buffer.from('{"c":"notification-changed:4242421"}').toString('base64');
    expect(findEncodedIdentity(`a="${blob}"`, { login: 'someone', id: 4242421 })).toEqual([
      '4242421',
    ]);
    expect(
      findEncodedIdentity('a="aGVsbG8gd29ybGQgaGVsbG8="', { login: 'someone', id: 4242421 }),
    ).toEqual([]);
  });

  it('redacts signed jwt query parameters', () => {
    expect(
      normalizeVolatileText(
        'https://private-user-images.githubusercontent.com/1/x.png?jwt=eyJhbGci.eyJleHAi.sig_-9"',
      ),
    ).toBe('https://private-user-images.githubusercontent.com/1/x.png?jwt=REDACTED"');
  });

  it('zeroes server timings and live counters in JSON', () => {
    expect(
      redactSecrets({
        fileTreeProcessingTime: 80.4,
        overviewFilesProcessingTime: 3,
        stargazerCount: 195442,
        forksCount: 9,
        watcherCount: 2,
        totalCount: 564,
      }),
    ).toEqual({
      fileTreeProcessingTime: 0,
      overviewFilesProcessingTime: 0,
      stargazerCount: 0,
      forksCount: 0,
      watcherCount: 0,
      totalCount: 564,
    });
  });

  it('normalizes the per-push listCacheKey', () => {
    expect(redactSecrets({ refInfo: { name: 'main', listCacheKey: 'v0:1794811672.0' } })).toEqual({
      refInfo: { name: 'main', listCacheKey: 'v0:0' },
    });
  });
});

describe('identityLeftovers (post-capture fail-closed check)', () => {
  const identity = { login: 'someuser', id: 6055, email: 'a@b.example' };

  it('ignores the numeric id inside a commit SHA (the replacement keeps SHAs intact)', () => {
    // Codex's example on PR #3: id 6055 occurs inside oid 7fb6055e678f...
    const out = replaceIdentity(
      '"currentOid":"7fb6055e678f800320d8ab8cd8f201d9493d1ba0","id":6055',
      identity,
    );
    expect(identityLeftovers(out, identity)).toEqual([]);
  });

  it('still flags the id as a whole token', () => {
    expect(identityLeftovers('"user_id":6055,', identity)).toEqual(['6055']);
  });

  it('stays strict for the login, even inside a longer token', () => {
    expect(identityLeftovers('/owner/someuser-tools', identity)).toEqual(['someuser']);
  });

  it('flags a surviving email', () => {
    expect(identityLeftovers('mailto:A@B.example', identity)).toEqual(['a@b.example']);
  });
});

describe('replaceIdentity', () => {
  const identity = { login: 'SomeUser', id: 6858, nodeId: 'MDQ6VXNlcjY4NTg=' };

  it('leaves text unchanged without an identity', () => {
    expect(replaceIdentity('abc', undefined)).toBe('abc');
  });

  it('replaces login, numeric id and node id, but not longer numbers or words', () => {
    const text =
      '{"login":"someuser","name":"SomeUser","id":6858,"node":"MDQ6VXNlcjY4NTg=","other":68581,"x":"someusers"}';
    expect(replaceIdentity(text, identity)).toBe(
      `{"login":"${PLACEHOLDER_LOGIN}","name":"${PLACEHOLDER_LOGIN}","id":${PLACEHOLDER_ID},"node":"${PLACEHOLDER_NODE_ID}","other":68581,"x":"someusers"}`,
    );
  });

  it('does not corrupt a hex hash that happens to contain the numeric id', () => {
    // agy review, PR #3: a digits-only boundary let the id match inside a commit SHA.
    const sha = 'abc6858def0123456789abcdef0123456789abcd';
    expect(replaceIdentity(`"oid":"${sha}","id":6858`, identity)).toBe(
      `"oid":"${sha}","id":${PLACEHOLDER_ID}`,
    );
  });

  it('replaces the email address as text and email-like JSON fields regardless of value', () => {
    const withEmail = { ...identity, email: 'Some.User@Mail.example' };
    expect(replaceIdentity('mailto:some.user@mail.example;', withEmail)).toBe(
      `mailto:${PLACEHOLDER_EMAIL};`,
    );
    expect(
      redactSecrets({ currentUser: { userEmail: 'a@b.c', primaryEmail: 'x@y.z', emails: 3 } }),
    ).toEqual({
      currentUser: { userEmail: PLACEHOLDER_EMAIL, primaryEmail: PLACEHOLDER_EMAIL, emails: 3 },
    });
  });

  it('applies to JSON fixtures too', () => {
    expect(sanitizeTreeJson('{"owner":"someuser","id":6858}', { identity })).toBe(
      `{\n  "owner": "${PLACEHOLDER_LOGIN}",\n  "id": ${PLACEHOLDER_ID}\n}\n`,
    );
  });
});

describe('sanitizeTreeJson', () => {
  const raw = JSON.stringify({
    payload: {
      codeViewTreeRoute: { tree: { items: [1, 2, 3, 4], totalCount: 8582 }, uploadToken: 't' },
    },
  });

  it('trims items but keeps totalCount, and redacts tokens', () => {
    const out = JSON.parse(sanitizeTreeJson(raw, { maxItems: 2 })) as {
      payload: {
        codeViewTreeRoute: { tree: { items: number[]; totalCount: number }; uploadToken: string };
      };
    };
    expect(out.payload.codeViewTreeRoute.tree.items).toEqual([1, 2]);
    expect(out.payload.codeViewTreeRoute.tree.totalCount).toBe(8582);
    expect(out.payload.codeViewTreeRoute.uploadToken).toBe(REDACTED);
  });

  it('formats with two-space indentation and a trailing newline', () => {
    expect(sanitizeTreeJson('{"a":1}')).toBe('{\n  "a": 1\n}\n');
  });
});

describe('bootstrap review findings (#8)', () => {
  it('replaces an email that contains the login, leaving no part of it', () => {
    // agy: login was replaced first, so `someuser@mail.example` became `fixture-user@mail.example`
    // and the email pattern then no longer matched; the domain survived the leftovers check.
    const identity = { login: 'someuser', id: 4242421, email: 'someuser@mail.example' };
    const out = replaceIdentity('"userEmail":"someuser@mail.example"', identity);
    expect(out).not.toContain('mail.example');
    expect(out).toContain(PLACEHOLDER_EMAIL);
  });

  it('replaces a noreply email that contains both the id and the login (#10)', () => {
    const identity = {
      login: 'someuser',
      id: 4242421,
      email: '4242421+someuser@users.noreply.github.com',
    };
    const out = replaceIdentity(
      '"userEmail":"4242421+someuser@users.noreply.github.com"',
      identity,
    );
    expect(out).toBe(`"userEmail":"${PLACEHOLDER_EMAIL}"`);
    expect(identityLeftovers(out, identity)).toEqual([]);
  });

  it('keeps </script> inside the embedded JSON escaped, so the fixture stays a fixed point', async () => {
    // Codex P2: JSON.stringify turned GitHub's \u003c back into a literal `<`.
    const once = await sanitizeGitHubHtml(
      // As GitHub serves it: `<` escaped as \u003c inside the JSON.
      page(
        '',
        `<script type="application/json" data-target="react-app.embeddedData">${JSON.stringify({
          payload: { description: '</script><img src=x onerror=alert(1)>' },
        }).replace(/</g, '\\u003c')}</script>`,
      ),
      opts,
    );
    expect(once).not.toContain('</script><img');
    const twice = await sanitizeGitHubHtml(once, opts);
    expect(twice).toBe(once);
    const json = /data-target="react-app\.embeddedData">(.*?)<\/script>/s.exec(once)?.[1] ?? '';
    expect((JSON.parse(json) as { payload: { description: string } }).payload.description).toBe(
      '</script><img src=x onerror=alert(1)>',
    );
  });

  it('keeps a folder literally named __proto__ in a file-tree map', () => {
    // Codex P2: assigning `__proto__` into `{}` hit the prototype setter and dropped the entry.
    const raw = '{"fileTree":{"__proto__":{"items":[{"name":"a"}],"totalCount":1}}}';
    expect(JSON.parse(sanitizeTreeJson(raw))).toEqual(JSON.parse(raw));
  });
});

describe('replaceIdentity placeholder collisions (#11)', () => {
  // Real logins only: GitHub allows letters, digits and hyphens, so a login can never equal
  // PLACEHOLDER_NODE_ID (`FIXTURE_NODE_ID`). `fixture-user` is valid and maps to itself.
  it.each(['example', 'invalid', 'fixture', 'user', 'node', 'id', 'fixture-user'])(
    'a login of %s does not rewrite the placeholders inserted for other fields',
    (login) => {
      const identity = {
        login,
        id: 4242421,
        nodeId: 'U_kgDOAAAA',
        email: 'someone@mail.example',
      };
      // Neutral keys: the login is replaced everywhere, keys included, by design.
      const out = replaceIdentity(
        `{"a":"${login}","b":"someone@mail.example","c":"U_kgDOAAAA","d":4242421}`,
        identity,
      );
      expect(out).toBe(
        `{"a":"${PLACEHOLDER_LOGIN}","b":"${PLACEHOLDER_EMAIL}","c":"${PLACEHOLDER_NODE_ID}","d":${PLACEHOLDER_ID}}`,
      );
    },
  );
});

describe('sanitizers end to end: placeholder collisions (#12)', () => {
  // redactSecrets writes PLACEHOLDER_EMAIL before replaceIdentity runs, and sanitizeGitHubHtml runs
  // replaceIdentity twice (payload JSON, then the serialized page), so masking inside one call of
  // replaceIdentity was not enough on its own.
  const identity = { login: 'example', id: 4242421 };

  it('sanitizeTreeJson keeps PLACEHOLDER_EMAIL intact for a login of example', () => {
    const out = sanitizeTreeJson(
      '{"payload":{"userEmail":"someone@mail.example","login":"example"}}',
      {
        identity,
      },
    );
    const parsed = JSON.parse(out) as { payload: { userEmail: string; login: string } };
    expect(parsed.payload.userEmail).toBe(PLACEHOLDER_EMAIL);
    expect(parsed.payload.login).toBe(PLACEHOLDER_LOGIN);
  });

  it('sanitizeGitHubHtml keeps PLACEHOLDER_EMAIL intact for a login of example', async () => {
    const out = await sanitizeGitHubHtml(
      page('', embedded({ payload: { userEmail: 'someone@mail.example', login: 'example' } })),
      { ...opts, identity },
    );
    expect(out).toContain(PLACEHOLDER_EMAIL);
    expect(out).not.toContain('fixture-user@fixture-user');
  });
});

describe('replaceIdentity: identity values that contain placeholder text (#12, round 2)', () => {
  // The round-1 fix pre-masked placeholders without boundaries, which split identity values that
  // contain placeholder text before their own pass ran; one case leaked the email domain while
  // passing the leftovers check.
  it.each([
    [
      'login inside its own email',
      { login: 'fixture-user', email: 'fixture-user@mail.example' },
      'fixture-user@mail.example',
    ],
    [
      'placeholder inside an email local part',
      { login: 'someone', email: 'someone+fixture-user@company.com' },
      'someone+fixture-user@company.com',
    ],
    [
      'email built from a colliding login',
      { login: 'example', email: 'example@mail.example' },
      'example@mail.example',
    ],
  ])('%s is replaced whole', (_label, identity, email) => {
    const out = replaceIdentity(`"userEmail":"${email}"`, identity);
    expect(out).toBe(`"userEmail":"${PLACEHOLDER_EMAIL}"`);
    expect(identityLeftovers(out, identity)).toEqual([]);
  });

  it('a login that extends the login placeholder is replaced whole', () => {
    const identity = { login: 'fixture-user-dev' };
    expect(replaceIdentity('"login":"fixture-user-dev"', identity)).toBe(
      `"login":"${PLACEHOLDER_LOGIN}"`,
    );
  });

  it('an id that extends the id placeholder is replaced whole', () => {
    const identity = { login: 'someone', id: 10000019 };
    expect(replaceIdentity('"id":10000019', identity)).toBe(`"id":${PLACEHOLDER_ID}`);
  });

  it('existing placeholders survive every colliding login', () => {
    for (const login of ['example', 'invalid', 'fixture', 'user', 'fixture-user']) {
      const text = `"a":"${PLACEHOLDER_EMAIL}","b":"${PLACEHOLDER_NODE_ID}","c":${PLACEHOLDER_ID}`;
      expect(replaceIdentity(text, { login }), login).toBe(text);
    }
  });
});

describe('identityLeftovers ignores placeholders without hiding real values (#12)', () => {
  it('does not flag a login that occurs only inside PLACEHOLDER_EMAIL', () => {
    expect(identityLeftovers(`"e":"${PLACEHOLDER_EMAIL}"`, { login: 'example' })).toEqual([]);
  });

  it('still flags an unreplaced login that extends the login placeholder', () => {
    expect(identityLeftovers('"login":"fixture-user-dev"', { login: 'fixture-user-dev' })).toEqual([
      'fixture-user-dev',
    ]);
  });
});
