import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(import.meta.dirname, 'src'),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true
  },

  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5011',
      '/ws': {
        target: 'ws://localhost:5011',
        ws: true
      }
    }
  }
});
