// react_frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // ブラウザ -> http://localhost:5173/api/... を
      // フロント容器内の Vite が backend サービスへ中継
      '/api': {
        target: 'http://backend:8000',   // ← ここを backend に！
        changeOrigin: true,
      },
    },
  },
})
