import { defineConfig } from 'vitest/config';

process.env.ADMIN_SENHA = 'senha-dos-testes';

export default defineConfig({
  test: {
    include: ['test/integracao/**/*.test.ts'],
    globalSetup: ['test/integracao/preparar-banco.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
