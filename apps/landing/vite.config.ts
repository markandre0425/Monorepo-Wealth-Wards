import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  envDir: '../../',
  plugins: [react()],
  base: '/', 
  server: {
    port: 3000,
    proxy: {
      '/api/': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})