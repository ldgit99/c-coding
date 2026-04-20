import { beforeEach, describe, expect, it } from "vitest";

import { buildStatement, Verbs } from "./index";
import { clearEvents, listenerCount, recordEvent, subscribeEvents } from "./store";

describe("subscribeEvents pub-sub", () => {
  beforeEach(() => clearEvents());

  it("새 이벤트 발행 시 구독자 호출", () => {
    const received: string[] = [];
    const unsub = subscribeEvents((s) => received.push(s.verb.id));
    const stmt = buildStatement({
      actor: { type: "student", id: "s1" },
      verb: Verbs.requestedHint,
      object: { type: "kc", slug: "x" },
    });
    recordEvent(stmt);
    expect(received).toEqual([Verbs.requestedHint]);
    unsub();
  });

  it("unsubscribe 후엔 호출되지 않음", () => {
    const received: string[] = [];
    const unsub = subscribeEvents((s) => received.push(s.verb.id));
    unsub();
    recordEvent(
      buildStatement({
        actor: { type: "student", id: "s1" },
        verb: Verbs.compileError,
        object: { type: "kc", slug: "x" },
      }),
    );
    expect(received).toEqual([]);
    expect(listenerCount()).toBe(0);
  });

  it("리스너 예외는 다른 리스너를 막지 않음", () => {
    const received: string[] = [];
    const unsub1 = subscribeEvents(() => {
      throw new Error("listener 폭발");
    });
    const unsub2 = subscribeEvents((s) => received.push(s.verb.id));
    recordEvent(
      buildStatement({
        actor: { type: "student", id: "s1" },
        verb: Verbs.submissionPassed,
        object: { type: "assignment", id: "A01" },
      }),
    );
    expect(received).toHaveLength(1);
    unsub1();
    unsub2();
  });
});
