import { listRecentEvents, subscribeEvents } from "@cvibe/xapi";

/**
 * GET /api/events/stream — Server-Sent Events 스트림.
 *
 * 교사 앱(EventSource)이 이 엔드포인트에 접속해 실시간 이벤트를 받는다.
 * 연결 시 최근 N개 이벤트를 flush한 뒤 xapi store 구독을 걸어 신규 이벤트를
 * 즉시 push. 클라이언트 abort 시 controller.close + unsubscribe로 정리.
 *
 * 5초 폴링 대비:
 * - 지연 감소(수 ms)
 * - 대역 절약(변경 없는 구간은 ping만)
 * - 서버 수명 내에서만 유효 — cold start 후에는 재연결 필요
 */

export const dynamic = "force-dynamic";

const TEACHER_ORIGIN = process.env.TEACHER_APP_ORIGIN ?? "http://localhost:3001";

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const allowOrigin = origin === TEACHER_ORIGIN ? TEACHER_ORIGIN : "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (eventName: string, data: unknown) => {
        if (closed) return;
        const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      // 초기 snapshot
      const recent = listRecentEvents(30);
      send("snapshot", { events: recent });

      // pub-sub 구독
      const unsubscribe = subscribeEvents((stmt) => send("event", stmt));

      // ping 매 20초 — proxy/브라우저 keep-alive
      const ping = setInterval(() => send("ping", { ts: Date.now() }), 20_000);

      const abort = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };
      request.signal.addEventListener("abort", abort);
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return new Response(stream, { headers });
}
