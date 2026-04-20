import type { SessionState } from "../state";

/**
 * Supervisor — 학생/교사 발화를 분류해 적합한 전문가로 라우팅.
 * MVP 구현: 단순 키워드 + 패턴 기반 분류. Week 4~5 범위.
 * 향후 Haiku 4.5 기반 LLM 분류로 업그레이드 예정.
 */

export type RouteTarget =
  | "pedagogy-coach"
  | "code-reviewer"
  | "runtime-debugger"
  | "assessment"
  | "problem-architect"
  | "teacher-copilot"
  | "safety-guard";

export type Intent =
  | "hint_request"
  | "code_submit"
  | "run_request"
  | "code_review_request"
  | "grade_submit"
  | "problem_generate"
  | "dashboard_summary"
  | "general_chat";

export interface ClassifyInput {
  actor: "student" | "teacher";
  utterance: string;
  sessionState: SessionState;
  /** 현재 에디터 코드. code-first gate 판정에 사용. */
  editorHasCode: boolean;
}

export interface ClassifyResult {
  intent: Intent;
  route: RouteTarget;
  reason: string;
  blockedByCodeFirstGate?: boolean;
}

const HINT_PATTERNS = [/힌트/, /알려\s*줘/, /모르겠/, /어떻게\s*해/, /도와\s*줘/, /hint/i, /help/i];
const RUN_PATTERNS = [/실행/, /돌려/, /run/i, /컴파일/];
const REVIEW_PATTERNS = [/리뷰/, /검토/, /확인/, /맞아/, /틀렸/];
const SUBMIT_PATTERNS = [/제출/, /채점/, /submit/i];
const PROBLEM_GEN_PATTERNS = [/과제\s*(생성|만들|추가)/, /variant/, /새\s*문제/];
const DASHBOARD_PATTERNS = [/대시보드/, /요약/, /intervention/i, /현황/];

export function classify(input: ClassifyInput): ClassifyResult {
  const text = input.utterance;

  if (input.actor === "teacher") {
    if (PROBLEM_GEN_PATTERNS.some((p) => p.test(text))) {
      return { intent: "problem_generate", route: "problem-architect", reason: "교사 + 과제 생성 키워드" };
    }
    if (DASHBOARD_PATTERNS.some((p) => p.test(text))) {
      return { intent: "dashboard_summary", route: "teacher-copilot", reason: "교사 + 대시보드 키워드" };
    }
    return { intent: "general_chat", route: "teacher-copilot", reason: "교사 기본 라우팅" };
  }

  // 학생 경로
  if (SUBMIT_PATTERNS.some((p) => p.test(text))) {
    return { intent: "grade_submit", route: "assessment", reason: "학생 + 제출 키워드" };
  }
  if (RUN_PATTERNS.some((p) => p.test(text))) {
    return { intent: "run_request", route: "runtime-debugger", reason: "학생 + 실행 키워드" };
  }
  if (REVIEW_PATTERNS.some((p) => p.test(text))) {
    if (!input.editorHasCode) {
      return {
        intent: "hint_request",
        route: "pedagogy-coach",
        reason: "코드 미작성 → code-first gate — 리뷰 요청을 힌트로 재라우팅",
        blockedByCodeFirstGate: true,
      };
    }
    return { intent: "code_review_request", route: "code-reviewer", reason: "학생 + 리뷰 키워드" };
  }
  if (HINT_PATTERNS.some((p) => p.test(text))) {
    return { intent: "hint_request", route: "pedagogy-coach", reason: "학생 + 힌트 키워드" };
  }

  // 분류 모호 → Pedagogy Coach 기본 (질문-먼저 원칙)
  return {
    intent: "general_chat",
    route: "pedagogy-coach",
    reason: "분류 모호 — 기본 라우팅 (question-first)",
  };
}
