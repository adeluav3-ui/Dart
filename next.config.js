/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  customWorkerDir: 'worker',
  // Exclude internal Next.js manifests — they 404 on stale builds and
  // cause Workbox precache failure, which prevents the SW from activating.
  exclude: [
    /\/_next\/.*\.json$/,
    /_buildManifest\.js$/,
    /_ssgManifest\.js$/,
  ],
})

const nextConfig = {
  outputFileTracingIncludes: {
    '/terms': ['./content/**/*'],
    '/privacy': ['./content/**/*'],
    '/refunds': ['./content/**/*'],
    '/legal/terms': ['./content/**/*'],
    '/legal/privacy': ['./content/**/*'],
    '/legal/vendor-agreement': ['./content/**/*'],
    '/legal/rider-agreement': ['./content/**/*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = withPWA(nextConfig)
