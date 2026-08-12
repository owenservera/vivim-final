/** @type {import('next').NextConfig} */
// Dual-mode config: dev/local server uses `output: "standalone"` (so `bun run
// start` works). Tauri packaging sets TAURI_STATIC_EXPORT=1 to produce the
// `out/` static export (prepare-frontend.ts). Env-driven, so no build script
// ever has to mutate this tracked file.
const isStaticExport = process.env.TAURI_STATIC_EXPORT === '1'

const nextConfig = {
  output: isStaticExport ? 'export' : 'standalone',
  reactStrictMode: true,
  // Session 2 (2026-08-07): enabled standalone output so `bun run start`
  // (which runs `bun .next/standalone/server.js`) actually works. Without
  // this, the start script fails with ENOENT because the standalone server
  // is never produced by `next build`.
  typescript: {
    // Enforce strict type checking during builds
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  images: {
    unoptimized: true,
  },
  // rewrites() is a standalone-server feature and errors under static export,
  // so gate it behind the same env flag as the output mode.
  ...(isStaticExport
    ? {}
    : {
        async rewrites() {
          const backend = process.env.BACKEND_URL ?? 'http://localhost:9420'
          return [
            // Proxy backend-only API routes to the backend server
            { source: '/api/conversations/:path*', destination: `${backend}/api/conversations/:path*` },
            { source: '/api/capabilities/:path*', destination: `${backend}/api/capabilities/:path*` },
            { source: '/api/providers/:path*', destination: `${backend}/api/providers/:path*` },
            { source: '/api/update/:path*', destination: `${backend}/api/update/:path*` },
            { source: '/api/interpret', destination: `${backend}/api/interpret` },
            { source: '/api/admin/:path*', destination: `${backend}/api/admin/:path*` },
            { source: '/api/session/:path*', destination: `${backend}/api/session/:path*` },
            { source: '/api/variant/:path*', destination: `${backend}/api/variant/:path*` },
            { source: '/api/canvas/save', destination: `${backend}/api/canvas/save` },
          ]
        },
      }),
};

export default nextConfig;
