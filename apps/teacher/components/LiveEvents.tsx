"use client";

import { useEffect, useRef, useState } from "react";

interface Statement {
  actor: { account: { name: string } };
  verb: { id: string };
  object: { id: string };
  result?: { extensions?: Record<string, unknown> };
  timestamp: string;
}

interface SnapshotPayload {
  events: Statement[];
}

const STUDENT_APP_URL = process.env.NEXT_PUBLIC_STUDENT_APP_URL ?? "http://localhost:3000";

/**
 * 학생 앱 /api/events/stream에 SSE로 접속.
 * 초기 snapshot → 구독된 event 실시간 수신.
 * EventSource는 cross-origin이어도 CORS 응답 헤더만 맞으면 동작.
 */
export function LiveEvents() {
  const [events, setEvents] = useState<Statement[]>([]);
  const [status, setStatus] = useState<"connecting" | "open" | "error">("connecting");
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = `${STUDENT_APP_URL}/api/events/stream`;
    const es = new EventSource(url, { withCredentials: false });
    esRef.current = es;

    es.addEventListener("open", () => setStatus("open"));

    es.addEventListener("snapshot", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as SnapshotPayload;
        setEvents(data.events.slice(0, 30));
      } catch {
        // ignore
      }
    });

    es.addEventListener("event", (e) => {
      try {
        const stmt = JSON.parse((e as MessageEvent).data) as Statement;
        setEvents((prev) => [stmt, ...prev].slice(0, 30));
      } catch {
        // ignore
      }
    });

    es.addEventListener("error", () => {
      setStatus("error");
      // EventSource는 자동 재연결 — 로그만 남기고 수동 close는 하지 않음
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return (
    <section className="rounded border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Live Events (SSE 실시간 스트림)</h2>
        <span className="text-[11px] text-slate-500">
          {status === "open" ? "🟢 연결됨" : status === "connecting" ? "⏳ 연결 중…" : "🔴 연결 오류(자동 재시도)"}
        </span>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">아직 기록된 이벤트가 없어요.</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-auto text-xs">
          {events.map((e, i) => (
            <li key={i} className="rounded bg-slate-50 px-2 py-1">
              <span className="text-slate-500">
                {new Date(e.timestamp).toLocaleTimeString("ko-KR", { hour12: false })}
              </span>
              <span className="ml-2 font-semibold">{e.actor.account.name}</span>
              <span className="ml-2 text-slate-700">{shortVerb(e.verb.id)}</span>
              <span className="ml-2 text-slate-500">{shortObject(e.object.id)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function shortVerb(id: string): string {
  const i = id.lastIndexOf("/");
  return i >= 0 ? id.slice(i + 1) : id;
}

function shortObject(id: string): string {
  return id.replace(/^https?:\/\/[^/]+\//, "");
}
