import type { NextConfig } from "next";

const TEACHER_ORIGIN = process.env.TEACHER_APP_ORIGIN ?? "http://localhost:3001";

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
  async headers() {
    // 교사 앱(별도 포트/도메인)이 /api/events 등을 교차 요청할 수 있도록 허용.
    // 운영에서는 TEACHER_APP_ORIGIN을 https://teacher.cvibe.app 등으로 지정.
    return [
      {
        source: "/api/events",
        headers: [
          { key: "Access-Control-Allow-Origin", value: TEACHER_ORIGIN },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
      {
        source: "/api/interventions",
        headers: [
          { key: "Access-Control-Allow-Origin", value: TEACHER_ORIGIN },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PATCH, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default config;
