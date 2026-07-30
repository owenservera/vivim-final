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
};

export default nextConfig;
