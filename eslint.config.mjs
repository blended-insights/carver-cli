import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Define reusable rule sets
const commonRules = {
  // Error prevention
  'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  'no-debugger': 'warn',
  'no-duplicate-imports': 'error',
  'no-unused-vars': 'off', // TypeScript handles this
  'no-var': 'error',
  'prefer-const': 'error',

  // Code quality
  // complexity: ['warn', 15],
  // 'max-depth': ['warn', 4],
  'max-lines': ['warn', 500],
  'max-params': ['warn', 5],

  // Style consistency
  camelcase: 'warn',
  'comma-dangle': ['error', 'always-multiline'],
  quotes: ['warn', 'single', { avoidEscape: true }],
  semi: ['error', 'always'],
};

// Get the legacy config format for TypeScript
const tsConfig = compat.config({
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  plugins: ['import', 'prettier', '@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    sourceType: 'module',
  },
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // Import order rules
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['sibling', 'parent'], 'index', 'object'],
        pathGroups: [
          {
            pattern: '@/commands/**',
            group: 'internal',
          },
          {
            pattern: '@/lib/**',
            group: 'internal',
          },
          {
            pattern: '@/utils/**',
            group: 'internal',
          },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
    ...commonRules,
  },
});

// Export the flat config
export default [
  // Ignore patterns
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/docs/**', '**/coverage/**'],
  },
  // Base JS configuration
  {
    ...js.configs.recommended,
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      ...commonRules,
    },
  },

  // JavaScript-specific rules
  {
    files: ['**/*.js', '**/*.mjs'],
    rules: {
      ...commonRules,
    },
  },

  // Configuration files - more relaxed rules
  {
    files: ['*.config.js', '*.config.mjs'],
    rules: {
      'no-console': 'off',
    },
  },

  // TypeScript configuration
  {
    files: ['**/*.ts'],
    ...tsConfig[0],
  },

  // Test files - more relaxed rules
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'max-lines': 'off',
    },
  },
];
