import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['index.js', 'test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        fetch: 'readonly',
        URLSearchParams: 'readonly'
      }
    },
    rules: {
      complexity: ['error', 15],
      eqeqeq: 'error'
    }
  }
];