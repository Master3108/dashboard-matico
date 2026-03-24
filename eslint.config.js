import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {
    ignores: [
      'dist',
      'node_modules',
      'server/node_modules',
      '.tmp-playwright',
      'tmpplaywright',
      'temp_old_app.jsx',
      'temp_old_app_utf8.jsx',
      'src/App.jsx.backup',
      'server/uploads',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: ['server/**/*.js', 'vite.config.js', 'postcss.config.js', 'tailwind.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['src/components/ui/badge.jsx', 'src/components/ui/button.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
];
