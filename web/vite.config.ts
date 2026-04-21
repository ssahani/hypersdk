import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'esnext',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5092',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:5092',
        ws: true,
      },
    },
  },
})
