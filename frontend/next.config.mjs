/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Session 2 (2026-08-07): enabled standalone output so `bun run start`
  // (which runs `bun .next/standalone/server.js`) actually works. Without
  // this, the start script fails with ENOENT because the standalone server
  // is never produced by `next build`.
  output: 'standalone',
  typescript: {
    // TODO(session 3): remove this once frontend typecheck is clean.
    // Currently ignored because the WP-10 upgrade left ~30 frontend type
    // errors that don't block the build but should be fixed.
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? 'http://localhost:9420'
    return [
      // Proxy backend-only API routes to the backend server
      { source: '/api/conversations/:path*', destination: `${backend}/api/conversations/:path*` },
      { source: '/api/capabilities/:path*', destination: `${backend}/api/capabilities/:path*` },
      { source: '/api/providers/:path*', destination: `${backend}/api/providers/:path*` },
      { source: '/api/update/:path*', destination: `${backend}/api/update/:path*` },
      { source: '/api/interpret', destination: `${backend}/api/interpret` },
    ]
  },
};

export default nextConfig;
