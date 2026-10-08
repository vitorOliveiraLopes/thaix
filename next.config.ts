/** @type {import('next').NextConfig} */
const nextConfig = {
  // @thaix/core é publicado como TypeScript; o Next transpila na build.
  transpilePackages: ['@thaix/core'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avqkvhkfilrnbytrjbit.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig