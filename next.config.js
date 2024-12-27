/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... your other config options

  async headers() {
    return [
      {
        source: '/api/init',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  },
}

// Trigger initialization when the Next.js server starts
if (typeof require !== 'undefined' && require.main === module) {
  require('./pages/api/init');
}

module.exports = nextConfig; 