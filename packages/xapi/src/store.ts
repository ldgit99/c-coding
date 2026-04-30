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

/**
 * Persister — recordEvent 호출 시 fire-and-forget 으로 호출되어 영구 저장소
 * (Supabase events 테이블 등) 로 이벤트를 보내는 싱크. 미설정 시 메모리 buffer
 * 만 사용. 학생/교사 앱 부팅 시 한 번 등록한다.
 */
export type EventPersister = (stmt: XApiStatementT) => Promise<void> | void;

interface StoreState {
  buffer: XApiStatementT[];
  byStudent: Map<string, XApiStatementT[]>;
  listeners: Set<EventListener>;
  persister: EventPersister | null;
}

const globalKey = "__cvibe_xapi_store__" as const;

function getStore(): StoreState {
  const g = globalThis as unknown as Record<string, StoreState>;
  if (!g[globalKey]) {
    g[globalKey] = {
      buffer: [],
      byStudent: new Map(),
      listeners: new Set(),
      persister: null,
    };
  }
  return g[globalKey]!;
}

/**
 * 영구 저장 싱크 등록. 한 번만 호출하면 이후 모든 recordEvent 가 fire-and-forget
 * 으로 persister 를 호출. persister 의 예외는 무시 (메모리 buffer 보존).
 */
export function setEventPersister(fn: EventPersister | null): void {
  getStore().persister = fn;
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

  // 영구 저장소 fire-and-forget. 실패해도 메모리는 유지 → 손실 ≠ 무효.
  if (s.persister) {
    try {
      const r = s.persister(stmt);
      if (r && typeof (r as Promise<void>).then === "function") {
        (r as Promise<void>).catch(() => {
          // network/db 실패는 조용히 무시 — Vercel 로그에서 추적
        });
      }
    } catch {
      // sync persister 예외도 무시
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
