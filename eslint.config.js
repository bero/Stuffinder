import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', 'scripts/**', '*.config.js', '*.config.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // Tailor a11y rules to Preact's `class` (instead of React's `className`)
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either' }],
      // tsc already enforces these via noUnusedLocals/Parameters
      '@typescript-eslint/no-unused-vars': 'off',
      // The codebase uses HTMLInputElement casts deliberately
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
