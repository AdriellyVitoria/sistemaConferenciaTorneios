import { defineConfig } from 'vitest/config';

// `npm run test:integracao`: testes que rodam contra o MySQL do Docker (docker compose up -d mysql).
export default defineConfig({
  test: {
    include: ['test/integracao/**/*.test.ts'],
    // recria o banco torneios_teste do zero e aplica as migrations antes de tudo
    globalSetup: ['test/integracao/preparar-banco.ts'],
    // os arquivos compartilham o mesmo banco: um de cada vez
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
