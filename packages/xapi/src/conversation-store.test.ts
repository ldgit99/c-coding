import { beforeEach, describe, expect, it } from "vitest";

import {
  clearConversation,
  getConversation,
  recordTurn,
} from "./conversation-store";

describe("conversation-store", () => {
  beforeEach(() => {
    clearConversation();
  });

  it("학생별로 분리되어 저장된다", () => {
    recordTurn({ studentId: "s1", role: "student", text: "hi" });
    recordTurn({ studentId: "s2", role: "student", text: "안녕" });
    expect(getConversation({ studentId: "s1" })).toHaveLength(1);
    expect(getConversation({ studentId: "s2" })[0]!.text).toBe("안녕");
  });

  it("assignmentId로 필터된다", () => {
    recordTurn({ studentId: "s1", role: "student", text: "A", assignmentId: "A01" });
    recordTurn({ studentId: "s1", role: "ai", text: "B", assignmentId: "A02" });
    const onlyA01 = getConversation({ studentId: "s1", assignmentId: "A01" });
    expect(onlyA01).toHaveLength(1);
    expect(onlyA01[0]!.text).toBe("A");
  });

  it("4000자 초과 발화는 잘리고 접미사가 붙는다", () => {
    recordTurn({ studentId: "s1", role: "student", text: "x".repeat(5000) });
    const t = getConversation({ studentId: "s1" })[0]!;
    expect(t.text.length).toBeLessThanOrEqual(4100);
    expect(t.text.endsWith("…[truncated]")).toBe(true);
  });

  it("limit은 마지막 N개만 반환한다", () => {
    for (let i = 0; i < 10; i++) {
      recordTurn({ studentId: "s1", role: "student", text: `m${i}` });
    }
    const last3 = getConversation({ studentId: "s1", limit: 3 });
    expect(last3.map((t) => t.text)).toEqual(["m7", "m8", "m9"]);
  });
});
