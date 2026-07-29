import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    outDir: mode === 'demo' ? 'dist-demo' : 'dist',
    sourcemap: mode === 'staging',
    rollupOptions: {
      input:
        mode === 'demo'
          ? {
              index: resolve(__dirname, 'demo.html'),
            }
          : {
              index: resolve(__dirname, 'index.html'),
            },
    },
  },
}))
