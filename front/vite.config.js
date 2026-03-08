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
      }
    },
    fs: {
      allow: ['..']
    }
  }
})
