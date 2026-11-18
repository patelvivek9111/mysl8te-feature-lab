import { defineConfig } from 'vitest/config';

// extract.test.ts, product.test.ts, and auth.test.ts use node:test against PostgreSQL; run them with `npm run test:integration`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/extract.test.ts', 'src/product.test.ts', 'src/auth.test.ts', 'node_modules/**'],
  },
});
