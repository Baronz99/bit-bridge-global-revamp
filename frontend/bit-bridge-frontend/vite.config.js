import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    sourcemap: mode === 'staging',
    rollupOptions: {
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
            id.includes('antd') ||
            id.includes('@ant-design') ||
            id.includes('antd-style')
          ) {
            return 'antd'
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
