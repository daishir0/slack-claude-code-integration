const js = require('@eslint/js');
const prettier = require('eslint-plugin-prettier');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'writable',
        require: 'readonly',
        global: 'readonly',
        URL: 'readonly'
      }
    },
    plugins: {
      prettier
    },
    rules: {
      'prettier/prettier': 'error',
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'no-param-reassign': 'error',
      'no-shadow': 'error',
      'no-use-before-define': ['error', { functions: false }],
      'consistent-return': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'brace-style': ['error', '1tbs'],
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'comma-dangle': ['error', 'never'],
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }]
    }
  },
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**']
  }
];
