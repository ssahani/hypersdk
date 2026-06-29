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
    // three.js ships as one large module (~720 kB / ~185 kB gzip) that can't be
    // meaningfully split; raise the advisory limit so the legitimately-large,
    // lazily-loaded vendor chunks don't emit a spurious warning.
    chunkSizeWarningLimit: 1000,
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
