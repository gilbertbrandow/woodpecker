import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { mainFields: ['browser', 'module', 'jsnext:main', 'jsnext'] },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    deps: { optimizer: { client: { enabled: true, include: ['react-chessground'] } } },
  },
})
