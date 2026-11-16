# Contributing

Thanks for your interest in GH-ListRollup.

## Before you start

1. Read `CLAUDE.md`, which serves as the project map for humans and agents alike, and
   `to-dos/ROADMAP.md`.
2. Find or open an issue. Feature work maps to a ticket ID (`T-GNR-NNN`) in `to-dos/`.
3. Behaviour is specified in `docs/`. If a change alters behaviour, update the matching spec in the
   same PR.

## Setup

```sh
corepack enable          # uses the pnpm version pinned in package.json
pnpm install             # also runs `wxt prepare`
pnpm dev                 # Chrome, with reload
pnpm dev:firefox         # Firefox
```

Requires Node 22.18 or later; the project uses Node 26 LTS (`.nvmrc`).

## Before opening a PR

```sh
pnpm check
```

This runs `format:check`, `lint` (zero warnings), `typecheck`, `test`, `build`, `build:firefox` and
`lint:firefox`, the same gate as CI.

## Rules

- **Commits.** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`,
  `ci:`), imperative mood, subject of 72 characters or fewer. Put the ticket ID in the body.
- **Changelog.** Add an entry under `[Unreleased]` in `CHANGELOG.md` for any user-visible change.
- **Selectors.** GitHub selectors live only in `src/github/selectors.ts`
  (`docs/dom-integration.md`). Never use hashed class names.
- **HTML from strings.** Never build HTML from strings. File and folder names are
  attacker-controlled; use `createElement` and `textContent` (`docs/security-privacy.md`). ESLint
  enforces this.
- **Permissions and dependencies.** No new permissions, hosts or runtime dependencies without an ADR.
- **Versions.** Exact versions in `package.json`, with no `^` or `~`. AMO needs reproducible builds.
- **Fixtures.** Test fixtures copied from GitHub must have personal data removed
  (`docs/testing-strategy.md` §3).
- **Style.** No emojis in code, commits or docs.

## License

By contributing, you agree that your contributions are dual-licensed under MIT OR Apache-2.0, as
described in `README.md`.
