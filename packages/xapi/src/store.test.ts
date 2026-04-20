import { beforeEach, describe, expect, it } from "vitest";

import { buildStatement, Verbs } from "./index";
import { clearEvents, listRecentEvents, listStudentEvents, recordEvent } from "./store";

describe("xapi event store", () => {
  beforeEach(() => {
    clearEvents();
  });

  it("이벤트 기록 후 listRecentEvents로 복구", () => {
    const s1 = buildStatement({
      actor: { type: "student", id: "stu-001" },
      verb: Verbs.requestedHint,
      object: { type: "kc", slug: "arrays-indexing" },
    });
    const s2 = buildStatement({
      actor: { type: "student", id: "stu-002" },
      verb: Verbs.compileError,
      object: { type: "kc", slug: "pointer-basics" },
    });
    recordEvent(s1);
    recordEvent(s2);
    const recent = listRecentEvents(10);
    expect(recent).toHaveLength(2);
    // 최신이 앞
    expect(recent[0]!.verb.id).toBe(Verbs.compileError);
  });

  it("학생별 조회", () => {
    const s1 = buildStatement({
      actor: { type: "student", id: "stu-001" },
      verb: Verbs.requestedHint,
      object: { type: "kc", slug: "a" },
    });
    recordEvent(s1);
    const byStudent = listStudentEvents(s1.actor.account.name);
    expect(byStudent).toHaveLength(1);
    expect(listStudentEvents("learner_nonexistent")).toHaveLength(0);
  });

  it("링 버퍼 상한을 넘으면 오래된 것부터 제거", () => {
    for (let i = 0; i < 550; i++) {
      recordEvent(
        buildStatement({
          actor: { type: "student", id: `s-${i}` },
          verb: Verbs.compileError,
          object: { type: "kc", slug: "x" },
        }),
      );
    }
    expect(listRecentEvents(1000)).toHaveLength(500);
  });
});
