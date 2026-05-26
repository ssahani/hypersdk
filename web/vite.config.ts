// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Dev proxy → local daemon (HTTPS + self-signed cert from install.sh). */
const daemonTarget = 'https://localhost:5092'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'esnext',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: daemonTarget,
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: daemonTarget,
        ws: true,
        secure: false,
      },
    },
  },
})
