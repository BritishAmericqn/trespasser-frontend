import { defineConfig } from 'vite';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [compression()],
  server: {
    port: 5173,
    host: true
  }
}); 