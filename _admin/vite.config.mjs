import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: '/_admin/',
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      events: fileURLToPath(new URL('./src/polyfills/events.js', import.meta.url)),
      util: fileURLToPath(new URL('./src/polyfills/util.js', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['events', 'util'],
  },
  build: {
    outDir: '../build/assets/_admin',
    emptyOutDir: true,
    // Off by default so release artifacts don't ship source maps; opt in for
    // debugging a production build with BUILD_SOURCEMAP=true.
    sourcemap: process.env.BUILD_SOURCEMAP === 'true',
    rollupOptions: {
      output: {
        entryFileNames: 'bundle.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    proxy: {
      '/_data': 'http://localhost:4300',
      '/_auth': 'http://localhost:4300',
      '/_status': 'http://localhost:4300',
      '/_ping': 'http://localhost:4300',
    },
  },
});
