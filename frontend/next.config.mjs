/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
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
