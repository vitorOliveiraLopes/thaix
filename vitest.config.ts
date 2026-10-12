import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Testes de regra pura: o pacote core e o código de servidor do app (src/server).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts', 'apps/mobile/src/server/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './apps/mobile/src') },
  },
})
