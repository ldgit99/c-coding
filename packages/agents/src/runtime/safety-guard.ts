/**
 * Safety Guard 런타임 — research.md §5.7 + safety-guard 에이전트 정의.
 *
 * 모든 inbound/outbound 페이로드의 통과 필터. 결정론적 검사 위주 (정규식·
 * Levenshtein·토큰 오버랩). LLM 기반 정밀 분류는 Week 11+에 선택적 추가.
 *
 * research.md §5.7 네 범주:
 * 1. 정답 유출 차단 (reference_solution 유사도)
 * 2. 프롬프트 인젝션 격리 (학생 코드 → `<student_code>` 래핑)
 * 3. 부적절 발화 필터 (PII·욕설)
 * 4. reference_solution 접근 제어 (호출 에이전트 화이트리스트)
 */

export type Verdict = "allow" | "sanitize" | "block";

export interface SafetyCheckInput {
  direction: "inbound" | "outbound";
  /** 호출한 에이전트 이름 — reference_solution 접근 제어에 사용. */
  agent: string;
  payload: string;
  /** 현재 과제의 reference_solution 텍스트 (있는 경우만). */
  referenceSolution?: string;
  /** 모드(평가 중이면 더 엄격하게). */
  /** 3단계 모드 (solo/pair/coach) + exam. 레거시 값도 호환. */
  mode?: "solo" | "pair" | "coach" | "silent" | "observer" | "tutor" | "exam";
}

export interface SafetyCheckOutput {
  verdict: Verdict;
  sanitizedPayload: string;
  reasons: string[];
  /** 유사도 측정 결과 (디버깅·교사 감사용). */
  similarity?: number;
}

/** 학생 경로 에이전트 — reference_solution에 구조적으로 접근 금지. */
const STUDENT_FACING_AGENTS = new Set([
  "pedagogy-coach",
  "code-reviewer",
  "runtime-debugger",
  "supervisor",
  "student-modeler",
]);

/** reference_solution 유사도 임계 — 초과 시 block. */
const SIMILARITY_THRESHOLD = 0.7;

/** 한국어 이름·전화·이메일 간이 패턴 — Week 11에 더 정교한 패턴으로 확장. */
const PII_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
  { name: "kr-phone", regex: /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/ },
  { name: "kr-rrn", regex: /\d{6}-[1-4]\d{6}/ }, // 주민번호 형태
];

/** 공격적·부적절 단어 간단 리스트 — production에서는 확장 필요. */
const PROFANITY_PATTERNS: RegExp[] = [/씨발/, /ㅅㅂ/, /fuck/i, /shit/i];

export function checkSafety(input: SafetyCheckInput): SafetyCheckOutput {
  const reasons: string[] = [];
  let sanitized = input.payload;
  let verdict: Verdict = "allow";

  // (4) reference_solution 접근 제어: outbound일 때 발송 에이전트가 학생 경로면
  //     payload 안에 solution이 그대로 들어있는지 점검
  if (input.direction === "outbound" && STUDENT_FACING_AGENTS.has(input.agent) && input.referenceSolution) {
    const sim = tokenOverlap(input.payload, input.referenceSolution);
    if (sim >= SIMILARITY_THRESHOLD) {
      reasons.push(`reference_solution 유사도 ${sim.toFixed(2)} ≥ ${SIMILARITY_THRESHOLD}`);
      verdict = "block";
      return {
        verdict,
        sanitizedPayload: "",
        reasons,
        similarity: sim,
      };
    }
  }

  // (3) PII
  for (const { name, regex } of PII_PATTERNS) {
    if (regex.test(sanitized)) {
      reasons.push(`pii_detected:${name}`);
      sanitized = sanitized.replace(regex, "[redacted]");
      verdict = "sanitize";
    }
  }

  // (3) 부적절 발화
  if (PROFANITY_PATTERNS.some((p) => p.test(sanitized))) {
    if (input.direction === "outbound") {
      reasons.push("profanity_in_outbound");
      verdict = "block";
      return { verdict, sanitizedPayload: "", reasons };
    }
    // inbound 학생 발화 — 교사에게 조용히 플래그, 내용은 유지
    reasons.push("profanity_in_inbound_flagged_for_teacher");
  }

  // (2) 프롬프트 인젝션 격리: inbound에서 학생 코드가 들어올 때 래핑
  if (input.direction === "inbound") {
    sanitized = wrapStudentCodeSections(sanitized);
  }

  // (1) 시험 모드에서는 outbound 답변성 응답을 더 엄격히 차단
  if (input.mode === "exam" && input.direction === "outbound" && STUDENT_FACING_AGENTS.has(input.agent)) {
    // 시험 중에는 Level 4 예시 코드 금지 — payload에 코드 블록이 있으면 block
    if (/```[\s\S]*```/.test(sanitized) || /int\s+main\s*\(/.test(sanitized)) {
      reasons.push("exam_mode_code_emission_blocked");
      verdict = "block";
      return { verdict, sanitizedPayload: "", reasons };
    }
  }

  return {
    verdict,
    sanitizedPayload: sanitized,
    reasons,
  };
}

/** 학생 코드로 보이는 블록을 `<student_code>...</student_code>`로 격리. */
export function wrapStudentCodeSections(text: string): string {
  // 이미 래핑된 부분은 건너뜀
  if (text.includes("<student_code>")) return text;
  // 삼중 백틱 코드 블록만 래핑 (Markdown 관례). 나머지는 인라인 코드 외 자연어.
  return text.replace(/```([\s\S]*?)```/g, (_m, body: string) => `<student_code>${body}</student_code>`);
}

/**
 * 토큰 집합 중첩 비율 (Jaccard 유사도).
 * 간단히 [A-Za-z0-9_] 시퀀스를 토큰으로 간주. Levenshtein 대비 계산 저렴.
 */
export function tokenOverlap(a: string, b: string): number {
  const toks = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .match(/[a-z0-9_]+/g)
        ?.filter((t) => t.length >= 3) ?? [],
    );
  const A = toks(a);
  const B = toks(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}
