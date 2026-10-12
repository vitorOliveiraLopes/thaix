import path from 'node:path'
import type { NextConfig } from 'next'

// Raiz do monorepo: o @thaix/core vem de packages/core (workspace).
const monorepoRoot = path.join(__dirname, '../..')

const nextConfig: NextConfig = {
  // @thaix/core é publicado como TypeScript; o Next transpila na build.
  transpilePackages: ['@thaix/core'],
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
}

export default nextConfig
