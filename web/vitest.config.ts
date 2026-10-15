import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// `npm test -w web`: as regras puras da tela (formato do prêmio, percentuais, rótulos) e, em
// test/componentes/, o comportamento das telas montadas num navegador simulado (happy-dom).
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['test/**/*.test.ts'],
  },
});
