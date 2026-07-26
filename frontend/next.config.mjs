const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9420';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  turbopack: {
    root: "C:\\0-BlackBoxProject-0\\vivim-final\\frontend",
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
