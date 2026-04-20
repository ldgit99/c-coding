/**
 * 간단한 IP 기반 토큰 버킷 — in-memory.
 *
 * 운영에서는 Upstash Ratelimit 또는 Vercel KV로 교체. 이 구현은 단일 서버
 * 인스턴스 내에서만 동작하며, 서버리스 cold start 시 초기화된다.
 * /api/chat처럼 비용이 드는 엔드포인트의 **개발·파일럿** 과금 폭주를 막는
 * 안전장치 수준.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export interface RateLimitConfig {
  /** 네임스페이스 — 여러 엔드포인트가 독립 버킷을 가지도록 구분 */
  name: string;
  capacity: number;
  refillPerSec: number;
}

const store = new Map<string, Bucket>();

function bucketKey(config: RateLimitConfig, key: string): string {
  return `${config.name}::${key}`;
}

export function checkRateLimit(
  config: RateLimitConfig,
  key: string,
  now: number = Date.now(),
): RateLimitResult {
  const k = bucketKey(config, key);
  const prev = store.get(k) ?? { tokens: config.capacity, lastRefillMs: now };
  const elapsedMs = Math.max(0, now - prev.lastRefillMs);
  const refilled = Math.min(config.capacity, prev.tokens + (elapsedMs / 1000) * config.refillPerSec);

  if (refilled >= 1) {
    const next: Bucket = { tokens: refilled - 1, lastRefillMs: now };
    store.set(k, next);
    return { allowed: true, remaining: Math.floor(next.tokens), retryAfterMs: 0 };
  }

  const tokensNeeded = 1 - refilled;
  const retryAfterMs = (tokensNeeded / config.refillPerSec) * 1000;
  store.set(k, { tokens: refilled, lastRefillMs: now });
  return { allowed: false, remaining: 0, retryAfterMs: Math.ceil(retryAfterMs) };
}

export function _resetRateLimitForTests(): void {
  store.clear();
}
