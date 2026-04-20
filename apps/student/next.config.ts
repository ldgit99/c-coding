import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@cvibe/agents",
    "@cvibe/db",
    "@cvibe/shared-ui",
    "@cvibe/wasm-runtime",
    "@cvibe/xapi",
  ],
  experimental: {
    // Monaco는 CSR만 안전 — 동적 import로만 사용
    serverActions: { allowedOrigins: ["localhost:3000"] },
  },
};

export default config;
