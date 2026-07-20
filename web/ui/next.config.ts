import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Frontend-only — all API calls go to http://localhost:9420 */
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
};

export default nextConfig;
