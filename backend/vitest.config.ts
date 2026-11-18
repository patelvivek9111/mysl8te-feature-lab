import { defineConfig } from 'vitest/config';

// extract.test.ts and product.test.ts use node:test against PostgreSQL; run them with `npm run test:integration`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/extract.test.ts', 'src/product.test.ts', 'node_modules/**'],
  },
});
