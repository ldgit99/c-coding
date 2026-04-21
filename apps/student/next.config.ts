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
  // /api/submit과 /api/chat이 `supabase/seed-private/*`를 런타임에 fs.readFile로
  // 읽으므로 Vercel 서버리스 번들에 반드시 포함되어야 한다. 프로덕션에서 이
  // 디렉토리를 제거할 때는 Vercel Blob fetch 로 교체 + 여기 include 제거.
  outputFileTracingIncludes: {
    "/api/submit": ["../../supabase/seed-private/**/*"],
    "/api/chat": ["../../supabase/seed-private/**/*"],
  },
  experimental: {
    // Monaco는 CSR만 안전 — 동적 import로만 사용
    serverActions: { allowedOrigins: ["localhost:3000"] },
  },
  async headers() {
    // 교사 앱(별도 포트/도메인)이 /api/events·/api/events/stream 등을 교차
    // 요청할 수 있도록 허용. 운영에서는 TEACHER_APP_ORIGIN을
    // https://teacher.cvibe.app 등으로 지정.
    return [
      {
        source: "/api/events",
        headers: [
          { key: "Access-Control-Allow-Origin", value: TEACHER_ORIGIN },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
      {
        source: "/api/events/stream",
        headers: [
          { key: "Access-Control-Allow-Origin", value: TEACHER_ORIGIN },
          { key: "Access-Control-Allow-Credentials", value: "true" },
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
      {
        source: "/api/conversations",
        headers: [
          { key: "Access-Control-Allow-Origin", value: TEACHER_ORIGIN },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
      {
        source: "/api/analytics/dump",
        headers: [
          { key: "Access-Control-Allow-Origin", value: TEACHER_ORIGIN },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
    ];
  },
};

export default config;
