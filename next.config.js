/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the app to be embedded and used as a PWA
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ],
    },
  ],
}

module.exports = nextConfig
