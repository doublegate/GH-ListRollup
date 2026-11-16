import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Rules that enforce docs/security-privacy.md section 2: no HTML from strings, no eval.
const noHtmlSinks = [
  { object: 'document', property: 'write', message: 'Build nodes with createElement.' },
  ...['innerHTML', 'outerHTML'].map((property) => ({
    property,
    message: 'Repository-controlled strings must never become HTML. Use textContent.',
  })),
  { property: 'insertAdjacentHTML', message: 'Use insertAdjacentElement with built nodes.' },
  // DOMParser and Range parse strings as HTML too (docs/security-privacy.md section 2; enforcement
  // was missing until the bootstrap review, #8). Dev tooling and tests may parse captured pages.
  ...['parseFromString', 'createContextualFragment'].map((property) => ({
    property,
    message: 'Repository-controlled strings must never be parsed as HTML. Build nodes instead.',
  })),
];

export default tseslint.config(
  {
    ignores: [
      '.output/',
      '.wxt/',
      'coverage/',
      'node_modules/',
      // Local raw research captures (gitignored), including GitHub's own JS bundles.
      'ref-docs/raw/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'no-restricted-properties': ['error', ...noHtmlSinks],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': ['error', { allow: ['debug', 'info', 'warn', 'error'] }],
    },
  },
  {
    // Dev tooling (fixture capture) runs in Node, not in the extension.
    files: ['scripts/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Dev tooling and tests parse captured GitHub pages on purpose; the extension (src/) never may.
    files: ['scripts/**/*.ts', 'tests/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...noHtmlSinks.filter(
          (r) => r.property !== 'parseFromString' && r.property !== 'createContextualFragment',
        ),
      ],
    },
  },
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Standalone Playwright scripts, run outside the project's dependencies (see their README):
    // basic and security rules apply, type-aware rules cannot (agy review, #2).
    files: ['tests/e2e/manual/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      parserOptions: { projectService: false, program: null, project: false },
      globals: { ...globals.node, ...globals.browser, chrome: 'readonly' },
    },
    rules: { ...tseslint.configs.disableTypeChecked.rules, 'no-console': 'off' },
  },
);
