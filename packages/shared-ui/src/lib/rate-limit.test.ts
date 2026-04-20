import { beforeEach, describe, expect, it } from "vitest";

import { _resetRateLimitForTests, checkRateLimit } from "./rate-limit";

const CFG = { name: "test", capacity: 3, refillPerSec: 1 };

describe("checkRateLimit", () => {
  beforeEach(() => _resetRateLimitForTests());

  it("첫 요청은 허용, 토큰 감소", () => {
    const r1 = checkRateLimit(CFG, "user-1", 1000);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it("용량 초과 요청은 거부", () => {
    for (let i = 0; i < 3; i++) checkRateLimit(CFG, "user-1", 1000);
    const r = checkRateLimit(CFG, "user-1", 1000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it("시간 경과 후 토큰 보충", () => {
    for (let i = 0; i < 3; i++) checkRateLimit(CFG, "user-1", 1000);
    const later = checkRateLimit(CFG, "user-1", 1000 + 2000); // 2초 후 → +2 토큰
    expect(later.allowed).toBe(true);
  });

  it("다른 key는 독립 버킷", () => {
    for (let i = 0; i < 3; i++) checkRateLimit(CFG, "user-1", 1000);
    const other = checkRateLimit(CFG, "user-2", 1000);
    expect(other.allowed).toBe(true);
  });
});
