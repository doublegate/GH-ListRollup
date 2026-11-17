import { defineConfig } from 'wxt';

// Manifest shape is specified in docs/cross-browser.md section 2. Keep the two in sync.
export default defineConfig({
  srcDir: 'src',
  targetBrowsers: ['chrome', 'firefox'],
  // WXT builds Firefox as MV2 unless told otherwise (ref-docs/wxt-framework.md).
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'GH ListRollup',
    description:
      "Collapse GitHub's repository file listing to one line and expand folders inline as a nested tree.",
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
    excludeSources: [
      'release-builds/**',
      'test-builds/**',
      'coverage/**',
      'ref-docs/raw/**',
      'assets/agy-assets.log',
    ],
  },
});
