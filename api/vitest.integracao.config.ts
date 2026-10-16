import { defineConfig } from 'vitest/config';

// A API não sobe sem senha (R3), e o módulo config lê o ambiente ao ser importado, inclusive no
// preparar-banco, que roda neste processo. A mesma senha de test/ajudantes/senha.ts.
process.env.ADMIN_SENHA = 'senha-dos-testes';

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
