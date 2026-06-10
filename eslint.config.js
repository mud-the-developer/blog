import js from '@eslint/js';
import globals from 'globals';

const commonRules = {
  'no-implicit-globals': 'error',
  'no-restricted-globals': [
    'error',
    { name: 'event', message: 'Use an explicit event parameter instead of the browser global.' },
    { name: 'name', message: 'Use an explicit local variable instead of the browser global.' },
  ],
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
};

export default [
  {
    ignores: ['dist/**', 'dist-test/**', 'target/**', 'node_modules/**', 'fuzz/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: commonRules,
  },
  {
    files: ['functions/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
    rules: commonRules,
  },
  {
    files: ['scripts/**/*.mjs', 'tests/functions/**/*.mjs', 'playwright.config.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: commonRules,
  },
  {
    files: ['tests/browser/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: commonRules,
  },
];
