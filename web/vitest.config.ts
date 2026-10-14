import { defineConfig } from 'vitest/config';

// `npm test -w web`: as regras puras da tela (formato do prêmio, percentuais, rótulos).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
