/**
 * Next.js 부팅 훅 — Edge·Node 런타임 모두에서 한 번씩 호출됨.
 * Node 런타임에만 Supabase service_role 클라이언트가 필요하므로 분기.
 *
 * 주 책임: xAPI 이벤트 영구 저장 싱크 등록.
 * 학생 손실 0 원칙 — 메모리 buffer 외에 events 테이블에도 INSERT.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerEventPersistence } = await import("./lib/event-persistence");
    registerEventPersistence();
  }
}
