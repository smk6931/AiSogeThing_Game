import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // 상위폴더 경로 읽어오기 env
  envDir: '../',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router-dom')) return 'router';
          if (id.includes('three')) return 'three-core';
          if (id.includes('react-leaflet') || id.includes('leaflet')) return 'leaflet';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('lil-gui')) return 'world-debug';
          if (id.includes('@turf/turf')) return 'geo';
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@api': path.resolve(__dirname, './src/api'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@engine': path.resolve(__dirname, './src/engine'),
      '@entity': path.resolve(__dirname, './src/entity'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@screens': path.resolve(__dirname, './src/screens'),
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3100,
    strictPort: true,
    allowedHosts: ['sogething.com', 'www.sogething.com', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://localhost:8100',
        changeOrigin: true,
        ws: true,
      }
    },
    fs: {
      allow: ['..']
    }
  }
})
