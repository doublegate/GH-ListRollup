import { defineConfig } from 'wxt';

// Manifest shape is specified in docs/cross-browser.md section 2. Keep the two in sync.
export default defineConfig({
  srcDir: 'src',
  targetBrowsers: ['chrome', 'firefox'],
  // WXT builds Firefox as MV2 unless told otherwise (ref-docs/wxt-framework.md).
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'GH ListRollup',
    // Describes what ships today; the store listings show this text, and listing a feature that is not
    // there yet (the inline folder tree, Phase 2) breaks both stores' policies.
    description:
      "Collapse GitHub's repository file listing to its latest-commit line, with a chevron to show it again.",
    homepage_url: 'https://github.com/doublegate/GH-ListRollup',
    host_permissions: ['https://github.com/*'],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'gh-listrollup@lparobek.dev',
              // 142: first version where both desktop and Android honour
              // data_collection_permissions (web-ext lint enforces this).
              strict_min_version: '142.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : { minimum_chrome_version: '121' }),
  }),
  webExt: {
    startUrls: ['https://github.com/wxt-dev/wxt'],
  },
  zip: {
    // WXT does not read .gitignore for sources.zip (only dotfiles are excluded by default), so every
    // other gitignored pattern is listed here; tests/unit/zip-config.test.ts keeps the two in sync.
    // Release packages are also built from a clean worktree of the tag (docs/release.md section 6).
    excludeSources: [
      'web-ext-artifacts/**',
      '**/stats.html',
      '**/stats-*.json',
      '**/*.zip',
      '**/*.xpi',
      '**/*.crx',
      '**/*.pem',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      'playwright/.cache/**',
      '**/*.log',
      '**/npm-debug.log*',
      '**/pnpm-debug.log*',
      '**/CLAUDE.local.md',
      '**/Thumbs.db',
      '**/*.swp',
      '**/*~',
      '**/agy-*.log',
      'ref-docs/raw/**',
      'release-builds/**',
      'test-builds/**',
    ],
  },
});
