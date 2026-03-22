import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendUrl = process.env['VITE_BACKEND_URL'] ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
