import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'happy-dom',
    environmentOptions: { happyDOM: { url: 'http://localhost:5173' } },
  },
});
