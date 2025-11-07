import { defineConfig } from "vite";
export default defineConfig({
  root: "./",
  server: { port: 5173 },
  // FIX: Mark @tauri-apps/api/tauri as external so Rollup doesn't try to bundle it.
  build: { 
    outDir: "dist",
    rollupOptions: {
      external: ["@tauri-apps/api/tauri"]
    }
  },
});