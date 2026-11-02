import { defineConfig } from 'vite';

// Relative base so the same build works at https://kumaran2712.github.io/Rekla-race/ and in previews.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    // three.js alone is ~650 kB minified; the game bundle is one file by design until assets stream (M2+)
    chunkSizeWarningLimit: 900,
  },
});
