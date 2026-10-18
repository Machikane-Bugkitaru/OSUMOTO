import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  { ignores: ['dist/**', 'node_modules/**', '.vercel/**'] },
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // 型の意図は明示的な定義で表すというプロジェクト方針に合わせる。
      '@typescript-eslint/prefer-as-const': 'off',
    },
  },
  {
    files: ['test/**/*.cjs', '*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  prettier,
]);
