import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function pwaPlugin() {
  return VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon-192.png', 'icon-512.png'],
    manifest: {
      name: 'E-Messenger',
      short_name: 'E-Messenger',
      description: '회사 메신저',
      theme_color: '#fee500',
      background_color: '#f2f3f5',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/index.html',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
    },
  });
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'mobile' ? [react(), pwaPlugin()] : [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: mode === 'mobile' ? '../mobile/www' : '../server/public',
    emptyOutDir: true,
  },
}));
