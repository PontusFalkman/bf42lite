import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Boilerplate to get __dirname in ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  resolve: {
    // FIX: Force Vite to use the source TS files instead of the CJS dist files
    alias: {
      '@bf42lite/sim': resolve(__dirname, '../../packages/sim/src/index.ts'),
      '@bf42lite/games-bf42': resolve(__dirname, '../../packages/games/bf42/src/index.ts'),
      '@bf42lite/net': resolve(__dirname, '../../packages/net/src/index.ts'),
      '@bf42lite/protocol': resolve(__dirname, '../../packages/protocol/src/index.ts'),
    },
  },
  build: {
    target: 'esnext',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});