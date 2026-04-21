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

const STUDENT_APP_URL =
  process.env.NEXT_PUBLIC_STUDENT_APP_URL ?? "http://localhost:3000";

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
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  const dotClass =
    status === "open"
      ? "bg-success"
      : status === "connecting"
        ? "bg-warning"
        : "bg-error";
  const statusText =
    status === "open" ? "connected" : status === "connecting" ? "connecting" : "retry";

  return (
    <section className="overflow-hidden rounded-xl border border-border-soft bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-6 py-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Live Events
          </div>
          <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
            SSE 실시간 스트림
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-secondary">
          <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
          {statusText}
        </div>
      </div>
      <div className="px-6 py-4">
        {events.length === 0 ? (
          <p className="text-[13px] text-text-secondary">아직 기록된 이벤트가 없어요.</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-auto font-mono text-[11px]">
            {events.map((e, i) => (
              <li
                key={i}
                className="flex items-baseline gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-bg"
              >
                <span className="shrink-0 text-neutral">
                  {new Date(e.timestamp).toLocaleTimeString("ko-KR", { hour12: false })}
                </span>
                <span className="shrink-0 text-text-primary">{e.actor.account.name}</span>
                <span className="shrink-0 text-primary">{shortVerb(e.verb.id)}</span>
                <span className="truncate text-text-secondary">{shortObject(e.object.id)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
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
