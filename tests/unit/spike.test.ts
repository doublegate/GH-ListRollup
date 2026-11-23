/**
 * The T-GNR-201 spike's report: counts and booleans only, never a name or a path.
 */
import { describe, expect, it } from 'vitest';
import { summarize } from '@/dev/spike';
import { loadJsonFixture } from '../helpers/fixture';

const response = (status = 200) => ({
  status,
  redirected: false,
  url: 'https://github.com/secret-owner/secret-repo/tree/main/secret-folder',
});

describe('spike summarize', () => {
  it('reports counts and flags for a tree JSON response', () => {
    const line = summarize('fetch', response(), loadJsonFixture('nested'));
    expect(line).toMatch(/via=fetch status=200 redirected=false finalHost=github\.com json=yes/);
    expect(line).toMatch(/items=\d+ total=\d+ malformed=0 oid=yes/);
  });

  it('never includes the repository, a folder or an entry name', () => {
    const json = loadJsonFixture<{
      payload: { codeViewTreeRoute: { tree: { items: { name: string }[] } } };
    }>('nested');
    const names = json.payload.codeViewTreeRoute.tree.items.map((i) => i.name);
    const line = summarize('fetch', response(), json);
    for (const secret of ['secret-owner', 'secret-repo', 'secret-folder', 'src/vs', ...names]) {
      expect(line).not.toContain(secret);
    }
  });

  it('reports the repository visibility flags when the route has them', () => {
    expect(summarize('fetch', response(404), loadJsonFixture('not-found-404'))).toContain(
      'private=false orgOwned=true',
    );
  });

  it('reports a non-JSON body, a schema mismatch and a failed request', () => {
    expect(summarize('fetch', response(302), undefined)).toContain('json=no');
    expect(summarize('fetch', response(), { payload: {} })).toContain('schema=SchemaError');
    expect(summarize('content.fetch', null, undefined, new TypeError('x'))).toBe(
      'spike T-GNR-201 via=content.fetch request-failed=TypeError',
    );
  });
});
