import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: process.env.GITHUB_ACTIONS ? '/qingshi-jianghu/' : '/',
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'next/navigation': fileURLToPath(new URL('./desktop/next-navigation-shim.ts', import.meta.url)),
    },
  },
  plugins: [react(), {
    name: 'desktop-entry',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url === '/' || request.url?.startsWith('/?')) request.url = request.url.replace('/', '/index.desktop.html');
        next();
      });
    },
  }],
  server: { port: 1420, strictPort: true },
  build: { outDir: 'dist-desktop', emptyOutDir: true, rolldownOptions: { input: fileURLToPath(new URL('./index.desktop.html', import.meta.url)) } },
});
