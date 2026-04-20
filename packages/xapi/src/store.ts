import type { XApiStatementT } from "./index";

/**
 * 프로세스 내 이벤트 링 버퍼 + pub-sub.
 *
 * Vercel Edge·Node 런타임에서 서버 인스턴스 하나의 수명 동안 이벤트를 누적한다.
 * SSE 스트림 라우트는 `subscribeEvents`로 신규 이벤트를 실시간 수신한다.
 * 실제 프로덕션에서는 여기서 Supabase `events` 테이블로 flush하거나 LRS로
 * POST하는 `flushBatch(stmts)` 구현을 주입한다.
 *
 * Week 12 MVP: 서버리스 환경에서 인스턴스가 자주 cold start 되므로 이벤트
 * 유실 가능성은 있다. 교사 대시보드의 "Live Events" 패널은 참고용.
 */

const MAX_BUFFER = 500;

export type EventListener = (stmt: XApiStatementT) => void;

interface StoreState {
  buffer: XApiStatementT[];
  byStudent: Map<string, XApiStatementT[]>;
  listeners: Set<EventListener>;
}

const globalKey = "__cvibe_xapi_store__" as const;

function getStore(): StoreState {
  const g = globalThis as unknown as Record<string, StoreState>;
  if (!g[globalKey]) {
    g[globalKey] = { buffer: [], byStudent: new Map(), listeners: new Set() };
  }
  return g[globalKey]!;
}

export function recordEvent(stmt: XApiStatementT): void {
  const s = getStore();
  s.buffer.push(stmt);
  if (s.buffer.length > MAX_BUFFER) s.buffer.shift();

  const actor = stmt.actor.account.name;
  if (actor) {
    const bucket = s.byStudent.get(actor) ?? [];
    bucket.push(stmt);
    if (bucket.length > MAX_BUFFER) bucket.shift();
    s.byStudent.set(actor, bucket);
  }

  // 구독자에게 fan-out — listener 예외는 다른 리스너에 영향 안 주도록 격리
  for (const listener of s.listeners) {
    try {
      listener(stmt);
    } catch {
      // ignore listener errors
    }
  }
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

/**
 * 신규 이벤트 구독. 반환된 unsubscribe 함수를 연결 해제 시 호출.
 * SSE 라우트는 request abort 시 unsubscribe를 불러 누수를 막는다.
 */
export function subscribeEvents(listener: EventListener): () => void {
  const s = getStore();
  s.listeners.add(listener);
  return () => {
    s.listeners.delete(listener);
  };
}

export function listenerCount(): number {
  return getStore().listeners.size;
}

export function clearEvents(): void {
  const s = getStore();
  s.buffer.length = 0;
  s.byStudent.clear();
  s.listeners.clear();
}
