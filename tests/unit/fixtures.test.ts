import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { report } from '../../scripts/lib/dom-report.ts';
import {
  PLACEHOLDER_EMAIL,
  PLACEHOLDER_ID,
  PLACEHOLDER_LOGIN,
} from '../../scripts/lib/sanitize.ts';
import {
  fixtureUrl,
  loadHtmlFixture,
  loadJsonFixture,
  resetDocument,
  useHtmlFixture,
} from '../helpers/fixture';

interface TreeJson {
  payload: Record<
    string,
    { tree?: { items: { contentType: string; name: string }[]; totalCount: number } }
  >;
}

const treeOf = (name: string) => {
  const route = Object.values(loadJsonFixture<TreeJson>(name).payload).find((r) => r.tree);
  if (!route?.tree) throw new Error(`no tree in ${name}`);
  return route.tree;
};

describe('HTML fixtures (T-GNR-014)', () => {
  describe('root', () => {
    useHtmlFixture('root');

    it('loads at its source URL', () => {
      expect(location.href).toBe('https://github.com/git/git');
    });

    it('contains the directory listing', () => {
      expect(document.querySelector('[data-testid="directory-content"]')).not.toBeNull();
    });

    it('is a code-view page with folder rows but no parent-directory row', () => {
      expect(document.querySelector('react-app[app-name="code-view"]')).not.toBeNull();
      expect(document.querySelectorAll('a[aria-label$=", (Directory)"]').length).toBeGreaterThan(0);
      expect(document.querySelector('[data-testid="up-tree"]')).toBeNull();
    });

    it('carries no executable scripts', () => {
      const scripts = [...document.querySelectorAll('script')];
      expect(scripts.map((s) => s.getAttribute('type'))).toEqual(['application/json']);
    });
  });

  describe('folder', () => {
    useHtmlFixture('folder');

    it('finds the parent-directory (up-tree) row', () => {
      expect(location.pathname).toBe('/git/git/tree/master/contrib');
      expect(document.querySelector('a[data-testid="up-tree"]')).not.toBeNull();
    });
  });

  describe('lifecycle', () => {
    afterEach(() => resetDocument());

    it('resetDocument restores an empty page', () => {
      loadHtmlFixture('root');
      resetDocument();
      expect(document.querySelector('[data-testid="directory-content"]')).toBeNull();
      expect(document.body.childElementCount).toBe(0);
    });

    it('accepts a URL override', () => {
      loadHtmlFixture('folder', { url: 'https://github.com/git/git/tree/v2.0.0/contrib' });
      expect(location.pathname).toBe('/git/git/tree/v2.0.0/contrib');
    });

    it('rejects unknown fixtures', () => {
      expect(() => fixtureUrl('nope')).toThrow(/No html fixture/);
    });
  });
});

describe('JSON fixtures (T-GNR-013 cases)', () => {
  const kinds = (name: string) => new Set(treeOf(name).items.map((i) => i.contentType));

  it('root has directories, files, a submodule and a file symlink', () => {
    expect(kinds('root')).toEqual(new Set(['directory', 'file', 'submodule', 'symlink_file']));
  });

  it('capped-1000 keeps 1000 items with a larger totalCount', () => {
    const tree = treeOf('capped-1000');
    expect(tree.items).toHaveLength(1000);
    expect(tree.totalCount).toBeGreaterThan(1000);
  });

  it('simplified-chain contains a hasSimplifiedPath entry', () => {
    const items = treeOf('simplified-chain').items as { hasSimplifiedPath?: boolean }[];
    expect(items.some((i) => i.hasSimplifiedPath === true)).toBe(true);
  });

  it('submodule and symlink-directory cover those content types', () => {
    expect(kinds('submodule').has('submodule')).toBe(true);
    expect(kinds('symlink-directory')).toEqual(new Set(['symlink_directory']));
  });

  it('slash-ref reports a ref name containing slashes', () => {
    const data = loadJsonFixture<{ payload: Record<string, { refInfo?: { name: string } }> }>(
      'slash-ref',
    );
    const ref = Object.values(data.payload).find((r) => r.refInfo)?.refInfo?.name;
    expect(ref).toBe('branch/with/slashes');
  });

  it('not-found-404 is the "File not found" response', () => {
    expect(loadJsonFixture<{ meta: { title: string } }>('not-found-404').meta.title).toBe(
      'File not found',
    );
  });

  it('no fixture contains an unredacted token or avatar URL', () => {
    for (const kind of ['html', 'json']) {
      const dir = join(import.meta.dirname, '..', 'fixtures', kind);
      for (const file of readdirSync(dir).filter((f) => f.endsWith(`.${kind}`))) {
        const text = readFileSync(join(dir, file), 'utf8');
        expect(text, file).not.toMatch(/avatars\.githubusercontent\.com/);
        expect(text, file).not.toMatch(/"(uploadToken|authenticity_token)":"(?!REDACTED)/);
        expect(text, file).not.toMatch(/\bnonce=/);
        expect(text, file).not.toMatch(/jwt=eyJ/);
        expect(text, file).not.toMatch(/data-channel=/);
        expect(text, file).not.toMatch(/[A-Za-z0-9+/_-]{16,}={0,2}--[0-9a-f]{40,}/);
      }
    }
  });
});

describe('signed-in fixtures (T-GNR-012)', () => {
  const embedded = (name: string) => {
    const html = readFileSync(
      join(import.meta.dirname, '..', 'fixtures', 'html', `${name}.html`),
      'utf8',
    );
    const json = /data-target="react-app.embeddedData">(.*?)<\/script>/s.exec(html)?.[1];
    if (!json) throw new Error(`no embedded data in ${name}`);
    return {
      html,
      data: JSON.parse(json) as { payload: Record<string, { currentUser?: unknown }> },
    };
  };

  it.each(['root-logged-in', 'folder-logged-in'])(
    '%s carries only the placeholder identity',
    (name) => {
      const { html, data } = embedded(name);
      const user = Object.values(data.payload).find((r) => r.currentUser)?.currentUser;
      expect(user).toEqual({
        id: Number(PLACEHOLDER_ID),
        login: PLACEHOLDER_LOGIN,
        userEmail: PLACEHOLDER_EMAIL,
      });
      expect(html).toContain(`<meta name="user-login" content="${PLACEHOLDER_LOGIN}">`);
    },
  );

  it('signed-in pages match every selector exactly like their signed-out twins', async () => {
    const table = await report(['root', 'root-logged-in', 'folder', 'folder-logged-in']);
    expect(table['root-logged-in']).toEqual(table.root);
    expect(table['folder-logged-in']).toEqual(table.folder);
  });
});
