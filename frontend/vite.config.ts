import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const backendUrl = process.env['VITE_BACKEND_URL'] ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'woodpecker',
      project: 'woodpecker-frontend',
    }),
  ],
  build: {
    sourcemap: true,
  },
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
