/**
 * xAPI verb 카탈로그
 * 스킬 정의: .claude/skills/xapi-event/SKILL.md
 *
 * URI는 https://cvibe.app/verbs/{kebab-case} 형식으로 고정.
 * 신규 verb 추가 시 스킬 카탈로그도 동시에 갱신할 것.
 */

export const VERB_BASE = "https://cvibe.app/verbs";

export const Verbs = {
  requestedHint: `${VERB_BASE}/requested-hint`,
  receivedHint: `${VERB_BASE}/received-hint`,
  compileError: `${VERB_BASE}/compile-error`,
  runtimeError: `${VERB_BASE}/runtime-error`,
  submissionPassed: `${VERB_BASE}/submission-passed`,
  submissionFailed: `${VERB_BASE}/submission-failed`,
  aiSuggestionAccepted: `${VERB_BASE}/ai-suggestion-accepted`,
  aiSuggestionRejected: `${VERB_BASE}/ai-suggestion-rejected`,
  selfExplanationSubmitted: `${VERB_BASE}/self-explanation-submitted`,
  reflectionSubmitted: `${VERB_BASE}/reflection-submitted`,
  blockedBySafety: `${VERB_BASE}/blocked-by-safety`,
  teacherIntervened: `${VERB_BASE}/teacher-intervened`,
  /** ▶실행 정상 종료 — 컴파일/런타임 에러가 아닌 모든 학생 코드 실행. */
  runExecuted: `${VERB_BASE}/run-executed`,
  /** 에디터 자동 저장 (drafts) — 5초 디바운스 단위 저장 발생 시. */
  draftSaved: `${VERB_BASE}/draft-saved`,
  /** Code Reviewer 가 실행되어 findings 가 산출됨. result.findings 요약 저장. */
  codeReviewed: `${VERB_BASE}/code-reviewed`,
  /** Runtime Debugger 가 실행되어 가설 목록이 산출됨. */
  runtimeDebugged: `${VERB_BASE}/runtime-debugged`,
  modeChanged: `${VERB_BASE}/mode-changed`,
  /**
   * 자발적 모드 하향 — coach→pair 또는 pair→solo 로 학생이 스스로 내렸을 때.
   * Self-Regulated Learning 성숙도의 novel indicator.
   */
  modeDecreased: `${VERB_BASE}/mode-decreased`,
  /** 시험 모드 진입 — 교사가 전체 또는 특정 학생에게 적용. */
  examStarted: `${VERB_BASE}/exam-started`,
  examEnded: `${VERB_BASE}/exam-ended`,
  masteryUpdated: `${VERB_BASE}/mastery-updated`,
  interventionFlagged: `${VERB_BASE}/intervention-flagged`,
} as const;

export type VerbId = (typeof Verbs)[keyof typeof Verbs];

export const KC_BASE = "https://cvibe.app/kc";
export const ASSIGNMENT_BASE = "https://cvibe.app/assignment";
export const CODE_BASE = "https://cvibe.app/code";
