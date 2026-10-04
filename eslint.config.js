import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

/** Class strings the renderer refuses, each with where to look instead. */
const STYLE_RULES = [
  {
    pattern: /(^|[\s:'"`])text-\[/,
    message: 'Use a type role (<Text variant>, text-body, text-meta, …), not an arbitrary size.',
  },
  {
    pattern: /(^|[\s:'"`])text-(xs|sm|base|lg|[2-9]?xl)\b/,
    message: 'Use a type role (<Text variant>, text-body, text-meta, …), not a Tailwind size.',
  },
  {
    pattern: /(^|[\s:'"`])font-(thin|extralight|light|normal|medium|semibold|bold|extrabold)\b/,
    message: 'Use a weight token: font-regular, font-control, font-strong or font-tag.',
  },
  {
    pattern:
      /-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
    message:
      'Use a colour token from index.css (ink-*, line-*, amber, add, del, …), not a palette shade.',
  },
  {
    pattern: /(^|[\s:'"`])[a-z-]+-(white|black)\b/,
    message: 'Use a colour token from index.css (background, foreground, …), not white or black.',
  },
  {
    pattern: /\[[^\]]*(oklch\(|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b)/,
    message: 'Use a colour token from index.css, or add one for both themes, not a literal colour.',
  },
  {
    pattern: /(^|[\s:'"`])shadow-(sm|md|lg|xl|2xl)\b/,
    message: 'Use a shadow token: shadow-overlay, shadow-lifted or shadow-floating.',
  },
];

/** Allowed only in components/: feature code uses the role or the shared look that has it. */
const SHARED_LOOK_RULES = [
  {
    pattern: /(^|[\s:'"`])(tracking|leading)-\[/,
    message:
      'Use the role’s own tracking and line height, or a shared look in components/ (Badge, an AppButton size), not an arbitrary value.',
  },
];

/** One `no-restricted-syntax` entry per rule, for plain strings and template literals. */
function restrictClassStrings(rules) {
  return rules.flatMap(({ pattern, message }) => [
    { selector: `Literal[value=${pattern}]`, message },
    { selector: `TemplateElement[value.raw=${pattern}]`, message },
  ]);
}

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
    // Interface type and colour come from the roles and tokens in index.css. The resume page
    // (Arial, exact points, black on white in both themes) keeps its own.
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    ignores: [
      'src/renderer/src/components/ui/**',
      'src/renderer/src/features/preview/**',
      'src/renderer/src/features/document-diff/PageMarkParts.tsx',
      'src/renderer/src/lib/resume/**',
      '**/__tests__/**',
    ],
    rules: {
      'no-restricted-syntax': ['error', ...restrictClassStrings(STYLE_RULES)],
    },
  },
  {
    // A spacing the roles don't carry is a shared look, written once in components/. This
    // block's list replaces the one above, so it repeats STYLE_RULES.
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    ignores: [
      'src/renderer/src/components/**',
      'src/renderer/src/features/preview/**',
      'src/renderer/src/features/document-diff/PageMarkParts.tsx',
      'src/renderer/src/lib/resume/**',
      '**/__tests__/**',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...restrictClassStrings([...STYLE_RULES, ...SHARED_LOOK_RULES]),
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
