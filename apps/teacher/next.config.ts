import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@cvibe/agents",
    "@cvibe/db",
    "@cvibe/shared-ui",
    "@cvibe/xapi",
  ],
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3001"] },
  },
};

export default config;
