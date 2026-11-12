/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  customWorkerDir: 'worker',
  // Exclude internal Next.js manifests — they 404 on old builds and
  // cause Workbox precache failure, which prevents the SW from activating
  // (and therefore blocks pushManager.subscribe()).
  // Exclude all internal Next.js manifests — they 404 on any build except
  // the one that generated them, causing Workbox precache failure.
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
