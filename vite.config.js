import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Ports come from the environment so two checkouts can run side by side.
  // The proxy follows the API port; the frontend only ever fetches `/api/…`.
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    open: !process.env.CI && !process.env.NO_OPEN,
    proxy: {
      // `changeOrigin` rewrites Host to the API's own, so the API cannot see
      // the address the attendee used. Pass it on — calendar exports build
      // their links from it (see baseUrlFor in server/lib/ical.js).
      '/api': {
        target: `http://localhost:${process.env.PORT ?? 3001}`,
        changeOrigin: true,
        configure: (proxy) => proxy.on('proxyReq', (proxyReq, req) => {
          if (!req.headers['x-forwarded-host']) proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
          if (!req.headers['x-forwarded-proto']) proxyReq.setHeader('X-Forwarded-Proto', req.socket.encrypted ? 'https' : 'http');
        }),
      },
    },
  },
});
