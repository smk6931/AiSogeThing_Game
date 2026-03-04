import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // 상위폴더 경로 읽어오기 env
  envDir: '../',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@api': path.resolve(__dirname, './src/shared/api'),
      '@auth': path.resolve(__dirname, './src/apps/auth'),
      '@world': path.resolve(__dirname, './src/apps/world'),
      '@entities': path.resolve(__dirname, './src/apps/entities'),
      '@game-core': path.resolve(__dirname, './src/apps/game-core'),
      '@game-ui': path.resolve(__dirname, './src/apps/game-ui'),
      '@game-hooks': path.resolve(__dirname, './src/apps/game-hooks'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@apps': path.resolve(__dirname, './src/apps'),
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: ['sogething.com', 'www.sogething.com', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://localhost:8400',
        changeOrigin: true,
      }
    },
    fs: {
      allow: ['..']
    }
  }
})
