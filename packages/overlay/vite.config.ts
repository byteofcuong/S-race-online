import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:8787', ws: true },
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019',
    // bundle vào thư mục riêng để không lẫn với public/assets (manifest, ảnh người dùng)
    assetsDir: 'bundle',
    // giữ SVG icon là file riêng (Pixi nhận diện qua đuôi .svg)
    assetsInlineLimit: 0,
  },
});
