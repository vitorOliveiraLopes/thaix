import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Testes de todo o monorepo (menos o app Expo, que tem os próprios checks).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts', 'apps/api/src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './apps/api/src') },
  },
})
