import type { XApiStatementT } from "./index";

/**
 * 프로세스 내 이벤트 링 버퍼.
 *
 * Vercel Edge·Node 런타임에서 서버 인스턴스 하나의 수명 동안 이벤트를 누적한다.
 * 실제 프로덕션에서는 여기서 Supabase `events` 테이블로 flush하거나 LRS로
 * POST하는 `flushBatch(stmts)` 구현을 주입한다.
 *
 * Week 12 MVP: 서버리스 환경에서 인스턴스가 자주 cold start 되므로 이벤트
 * 유실 가능성은 있다. 교사 대시보드의 "Live Events" 패널은 참고용.
 */

const MAX_BUFFER = 500;

interface StoreState {
  buffer: XApiStatementT[];
  byStudent: Map<string, XApiStatementT[]>;
}

const globalKey = "__cvibe_xapi_store__" as const;

function getStore(): StoreState {
  // globalThis에 싱글톤을 붙여 Next.js HMR · 여러 route 모듈 간 공유.
  const g = globalThis as unknown as Record<string, StoreState>;
  if (!g[globalKey]) {
    g[globalKey] = { buffer: [], byStudent: new Map() };
  }
  return g[globalKey]!;
}

export function recordEvent(stmt: XApiStatementT): void {
  const s = getStore();
  s.buffer.push(stmt);
  if (s.buffer.length > MAX_BUFFER) s.buffer.shift();

  const actor = stmt.actor.account.name;
  if (!actor) return;
  const bucket = s.byStudent.get(actor) ?? [];
  bucket.push(stmt);
  if (bucket.length > MAX_BUFFER) bucket.shift();
  s.byStudent.set(actor, bucket);
}

export function recordEvents(stmts: XApiStatementT[]): void {
  for (const s of stmts) recordEvent(s);
}

export function listRecentEvents(limit = 50): XApiStatementT[] {
  const s = getStore();
  return s.buffer.slice(-limit).reverse();
}

export function listStudentEvents(actorName: string, limit = 50): XApiStatementT[] {
  const s = getStore();
  const bucket = s.byStudent.get(actorName) ?? [];
  return bucket.slice(-limit).reverse();
}

export function clearEvents(): void {
  const s = getStore();
  s.buffer.length = 0;
  s.byStudent.clear();
}
