import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'next/navigation': fileURLToPath(new URL('./desktop/next-navigation-shim.ts', import.meta.url)),
    },
  },
  plugins: [react()],
  server: { port: 1420, strictPort: true },
  build: { outDir: 'dist-desktop', emptyOutDir: true, rolldownOptions: { input: fileURLToPath(new URL('./index.desktop.html', import.meta.url)) } },
});
