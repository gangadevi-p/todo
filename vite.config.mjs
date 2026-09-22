import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Injects a strict Content-Security-Policy into production builds only
// (the dev server needs inline scripts for hot reload).
const csp = {
  name: 'nudge-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:" />`,
    ),
};

export default defineConfig({
  base: './',
  plugins: [react(), csp],
  server: { port: 5183, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
