import { describe, expect, it } from "vitest";

import type { SessionState } from "../state";
import { classify } from "./supervisor";

const state: SessionState = {
  studentId: "11111111-1111-1111-1111-111111111111",
  currentKC: [],
  mastery: {},
  conversation: [],
  interventionFlags: [],
  supportLevel: 0,
  selfExplanationRequired: false,
  mode: "pair",
};

describe("classify — 학생 발화 분류", () => {
  it("'힌트 줘' → pedagogy-coach", () => {
    const r = classify({ actor: "student", utterance: "힌트 좀 줘", sessionState: state, editorHasCode: false });
    expect(r.route).toBe("pedagogy-coach");
    expect(r.intent).toBe("hint_request");
  });

  it("'실행해봐' → runtime-debugger", () => {
    const r = classify({ actor: "student", utterance: "이거 실행해봐", sessionState: state, editorHasCode: true });
    expect(r.route).toBe("runtime-debugger");
  });

  it("'제출' → assessment", () => {
    const r = classify({ actor: "student", utterance: "제출할게요", sessionState: state, editorHasCode: true });
    expect(r.route).toBe("assessment");
  });

  it("코드 없는 상태의 리뷰 요청은 pedagogy-coach + code-first gate", () => {
    const r = classify({ actor: "student", utterance: "맞게 썼나 확인해줘", sessionState: state, editorHasCode: false });
    expect(r.route).toBe("pedagogy-coach");
    expect(r.blockedByCodeFirstGate).toBe(true);
  });

  it("분류 모호 시 기본 pedagogy-coach", () => {
    const r = classify({ actor: "student", utterance: "안녕", sessionState: state, editorHasCode: false });
    expect(r.route).toBe("pedagogy-coach");
    expect(r.intent).toBe("general_chat");
  });

  it("교사 '과제 만들어줘' → problem-architect", () => {
    const r = classify({ actor: "teacher", utterance: "A04 과제 만들어줘", sessionState: state, editorHasCode: false });
    expect(r.route).toBe("problem-architect");
  });

  it("교사 '대시보드 현황' → teacher-copilot", () => {
    const r = classify({ actor: "teacher", utterance: "오늘 대시보드 요약", sessionState: state, editorHasCode: false });
    expect(r.route).toBe("teacher-copilot");
  });
});
