/**
 * Korean CS1 Discourse Patterns — Paper 6 (Text Mining).
 *
 * 한국어 학생-AI 대화 로그에서 결정적·검증 가능한 5가지 특징을 추출한다.
 * 외부 NLP 의존성(Mecab/KoBERT/Komoran) 없이 정규식·문자 기반 휴리스틱만
 * 사용해 IRB 데이터를 서버 사이드에서 안전하게 처리할 수 있고, 단위 테스트로
 * 라벨 일관성을 고정한다.
 *
 * RQ: Korean CS1 학생의 AI tutor 발화 패턴(종결어미·코드스위칭·help-seeking
 * strategy)이 KC mastery 와 학습 효과를 예측하는가?
 *
 * Figures:
 *   F1 종결어미 분포 (의문/확신/모호/명령)
 *   F2 코드-스위칭 비율 trajectory (한글 vs 영문 기술용어 token)
 *   F3 어휘 다양성 (MTLD, McCarthy 2005)
 *   F4 Help-seeking strategy (instrumental vs executive, Newman 1990s)
 *   F5 Discourse marker 빈도 (그러면/근데/혹시/일단 등)
 *
 * 모든 함수는 순수 함수 — 동일 입력 → 동일 출력. seeded RNG 등 비결정 요소 없음.
 */

// ============================================================================
// F1 — 종결어미 분포 (Terminative Endings)
// ============================================================================

/**
 * Korean sentence-ending categorization.
 *
 * - interrogative: 의문 — "~ㄴ가요?", "~죠?", "~까?", "~어요?", "~나요?"
 * - assertive   : 확신/선언 — "~네요", "~군요", "~ㄹ게요", "~ㅂ니다"
 * - hedge       : 모호/불확실 — "~같아요", "~듯해요", "~ㄹ 것 같"
 * - directive   : 명령/요청 — "~해주세요", "~해줘", "~해봐"
 * - none        : 위 중 어느 것도 매칭 안 됨 (짧은 단어, 코드만 등)
 */
export type TerminativeEnding =
  | "interrogative"
  | "assertive"
  | "hedge"
  | "directive"
  | "none";

const HEDGE_PATTERNS: RegExp[] = [
  /같\s*아요\s*[.?!~]*$/,
  /같\s*다\s*[.?!~]*$/,
  /같\s*은데\s*[.?!~]*$/,
  /듯\s*(?:해요|합니다|싶|함)/,
  /(?:ㄹ|을|일)\s*것\s*같/,
  /(?:ㄴ|는)\s*것\s*같/,
  /지\s*모르(?:겠|ㄴ다)/,
  /아닌가/,
  /아닐까/,
];

const INTERROGATIVE_PATTERNS: RegExp[] = [
  /\?\s*$/, // ? 로 끝나면 거의 항상 의문
  /(?:ㄴ|는)\s*가요\s*[?]?$/,
  /(?:ㄹ|을|일)\s*까요?\s*[?]?$/,
  /나요\s*[?]?$/,
  /죠\s*[?]?$/,
  /지요?\s*[?]?$/,
  /(?:맞|되)\s*나요\s*[?]?$/,
  /해\s*요\s*[?]?$/, // "이게 되요?" 류
];

const ASSERTIVE_PATTERNS: RegExp[] = [
  /네요\s*[.!~]*$/,
  /군요\s*[.!~]*$/,
  /게요\s*[.!~]*$/,
  /겠\s*어요\s*[.!~]*$/,
  /니다\s*[.!~]*$/, // "합니다", "입니다", "보겠습니다" 등 모두 포괄
  /했(?:어요|습니다)\s*[.!~]*$/,
  /이해\s*했/,
];

const DIRECTIVE_PATTERNS: RegExp[] = [
  /해\s*주세요\s*[.!~]*$/,
  /해\s*줘\s*[.!~]*$/,
  /해\s*봐\s*[.!~]*$/,
  /알려\s*(?:줘|주세요)/,
  /보여\s*(?:줘|주세요)/,
  /써\s*(?:줘|주세요)/,
  /고쳐\s*(?:줘|주세요)/,
  /만들어\s*(?:줘|주세요)/,
  /설명\s*(?:해|좀)/,
];

/**
 * 한 발화의 종결어미 카테고리를 결정한다. 우선순위는 hedge > interrogative >
 * directive > assertive — 모호 표현(같아요)이 의문문 형태로 끝나도 확신
 * 신호로 잘못 잡히지 않도록.
 */
export function classifyTerminative(text: string): TerminativeEnding {
  const t = text.trim();
  if (t.length < 2) return "none";
  if (HEDGE_PATTERNS.some((p) => p.test(t))) return "hedge";
  if (INTERROGATIVE_PATTERNS.some((p) => p.test(t))) return "interrogative";
  if (DIRECTIVE_PATTERNS.some((p) => p.test(t))) return "directive";
  if (ASSERTIVE_PATTERNS.some((p) => p.test(t))) return "assertive";
  return "none";
}

export interface TerminativeDistribution {
  interrogative: number;
  assertive: number;
  hedge: number;
  directive: number;
  none: number;
  total: number;
}

export function terminativeDistribution(utterances: string[]): TerminativeDistribution {
  const dist: TerminativeDistribution = {
    interrogative: 0,
    assertive: 0,
    hedge: 0,
    directive: 0,
    none: 0,
    total: 0,
  };
  for (const u of utterances) {
    const cat = classifyTerminative(u);
    dist[cat] += 1;
    dist.total += 1;
  }
  return dist;
}

// ============================================================================
// F2 — Code-switching (한글 vs 영문 기술용어)
// ============================================================================

/**
 * 토큰을 한글/영문/혼합/숫자/기호로 분류한다. 학생이 "포인터를 dereference"
 * 처럼 한국어 문장 안에 영문 기술용어를 섞어 쓰는 빈도를 측정.
 *
 * - hangul   : 한글이 50% 이상
 * - english  : ASCII 알파벳이 50% 이상 (기술용어, 코드 식별자)
 * - mixed    : 한글+영문 혼재 (예: "malloc함수")
 * - numeric  : 숫자만
 * - symbol   : 기타 (괄호, 연산자, 코드 단편)
 */
export type TokenKind = "hangul" | "english" | "mixed" | "numeric" | "symbol";

const HANGUL_RE = /[가-힣]/;
const ENGLISH_RE = /[A-Za-z]/;
const NUMERIC_RE = /^\d+$/;

export function classifyToken(token: string): TokenKind {
  if (token.length === 0) return "symbol";
  if (NUMERIC_RE.test(token)) return "numeric";
  let hangul = 0;
  let english = 0;
  for (const ch of token) {
    if (HANGUL_RE.test(ch)) hangul += 1;
    else if (ENGLISH_RE.test(ch)) english += 1;
  }
  if (hangul === 0 && english === 0) return "symbol";
  // 단순·일관 규칙 — 한 토큰 안에 한글+영문이 동시 존재하면 mixed.
  // 코드 스위칭 분석에서는 ratio 가 핵심이라 단일 토큰 내부의 비율은 부차적.
  if (hangul > 0 && english > 0) return "mixed";
  return hangul > 0 ? "hangul" : "english";
}

export interface CodeSwitchProfile {
  hangul: number;
  english: number;
  mixed: number;
  numeric: number;
  symbol: number;
  total: number;
  /** english/mixed token 비율 — 0~1. 코드스위칭 강도. */
  codeSwitchRate: number;
}

export function codeSwitchProfile(utterances: string[]): CodeSwitchProfile {
  const profile = {
    hangul: 0,
    english: 0,
    mixed: 0,
    numeric: 0,
    symbol: 0,
    total: 0,
    codeSwitchRate: 0,
  };
  for (const u of utterances) {
    for (const tok of tokenize(u)) {
      const kind = classifyToken(tok);
      profile[kind] += 1;
      profile.total += 1;
    }
  }
  if (profile.total > 0) {
    profile.codeSwitchRate =
      (profile.english + profile.mixed) / profile.total;
  }
  return profile;
}

/**
 * 공백·구두점·괄호로 단순 토큰화. 코드 조각이 들어 있어도 무리 없이 분리.
 */
export function tokenize(text: string): string[] {
  // C 코드 단편의 연산자(`*`, `-`, `+`, `/` 등)를 separator 로 처리해
  // `*p` → `p`, `arr[0]` → `arr`, `0` 같이 분리. 식별자만 남는다.
  return text
    .split(/[\s,.;:!?()\[\]{}<>'"`~|\\/&^%$#@+=*\-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// ============================================================================
// F3 — Lexical diversity (MTLD, McCarthy 2005)
// ============================================================================

/**
 * MTLD (Measure of Textual Lexical Diversity).
 *
 * Forward·backward 양방향으로 토큰을 진행하며, TTR(unique/total)이 임계값
 * 0.72 밑으로 떨어지는 지점마다 segment count++. 마지막 잔여 segment 는
 * 1 - (현재TTR - threshold) / (1 - threshold) 가중치로 분수 카운트.
 *
 * 점수 = N / (forwardSegments + backwardSegments) / 2.
 *
 * 짧은 텍스트(< 10 token)에는 신뢰성 낮음 — caller 가 N 표기.
 */
export function mtld(tokens: string[], threshold = 0.72): number {
  if (tokens.length === 0) return 0;
  const forward = mtldOneDirection(tokens, threshold);
  const backward = mtldOneDirection([...tokens].reverse(), threshold);
  return (forward + backward) / 2;
}

function mtldOneDirection(tokens: string[], threshold: number): number {
  if (tokens.length === 0) return 0;
  const seen = new Set<string>();
  let factors = 0;
  let runStart = 0;
  for (let i = 0; i < tokens.length; i++) {
    seen.add(tokens[i]!);
    const ttr = seen.size / (i - runStart + 1);
    if (ttr < threshold) {
      factors += 1;
      seen.clear();
      runStart = i + 1;
    }
  }
  // 잔여 segment
  const remainingLen = tokens.length - runStart;
  if (remainingLen > 0) {
    const finalTtr = seen.size / remainingLen;
    const partial =
      finalTtr >= 1
        ? 0
        : (1 - finalTtr) / Math.max(0.0001, 1 - threshold);
    factors += partial;
  }
  if (factors <= 0) return tokens.length;
  return tokens.length / factors;
}

/**
 * 발화 묶음 → MTLD. 토큰화 후 lowercased.
 * 결정적: 입력이 같으면 결과도 같음.
 */
export function mtldFromUtterances(utterances: string[], threshold = 0.72): {
  score: number;
  tokenCount: number;
} {
  const tokens: string[] = [];
  for (const u of utterances) {
    for (const t of tokenize(u)) {
      tokens.push(t.toLowerCase());
    }
  }
  return { score: mtld(tokens, threshold), tokenCount: tokens.length };
}

// ============================================================================
// F4 — Help-seeking Strategy (Newman 1990s)
// ============================================================================

/**
 * 도움 요청 전략 분류:
 * - instrumental: 이해를 돕는 정보·이유·방법 요청 ("왜 이렇게 되나요?")
 * - executive   : 즉시 답·완성 코드·해결책 요청 ("코드 그냥 줘", "답 알려줘")
 * - other       : 둘 다 아님 (인사, 상태 보고, 자기 발화)
 *
 * Newman(1990, 1991) 자기조절 학습 이론에서 instrumental 요청은 학습에
 * 긍정적, executive 요청은 의존성과 상관. 학습성과 예측력에서 경험적으로
 * 검증됨(예: Karabenick & Newman 2006).
 */
export type HelpSeekingStrategy = "instrumental" | "executive" | "other";

const EXECUTIVE_PATTERNS: RegExp[] = [
  /(?:그냥|바로|일단)\s*(?:답|코드)/,
  /답\s*(?:만|좀|뭐|알려|줘)/,
  /정답\s*(?:뭐|알려|좀|줘)/,
  /완성\s*(?:된|시킨|해|시켜)\s*(?:코드|줘)/,
  /전체\s*코드/,
  /코드\s*(?:만들어|짜\s*줘|써\s*줘|줘)/,
  /대신\s*(?:해|짜|써|풀어)/,
  /바로\s*해\s*줘/,
  /빨리\s*(?:알려|해|풀어)/,
  /(?:고쳐|수정해)\s*줘\s*$/, // 단순 명령
];

const INSTRUMENTAL_PATTERNS: RegExp[] = [
  // "왜" 단독 사용 — 문장 시작 또는 한글 외 문자 다음에 오고 공백 동반
  // ("왜냐하면" 처럼 합성된 형태는 제외)
  /(?:^|[^가-힣])왜(?:\s|$)/,
  /어떻게\s*(?:해야|하면|동작|작동|되|돼)/,
  /(?:어떤|무슨)\s*(?:차이|의미|원리|관계|이유)/,
  /(?:차이|의미|원리|관계|이유)\s*(?:가|는|뭐)/,
  /이해\s*가\s*안/,
  /(?:이게|이것이|이거)\s*(?:왜|어떻게|무슨|어떤)/,
  /힌트\s*(?:만|좀|줘)/, // 힌트 요청은 instrumental
  /(?:헷|혼)갈/,
  /(?:맞|되)\s*는지\s*(?:확인|봐|검사)/,
];

export function classifyHelpSeeking(text: string): HelpSeekingStrategy {
  const t = text.trim();
  if (t.length < 3) return "other";
  // executive 가 강한 신호 — 우선 검사
  if (EXECUTIVE_PATTERNS.some((p) => p.test(t))) return "executive";
  if (INSTRUMENTAL_PATTERNS.some((p) => p.test(t))) return "instrumental";
  return "other";
}

export interface HelpSeekingDistribution {
  instrumental: number;
  executive: number;
  other: number;
  total: number;
  /** instrumental / (instrumental + executive). 0~1. >0.5 면 학습 지향. */
  instrumentalShare: number;
}

export function helpSeekingDistribution(utterances: string[]): HelpSeekingDistribution {
  let i = 0;
  let e = 0;
  let o = 0;
  for (const u of utterances) {
    const c = classifyHelpSeeking(u);
    if (c === "instrumental") i += 1;
    else if (c === "executive") e += 1;
    else o += 1;
  }
  const denom = i + e;
  return {
    instrumental: i,
    executive: e,
    other: o,
    total: i + e + o,
    instrumentalShare: denom > 0 ? i / denom : 0,
  };
}

// ============================================================================
// F5 — Discourse Markers (SRL/추론 신호)
// ============================================================================

/**
 * 학습 담화 마커 — 추론 흐름·전환·자기조절을 보여주는 한국어 접속·부사.
 * 카테고리:
 *  - inference   : "그래서", "그러면", "결국", "왜냐하면", "따라서"
 *  - contrast    : "그런데", "근데", "하지만", "그러나", "오히려"
 *  - hypothesis  : "혹시", "만약", "만일", "혹은"
 *  - sequence    : "일단", "우선", "먼저", "그리고", "또한"
 *  - reflection  : "정리하면", "결론은", "요약하면" (메타인지)
 */
export type DiscourseCategory =
  | "inference"
  | "contrast"
  | "hypothesis"
  | "sequence"
  | "reflection";

const DISCOURSE_MARKERS: Array<{ marker: string; category: DiscourseCategory }> = [
  { marker: "그래서", category: "inference" },
  { marker: "그러면", category: "inference" },
  { marker: "그러므로", category: "inference" },
  { marker: "따라서", category: "inference" },
  { marker: "결국", category: "inference" },
  { marker: "왜냐하면", category: "inference" },
  { marker: "그런데", category: "contrast" },
  { marker: "근데", category: "contrast" },
  { marker: "하지만", category: "contrast" },
  { marker: "그러나", category: "contrast" },
  { marker: "오히려", category: "contrast" },
  { marker: "혹시", category: "hypothesis" },
  { marker: "만약", category: "hypothesis" },
  { marker: "만일", category: "hypothesis" },
  { marker: "혹은", category: "hypothesis" },
  { marker: "일단", category: "sequence" },
  { marker: "우선", category: "sequence" },
  { marker: "먼저", category: "sequence" },
  { marker: "그리고", category: "sequence" },
  { marker: "또한", category: "sequence" },
  { marker: "정리하면", category: "reflection" },
  { marker: "결론은", category: "reflection" },
  { marker: "요약하면", category: "reflection" },
];

export interface DiscourseMarkerProfile {
  byMarker: Record<string, number>;
  byCategory: Record<DiscourseCategory, number>;
  totalMatches: number;
  totalUtterances: number;
  /** 발화당 평균 마커 수 — 학습 담화의 연결성 지표. */
  markersPerUtterance: number;
}

export function discourseMarkerProfile(utterances: string[]): DiscourseMarkerProfile {
  const byMarker: Record<string, number> = {};
  const byCategory: Record<DiscourseCategory, number> = {
    inference: 0,
    contrast: 0,
    hypothesis: 0,
    sequence: 0,
    reflection: 0,
  };
  let total = 0;
  for (const u of utterances) {
    for (const { marker, category } of DISCOURSE_MARKERS) {
      // 중복 카운트 가능(한 발화에 그래서·근데 동시 등장) — 의도적으로
      // marker 빈도 그대로 합산.
      const count = countOccurrences(u, marker);
      if (count > 0) {
        byMarker[marker] = (byMarker[marker] ?? 0) + count;
        byCategory[category] += count;
        total += count;
      }
    }
  }
  return {
    byMarker,
    byCategory,
    totalMatches: total,
    totalUtterances: utterances.length,
    markersPerUtterance: utterances.length > 0 ? total / utterances.length : 0,
  };
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count += 1;
    idx += needle.length;
  }
  return count;
}

// ============================================================================
// 종합 — 학생 한 명의 텍스트 마이닝 프로파일
// ============================================================================

export interface TextMiningProfile {
  utteranceCount: number;
  terminative: TerminativeDistribution;
  codeSwitch: CodeSwitchProfile;
  mtld: { score: number; tokenCount: number };
  helpSeeking: HelpSeekingDistribution;
  discourse: DiscourseMarkerProfile;
}

export function computeTextMiningProfile(utterances: string[]): TextMiningProfile {
  return {
    utteranceCount: utterances.length,
    terminative: terminativeDistribution(utterances),
    codeSwitch: codeSwitchProfile(utterances),
    mtld: mtldFromUtterances(utterances),
    helpSeeking: helpSeekingDistribution(utterances),
    discourse: discourseMarkerProfile(utterances),
  };
}
