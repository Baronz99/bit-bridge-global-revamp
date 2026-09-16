import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const defineFlag = (name, fallback = '') => JSON.stringify(process.env[name] ?? fallback)

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    __PHONE_FIRST_SIGNUP_ENABLED__: defineFlag('VITE_ENABLE_PHONE_FIRST_SIGNUP'),
    __PHONE_FIRST_SIGNUP_LEGACY__: defineFlag('VITE_PHONE_FIRST_SIGNUP'),
  },
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
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (
            id.includes('react-router') ||
            id.includes('@remix-run')
          ) {
            return 'router'
          }

          if (
            id.includes('react-redux') ||
            id.includes('@reduxjs') ||
            id.includes('/redux/')
          ) {
            return 'redux'
          }

          if (
            id.includes('@mui/') ||
            id.includes('@emotion/') ||
            id.includes('styled-components')
          ) {
            return 'mui'
          }

          if (id.includes('framer-motion')) {
            return 'motion'
          }

          if (
            id.includes('react-toastify') ||
            id.includes('react-icons') ||
            id.includes('react-slick') ||
            id.includes('react-responsive-carousel') ||
            id.includes('react-paystack')
          ) {
            return 'ui-misc'
          }

          if (
            id.includes('axios') ||
            id.includes('dayjs')
          ) {
            return 'data-utils'
          }

          return 'vendor'
        },
      },
    },
  },
}))
