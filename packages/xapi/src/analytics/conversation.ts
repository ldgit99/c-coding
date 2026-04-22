/**
 * 대화 로그 기반 교사 운영 분석 — Paper 분석과 분리된 실시간 신호.
 *
 * 여기의 함수는 규칙 기반(정규식·단순 카운트)으로, Haiku 호출 없이 교사
 * 대시보드가 수 ms 안에 배지를 계산할 수 있게 한다. LLM 분류는 필요 시
 * 별도 레이어에서 덧씌운다.
 */

import { extractUtteranceFeatures } from "./linguistic";

// ============================================================================
// 1) 질문 유형 분류 — 학생 발화 1줄 → 5 buckets
// ============================================================================

export type QuestionType =
  | "concept" // "왜 포인터 쓰면 값이 안 바뀌지?"
  | "debug" // "세그폴트 났어", "컴파일 에러"
  | "answer_request" // "그냥 코드 줘"
  | "metacognitive" // "이해한 것 같은데 설명해봐도 돼?"
  | "other";

const DEBUG_PATTERNS = [
  /컴파일\s*(?:에러|안\s*됨|안돼)/,
  /에러\s*(?:났|떴|나)/,
  /(?:segfault|세그\s*폴트|세그멘테이션)/i,
  /경고/,
  /warning/i,
  /런타임\s*(?:오류|에러)/,
  /\bundefined\b/i,
  /\bnull\b/i,
  /(?:왜|안)\s*돌아가/,
  /결과\s*가\s*(?:이상|달라|다르)/,
  /출력\s*이\s*(?:이상|달라|다르|틀)/,
  /무한\s*루프/,
];

const ANSWER_REQUEST_PATTERNS = [
  /그냥\s*(?:답|코드)/,
  /답\s*(?:만|좀|뭐|알려)/,
  /정답\s*(?:뭐|알려|좀)/,
  /완성\s*(?:된|시킨)\s*코드/,
  /전체\s*코드/,
  /바로\s*코드/,
  /대신\s*(?:해|짜|써)/,
];

const CONCEPT_PATTERNS = [
  /왜\s*(?:이|그|이렇|그렇)/,
  /(?:포인터|배열|함수|재귀|메모리|반복문|조건문)\s*(?:가|이|란|는|의)/,
  /차이\s*(?:가|는|뭐)/,
  /의미\s*(?:가|는|뭐)/,
  /어떻게\s*(?:동작|작동)/,
  /어떤\s*(?:원리|의미|관계)/,
];

/**
 * 한 학생 발화를 5-way 분류한다. 우선순위:
 *  1) metacognitive (강한 SRL 신호)
 *  2) answer_request (offloading — 교사 플래그 대상)
 *  3) debug (에러 용어)
 *  4) concept (WH + 개념어)
 *  5) other
 */
export function classifyUtterance(text: string): QuestionType {
  const t = text.trim();
  if (!t) return "other";

  const f = extractUtteranceFeatures(t);
  if (f.hasMetacognitive) return "metacognitive";

  if (ANSWER_REQUEST_PATTERNS.some((p) => p.test(t))) return "answer_request";
  if (f.hasCodeFirstDemand) return "answer_request";

  if (DEBUG_PATTERNS.some((p) => p.test(t))) return "debug";

  if (
    CONCEPT_PATTERNS.some((p) => p.test(t)) ||
    (f.hasWhQuestion && /[가-힣]{3,}/.test(t))
  ) {
    return "concept";
  }

  return "other";
}

// ============================================================================
// 2) 감정·막힘 신호
// ============================================================================

const FRUSTRATION_TERMS = [
  "짜증",
  "포기",
  "모르겠",
  "답답",
  "힘들",
  "어려워",
  "못하겠",
  "하기\\s*싫",
  "지친",
  "귀찮",
];

const FRUSTRATION_RE = new RegExp(FRUSTRATION_TERMS.join("|"));

/**
 * 0~1 점수. 최근 10턴에 등장한 frustration 어휘 비율 × 어조 강도.
 * 단순 선형 — 정밀도보다 재현율 우선(교사가 한 번 더 확인하게).
 */
export function frustrationScore(utterances: string[]): number {
  if (utterances.length === 0) return 0;
  const recent = utterances.slice(-10);
  let hits = 0;
  let intensity = 0;
  for (const u of recent) {
    if (FRUSTRATION_RE.test(u)) {
      hits += 1;
      if (/(?:진짜|너무|완전|아\s|ㅠㅠ|ㅜㅜ)/.test(u)) intensity += 1;
    }
  }
  const rate = hits / recent.length;
  return Math.min(1, rate + intensity * 0.05);
}

// ============================================================================
// 3) Copy-paste Red Flag — AI 응답 → 30초 이내 제출 + 빈약 reflection
// ============================================================================

export interface RedFlagInput {
  lastAssistantTurnAt?: string | null;
  lastSubmissionAt?: string | null;
  reflectionLength?: number;
}

export interface RedFlagResult {
  suspectedCopy: boolean;
  gapSec: number | null;
  reasons: string[];
}

/**
 * AI 턴 직후 30초 이내 제출이면 1차 의심, reflection 합산 길이가 30자 미만이면 확정.
 * 너무 빡빡한 임계는 오탐 → 교사 확인 배지용이므로 보수적 false보다 재현율 우선.
 */
export function detectCopyPasteRedFlag(input: RedFlagInput): RedFlagResult {
  const { lastAssistantTurnAt, lastSubmissionAt, reflectionLength = 0 } = input;
  const reasons: string[] = [];
  if (!lastAssistantTurnAt || !lastSubmissionAt) {
    return { suspectedCopy: false, gapSec: null, reasons };
  }
  const a = new Date(lastAssistantTurnAt).getTime();
  const b = new Date(lastSubmissionAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) {
    return { suspectedCopy: false, gapSec: null, reasons };
  }
  const gapSec = Math.round((b - a) / 1000);
  if (gapSec <= 30) reasons.push(`AI 응답 ${gapSec}초 후 제출`);
  if (reflectionLength < 30) reasons.push(`reflection 합계 ${reflectionLength}자 미만`);
  const suspectedCopy = gapSec <= 30 && reflectionLength < 30;
  return { suspectedCopy, gapSec, reasons };
}

// ============================================================================
// 4) Stuck Loop Detection — 같은 주제 반복 질문
// ============================================================================

export interface LoopResult {
  inLoop: boolean;
  repeatedTerm?: string;
  repeatCount: number;
}

/**
 * 최근 N (기본 8) 학생 발화에서 같은 `KC 계열 명사` 또는 `에러 키워드`가
 * 3회 이상 등장하면 loop 로 판정. 단어 빈도 기반 — 단순 subword 체크.
 */
export function detectStuckLoop(
  utterances: string[],
  opts: { window?: number; minRepeat?: number } = {},
): LoopResult {
  const win = opts.window ?? 8;
  const min = opts.minRepeat ?? 3;
  const recent = utterances.slice(-win);
  if (recent.length < min) return { inLoop: false, repeatCount: 0 };

  const terms = [
    "포인터",
    "배열",
    "함수",
    "재귀",
    "메모리",
    "반복문",
    "조건문",
    "세그폴트",
    "컴파일",
    "malloc",
    "printf",
    "scanf",
    "null",
    "에러",
  ];
  const counts = new Map<string, number>();
  for (const u of recent) {
    const lower = u.toLowerCase();
    for (const t of terms) {
      if (lower.includes(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  let best: { term?: string; n: number } = { n: 0 };
  for (const [t, n] of counts) if (n > best.n) best = { term: t, n };
  if (best.n >= min) {
    return { inLoop: true, repeatedTerm: best.term, repeatCount: best.n };
  }
  return { inLoop: false, repeatCount: best.n };
}

// ============================================================================
// 5) 학생 단위 대화 요약 — 교사 Conversation Intelligence 탭용
// ============================================================================

export interface TurnLike {
  studentId: string;
  role: "student" | "assistant";
  text: string;
  createdAt: string;
}

export interface ConversationSummary {
  studentId: string;
  turnCount: number;
  studentUtteranceCount: number;
  distribution: Record<QuestionType, number>;
  frustration: number;
  loop: LoopResult;
  lastActivityAt: string | null;
}

export function summarizeConversation(
  studentId: string,
  turns: TurnLike[],
): ConversationSummary {
  const myTurns = turns.filter((t) => t.studentId === studentId);
  const studentText = myTurns.filter((t) => t.role === "student").map((t) => t.text);
  const distribution: Record<QuestionType, number> = {
    concept: 0,
    debug: 0,
    answer_request: 0,
    metacognitive: 0,
    other: 0,
  };
  for (const u of studentText) distribution[classifyUtterance(u)] += 1;

  const last = myTurns.at(-1)?.createdAt ?? null;
  return {
    studentId,
    turnCount: myTurns.length,
    studentUtteranceCount: studentText.length,
    distribution,
    frustration: frustrationScore(studentText),
    loop: detectStuckLoop(studentText),
    lastActivityAt: last,
  };
}

// ============================================================================
// 6) 공통 질문 클러스터 — 교사 운영용 상위 5개
// ============================================================================

/**
 * 토큰 오버랩 (Jaccard) 기반 간이 클러스터링. 임베딩 없이 탑-k개 주제만
 * 교사에게 보여주면 충분. 한국어 공백 토큰화 + 2글자 이상 단어만.
 */
export function clusterCommonQuestions(
  utterances: string[],
  opts: { minClusterSize?: number; topK?: number } = {},
): Array<{ representative: string; count: number; members: string[] }> {
  const minSize = opts.minClusterSize ?? 2;
  const topK = opts.topK ?? 5;

  const tokenize = (s: string): Set<string> =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^가-힣a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 2),
    );

  const jaccard = (a: Set<string>, b: Set<string>): number => {
    if (a.size === 0 && b.size === 0) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter += 1;
    const uni = a.size + b.size - inter;
    return uni === 0 ? 0 : inter / uni;
  };

  const tokened = utterances.map((u) => ({ text: u, tokens: tokenize(u) }));
  const clusters: Array<{ center: Set<string>; members: string[] }> = [];
  for (const t of tokened) {
    if (t.tokens.size < 2) continue;
    let placed = false;
    for (const c of clusters) {
      if (jaccard(c.center, t.tokens) >= 0.4) {
        c.members.push(t.text);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ center: t.tokens, members: [t.text] });
  }
  return clusters
    .filter((c) => c.members.length >= minSize)
    .sort((a, b) => b.members.length - a.members.length)
    .slice(0, topK)
    .map((c) => ({ representative: c.members[0]!, count: c.members.length, members: c.members }));
}
