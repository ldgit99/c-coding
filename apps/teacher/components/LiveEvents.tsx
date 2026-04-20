"use client";

import { useEffect, useState } from "react";

interface Statement {
  actor: { account: { name: string } };
  verb: { id: string };
  object: { id: string };
  result?: { extensions?: Record<string, unknown> };
  timestamp: string;
}

export function LiveEvents() {
  const [events, setEvents] = useState<Statement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/events?limit=30");
        const data = (await res.json()) as { events: Statement[]; error?: string };
        if (cancelled) return;
        if (data.error) setError(data.error);
        else {
          setError(null);
          setEvents(data.events);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <section className="rounded border p-4">
      <h2 className="mb-2 font-semibold">Live Events (xAPI, 5초 폴링)</h2>
      {error && <div className="text-xs text-rose-600">학생 앱 연결 실패: {error}</div>}
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
