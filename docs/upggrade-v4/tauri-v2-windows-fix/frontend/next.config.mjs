/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // When building for Tauri, images must use unoptimized mode
  // since there is no Next.js image optimization server.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
