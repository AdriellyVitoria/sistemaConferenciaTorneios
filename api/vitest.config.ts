import { defineConfig } from 'vitest/config';

// `npm test`: só os testes que não precisam de banco (domínio e rotas com dependências falsas).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/integracao/**', 'node_modules/**'],
  },
});
