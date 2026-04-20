import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e/ 하위는 Playwright 전용 — vitest 수집에서 제외
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "e2e/**"],
  },
});
