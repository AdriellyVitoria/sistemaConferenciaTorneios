import { defineConfig } from 'vitest/config';

// A API não sobe sem senha (R3), e o módulo config lê o ambiente ao ser importado.
// A mesma senha de test/ajudantes/senha.ts.
process.env.ADMIN_SENHA = 'senha-dos-testes';

// `npm test`: só os testes que não precisam de banco (domínio e rotas com dependências falsas).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/integracao/**', 'node_modules/**'],
  },
});
