import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9420';

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        // Proxy unmatched /api/* routes to the Bun backend.
        // Next.js filesystem routes (63 existing) take priority —
        // only backend-only routes (capabilities, conversations,
        // providers, health, session, nlcl, etc.) are proxied.
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
