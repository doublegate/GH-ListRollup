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
];

export default tseslint.config(
  { ignores: ['.output/', '.wxt/', 'coverage/', 'node_modules/'] },
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
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
