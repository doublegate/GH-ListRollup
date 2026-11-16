# ref-docs: Reference Material

These files are a historical record of research done on 2026-11-15. Do not edit them in place. To
correct or extend one, add a dated supplement such as `research-update-2027-03.md` and link it here.

| File | Contents |
|---|---|
| `initial-concept.md` | The request, the clarified behaviour, the decisions and the non-goals |
| `research-report.md` | Consolidated report covering all the topic files, with citations, risks and open questions. **Start here.** |
| `github-code-view-dom.md` | The repository listing DOM on both layouts, as observed; recommended selectors; CSP |
| `github-navigation-events.md` | Turbo, React router and `soft-nav:*` events; what Refined GitHub hooks |
| `github-data-sources.md` | The same-origin tree JSON, the embedded payload, and the REST contents and trees APIs with their limits |
| `chrome-mv3.md` | Chrome MV3 content scripts, service worker, storage, permissions, network rules |
| `firefox-mv3.md` | Firefox MV3: gecko settings, event page, `data_collection_permissions`, the permission model |
| `cross-browser-differences.md` | Differences that matter for this project, and WXT's handling of them |
| `store-publishing.md` | Chrome Web Store, AMO and Edge Add-ons requirements and review |
| `wxt-framework.md` | WXT 0.21 configuration, content-script context, storage, zip, with pinned versions |
| `testing-extensions.md` | Vitest with WXT, Playwright for Chromium, the Firefox options, `web-ext lint`, the selector-drift tests |
| `prior-art.md` | Refined GitHub, Tako, Gitako, Octotree and others, with lessons and licenses |

Raw captures from the research live in `raw/`, which is gitignored and kept only on the development
machine (see `raw/README.md`): GitHub pages and headers, tree JSON responses, GitHub's JS bundles and
MDN compatibility data. Sanitized HTML fixtures for tests are created separately in Phase 0
Sprint 2, with user data stripped (`docs/testing-strategy.md` §3).

This index is maintained as `ref-docs/` grows. The immutability rule (`CLAUDE.md`) applies to the
research files it lists: corrections to them go in dated `research-update-*.md` supplements.
