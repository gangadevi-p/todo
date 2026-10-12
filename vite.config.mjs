import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Injects a strict Content-Security-Policy into production builds only
// (the dev server needs inline scripts for hot reload). The one network host
// the page may talk to is api.anthropic.com, for "Read with AI".
const csp = {
  name: 'nudge-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self' https://api.anthropic.com" />`,
    ),
};

export default defineConfig({
  base: './',
  plugins: [react(), csp],
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
