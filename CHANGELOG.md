# Changelog

All notable user-visible changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Project bootstrap:
  - research report and reference material (`ref-docs/`)
  - implementation specifications and ADRs (`docs/`)
  - the phase and sprint plan (`to-dos/`)
- WXT + TypeScript skeleton that builds MV3 packages for Chrome (121+) and Firefox (142+). The
  content script logs the detected GitHub page type on load and after soft navigation. No visible
  changes to GitHub yet.
- CI workflow running format, lint, type-check, unit tests, both builds and `web-ext lint`.
- Repository files:
  - README landing page with artwork in `assets/`
  - `SECURITY.md`, `PRIVACY.md`, `CODE_OF_CONDUCT.md`
  - issue template configuration and `CODEOWNERS`
  - Dependabot configuration, with grouped monthly updates

### Changed

- Project renamed from the working title GH-Nested-Rollup to **GH-ListRollup**. The package name,
  extension name and Firefox add-on ID (`gh-listrollup@lparobek.dev`) changed to match.
