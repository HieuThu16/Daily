import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

/*
 * Trước đây dự án không có ESLint. Đó là lý do gốc khiến 189 khai báo chết tích lại
 * và vòng lặp phụ thuộc trong useCoupleLocation sống được lâu như vậy —
 * `react-hooks/exhaustive-deps` bắt được cả hai loại.
 *
 * Đặt exhaustive-deps ở mức 'warn' để không chặn build ngay: còn tồn đọng thì dọn dần.
 */
export default tseslint.config(
  {
    ignores: [
      'dist', 'node_modules', 'src/data', 'public/data', 'scheduler', 'tools',
      // Worktree tạm của Claude Code có cả thư mục dist đã build — không phải mã nguồn.
      '.claude', '**/dist/**',
      // Script cào chạy bằng node, không theo chuẩn của app.
      'crawl_*.js', 'crawl_*.mjs', 'crawl_*.cjs', '*.cjs', 'split_*.mjs',
      'import_*.mjs', 'test_*.mjs', 'test_*.js', 'scrape*.js', 'check_hot.js',
      'migrate_*.mjs', 'fix_*.mjs', 'audit_*.mjs', 'backfill_*.mjs', 'scratch_*.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
      // tsc đã bật noUnusedLocals/noUnusedParameters nên khỏi báo trùng.
      '@typescript-eslint/no-unused-vars': 'off',
      // Còn nhiều `any` trong tầng cào dữ liệu; siết dần chứ chưa chặn build.
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['api/**/*.ts', 'vite.config.ts', 'supabase/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // Service worker chạy trong ngữ cảnh riêng, có `self`, `clients`, `caches`.
    files: ['public/*.js'],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.browser } },
  },
  {
    /*
     * Các luật mới của react-hooks v6 (set-state-in-effect, immutability, purity…)
     * bắt đúng thật nhưng đang tồn đọng ~100 chỗ. Để 'warn' cho build còn chạy;
     * dọn dần rồi nâng lên 'error'. Riêng exhaustive-deps là luật đã bắt được
     * vòng lặp trong useCoupleLocation nên giữ lại ở mức cảnh báo rõ ràng.
     */
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
)
