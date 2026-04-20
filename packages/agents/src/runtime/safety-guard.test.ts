import { describe, expect, it } from "vitest";

import { checkSafety, tokenOverlap, wrapStudentCodeSections } from "./safety-guard";

describe("tokenOverlap", () => {
  it("완전 일치 ≈ 1", () => {
    const t = "int main() { return 0; }";
    expect(tokenOverlap(t, t)).toBeGreaterThan(0.9);
  });

  it("무관한 텍스트는 낮음", () => {
    expect(tokenOverlap("int main return", "오늘 저녁 뭐 먹을까")).toBe(0);
  });
});

describe("checkSafety", () => {
  it("reference_solution 유사 payload는 block", () => {
    const ref = `
#include <stdio.h>
int sum_array(int *arr, int n) {
  int sum = 0;
  for (int i = 0; i < n; i++) sum += arr[i];
  return sum;
}`;
    const result = checkSafety({
      direction: "outbound",
      agent: "pedagogy-coach",
      payload: ref,
      referenceSolution: ref,
    });
    expect(result.verdict).toBe("block");
    expect(result.reasons[0]).toMatch(/reference_solution/);
  });

  it("email·전화번호는 sanitize하여 redact", () => {
    const result = checkSafety({
      direction: "outbound",
      agent: "teacher-copilot",
      payload: "연락: foo@bar.com, 010-1234-5678",
    });
    expect(result.verdict).toBe("sanitize");
    expect(result.sanitizedPayload).not.toMatch(/foo@bar\.com/);
    expect(result.sanitizedPayload).toContain("[redacted]");
  });

  it("outbound 욕설은 block", () => {
    const result = checkSafety({
      direction: "outbound",
      agent: "pedagogy-coach",
      payload: "shit, this is wrong",
    });
    expect(result.verdict).toBe("block");
  });

  it("inbound 욕설은 허용 + 교사 플래그", () => {
    const result = checkSafety({
      direction: "inbound",
      agent: "supervisor",
      payload: "아 ㅅㅂ 이거 왜 안돼",
    });
    expect(result.verdict).not.toBe("block");
    expect(result.reasons.some((r) => /teacher/.test(r))).toBe(true);
  });

  it("시험 모드에서 outbound 코드 블록은 block", () => {
    const result = checkSafety({
      direction: "outbound",
      agent: "pedagogy-coach",
      mode: "exam",
      payload: "예시 코드: ```c\nint main() { return 0; }\n```",
    });
    expect(result.verdict).toBe("block");
  });

  it("inbound 학생 코드 블록은 <student_code>로 래핑", () => {
    const out = wrapStudentCodeSections("여기 코드: ```\nint main() {}\n```");
    expect(out).toContain("<student_code>");
    expect(out).not.toMatch(/^```/);
  });
});
