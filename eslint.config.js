import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'out', 'release']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // shadcn's parts are reached only through the App* wrappers in components/.
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    ignores: ['src/renderer/src/components/ui/**', 'src/renderer/src/components/App*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)components/ui/',
              message:
                'Use the App* wrapper from @/components (AppButton, AppMenu, AppInput, …), or add one.',
            },
          ],
        },
      ],
    },
  },
  {
    // shadcn-managed primitives export their variant helpers next to the component
    // (e.g. toggleVariants for toggle-group). They are not hand-edited, so accept that.
    files: ['src/renderer/src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Main process, preload, scripts, and build configs run in Node, not the browser.
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'scripts/**/*.ts', '*.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
]);
