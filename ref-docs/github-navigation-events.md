# GitHub Navigation Without Full Page Loads: Events an Extension Can Use

Retrieved: 2026-11-15

## Sources

- [S1] Direct observation: GitHub JS bundles loaded by `https://github.com/microsoft/vscode/tree/main/src/vs` (logged out), fetched 2026-11-15 from `https://github.githubassets.com/assets/`: `core-240e9177cbcda8b3.js`, `app-runtime-449576a5ba272035.js`, `react-core-d184ea15062eeab5.js`, `code-view-7c823173c8ab5f57.js`. File names are content-hashed and will change.
- [S2] Direct observation: page markup of `https://github.com/microsoft/vscode` and the `/tree/` page above (turbo-frame, `data-turbo-transient` metas, `react-app`), 2026-11-15.
- [S3] refined-github source, `main` branch, fetched 2026-11-15 (https://github.com/refined-github/refined-github): `source/feature-manager.tsx`, `source/github-events/on-react-page-update.tsx`, `source/helpers/feature-helpers.ts`, `source/components/url.ts`, `source/features/clean-readme-url.tsx`, `source/helpers/selector-observer.tsx`.
- [S4] Turbo reference, "Events": https://turbo.hotwired.dev/reference/events - Turbo Drive event order and targets.
- [S5] MDN, "Navigation API": https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API - Baseline "Newly available" since January 2026.
- [S6] Chrome for Developers, "Content scripts": https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts - isolated worlds share the DOM, not JS state; `run_at`.
- [S7] MDN, "Content scripts" (WebExtensions): https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts - Firefox Xray vision, content scripts cannot see page JS variables.
- [S8] Hotwire forum, "Turbo visit does not trigger turbo:load events on destination page": https://discuss.hotwired.dev/t/turbo-visit-does-not-trigger-turbo-load-events-on-destination-page/3461 - community report that `turbo:load` is not reliable in every setup (secondary source).
- [S9] github-url-detection 11.2.4: https://unpkg.com/github-url-detection@11.2.4/distribution/index.js - page classifiers used by refined-github.

Legend: **[observed]** seen in fetched code/markup; **[claimed]** a source says so; **[inference]** my reasoning.

## 1. Two navigation mechanisms coexist

1. **Turbo Drive / Turbo Frames** for the Rails-rendered parts of the site. [observed] The repo
   content is wrapped in `<turbo-frame id="repo-content-turbo-frame" target="_top" data-turbo-action="advance">`,
   and route metas (`route-pattern`, `route-controller`, `route-action`) and `turbo-body-classes` are
   marked `data-turbo-transient`, i.e. replaced per visit [S2]. The bundles listen for and react to
   `turbo:before-fetch-request`, `turbo:before-fetch-response`, `turbo:before-render`, `turbo:render`,
   `turbo:load`, `turbo:visit`, `turbo:frame-load`, `turbo:frame-render`, `turbo:before-cache`,
   `turbo:restored` and others [S1].
2. **React app router ("soft navigation")** inside `react-app[app-name="code-view"]`. Moving between
   the repo root and `/tree/...` folders (and to `/blob/` files) inside code view is a client-side
   route change with no document reload [observed: `data-data-router-enabled="true"` on the
   `react-app`, S2; React route payload events in S1].

GitHub wraps both in its own **`soft-nav:*`** event family, dispatched on `document`.

## 2. The `soft-nav:*` events (observed in GitHub's bundles)

[observed, S1] `core-*.js` defines a frozen constant table:

```text
INITIAL   soft-nav:initial        START   soft-nav:start
SUCCESS   soft-nav:success        ERROR   soft-nav:error
END       soft-nav:end            RENDER  soft-nav:render
REACT_DONE soft-nav:react-done    FRAME_UPDATE soft-nav:frame-update
REPLACE_MECHANISM soft-nav:replace-mechanism
PROGRESS_BAR.START/END  soft-nav:progress-bar:start / :end
```

Plus `soft-nav:payload` (React route payload) and a mirrored `soft-nav:external:{initial,start,success,error,render}`
family that external code can dispatch to drive the same state machine [S1].

Dispatch logic as read from `app-runtime-*.js` [observed, S1; event names are facts, sequencing is
my reading of minified code]:

- start: dispatches `soft-nav:progress-bar:start`, then `soft-nav:start` (an `Event` subclass carrying a
  `mechanism` field; mechanisms seen: `react`, `turbo`, `turbo.frame`, `turbo.error`, `ui`, `hard`).
- success: dispatches `soft-nav:success` (with a `visitCount`), then immediately `soft-nav:progress-bar:end`
  and `soft-nav:end`.
- error: `soft-nav:error`, then progress-bar end.
- render: `soft-nav:render`.
- `soft-nav:react-done` is a `CustomEvent` dispatched by the React core after a React route has
  committed (detail `{error}`) [react-core, S1]. GitHub's own code waits on it with a 5 s timeout.
- `soft-nav:payload` is dispatched by React core with the new route's `payload`/`appPayload`; it is
  also re-dispatched in response to `soft-nav:initial` [react-core, S1].

How refined-github uses them [observed, S3]:

- Re-runs features after a page update with `oneEvent(document, ['turbo:render', 'soft-nav:react-done'])`.
- Treats `soft-nav:payload` as the "React page"-specific navigation signal and aborts per-page work
  when the next one fires (`on-react-page-update.tsx`).
- Detects unload with `turbo:before-fetch-request` (clicks) and `turbo:visit` (back/forward), noting
  two events are needed "to catch both clicks and history navigation".
- Marks "not initial load" on the first `soft-nav:start` or legacy `pjax:start`.
- Uses the Navigation API (`navigation.addEventListener('navigate' | 'navigatesuccess')`) to track
  the current URL.
- Uses a CSS-animation selector observer (an `animationstart` trick on a `@keyframes` rule) to react to
  elements appearing, instead of relying solely on events.

## 3. Turbo events (claimed, upstream docs)

[claimed, S4] Drive visit order: `turbo:click` -> `turbo:before-visit` -> `turbo:visit` ->
`turbo:before-fetch-request` -> `turbo:before-render` -> `turbo:render` -> `turbo:load`, all on
`<html>` (bubbling to `document`) except fetch/frame events, which fire on the frame or form.
History restorations skip `turbo:before-visit`; `turbo:visit` has `action: "restore"`; a cached
location renders twice (preview then fresh). Community reports say `turbo:load` does not always fire
[S8]. Turbo events only cover Turbo visits; **an in-app React route change between two code-view pages
does not go through Turbo** [inference from S1/S2; consistent with refined-github listening to both
families, S3].

## 4. Legacy events

- [observed] `pjax:*` names no longer appear in the bundles fetched [S1]; refined-github still listens
  for `pjax:start` and types `pjax:error` for compatibility [S3]. Treat PJAX as dead.
- `popstate`: fires on back/forward for both routers but not on push navigations, so it is a supplement
  at most [inference].

## 5. Isolated-world caveat

[claimed, S6][S7] Content scripts share the DOM but not JS objects with the page. DOM events
dispatched on `document` by page code are delivered to content-script listeners, so event **names and
timing** are usable. Fields that GitHub attaches as JS properties on its `Event` subclasses
(`mechanism`, `visitCount`, `payload`) or a `CustomEvent.detail` object created in the page world are
**not reliably readable** from the isolated world [inference from isolated-world/Xray semantics; not
tested]. Design so only the event name is needed, and read state from the DOM or by fetching JSON.

## 6. Recommendation for GH-ListRollup

[inference, built from S1-S3, S5]

- Content script on `https://github.com/*` (not only repo URLs), `run_at: document_idle`, because
  users arrive at code view by soft navigation from issues, PRs, profiles, etc.
- A single `scheduleApply()` (debounced to the next animation frame) triggered by:
  1. initial run;
  2. `soft-nav:end` and `soft-nav:react-done` (primary signals for both mechanisms);
  3. `turbo:render` and `turbo:load` (Turbo-only paths, belt and braces);
  4. `navigation` `navigatesuccess` where `window.navigation` exists (Baseline since Jan 2026 per [S5]),
     else `popstate`;
  5. a scoped `MutationObserver` on `react-app[app-name="code-view"]` (or `document.body` until it
     appears) watching for `[data-testid="directory-content"]` being added or replaced. This is the
     only signal that also catches React re-rendering the table in place (deferred commit info,
     ref switch, filter) without any navigation event.
- `apply()` must be idempotent: check URL shape (root or `/tree/`), find the listing, skip if already
  processed (marker attribute on the container), otherwise decorate. Keep per-page state keyed by
  `location.pathname` and drop it on navigation.
- Do not rely on any single event name; the `soft-nav:*` set is an internal, undocumented API that
  changed at least once (PJAX -> Turbo -> soft-nav) and could be renamed in any deploy.

## Open questions / risks

1. Event sequencing above is read from minified production code, not documentation; confirm in a
   live browser by logging all `soft-nav:*`, `turbo:*` and `navigate*` events while clicking root ->
   folder -> subfolder -> back -> other repo -> issues -> back.
2. Whether `soft-nav:react-done` fires on the very first (SSR + hydration) load was not confirmed;
   assume not and always run once at startup.
3. Firefox: verify the Navigation API is present in the target minimum Firefox version and that page
   `Event` subclasses are delivered unchanged to content-script listeners.
4. React may replace the entire table subtree on route change while keeping the container; the
   MutationObserver must watch subtree replacement, not just the first insertion.
5. Bundle file names in [S1] are content-hashed; re-derive them from a fresh page when re-checking.
