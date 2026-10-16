import { defineConfig } from 'vitest/config';

process.env.ADMIN_SENHA = 'senha-dos-testes';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/integracao/**', 'node_modules/**'],
  },
});
