import { defineConfig } from 'vite';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [compression()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    sourcemap: false, // Disable source maps in production for security
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          'socket.io': ['socket.io-client'],
          vendor: ['msgpack-lite']
        }
      }
    }
  }
}); 