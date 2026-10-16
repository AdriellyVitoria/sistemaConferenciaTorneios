import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const apiUrl = process.env.API_URL ?? 'http://localhost:3000';
const proxy = {
  '/api': { target: apiUrl, changeOrigin: true, rewrite: (caminho: string) => caminho.replace(/^\/api/, '') },
};

export default defineConfig({
  plugins: [vue()],
  server: { port: 5173, proxy },
  preview: { port: 5173, proxy },
});
