import js from '@eslint/js';
import globals from 'globals';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: {
      'simple-import-sort': simpleImportSort
    },
    languageOptions: {
      globals: globals.browser
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [['^\\u0000'], ['^@', '^\\w'], ['^\\.']]
        }
      ],
      'simple-import-sort/exports': 'error'
    }
  }
]);
