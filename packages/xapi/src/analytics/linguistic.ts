/**
 * 학생 발화 언어 특징 추출 — Paper 3 (Cognitive Offloading Detection).
 *
 * 한국어 정규식 휴리스틱으로 학습-지향 vs offloading-지향 발화를 구분한다.
 * LLM 제로샷 라벨링 대비 장점: 결정적·무료·검증 가능. 추후 CLAUDE.md에 기록된
 * LLM-assisted 코딩 결과와 inter-rater reliability 비교 예정.
 *
 * 학술적 참고: Risko & Gilbert (2016) cognitive offloading framework,
 * Gerlich (2025) GenAI 의존 측정.
 */

/** WH-question 패턴 — 이해·탐색 지향 */
const WH_PATTERNS = [
  /왜(?:\s|$)/,
  /어떻게/,
  /어떤/,
  /무엇/,
  /뭐(?:야|지|가)?/,
  /어디/,
  /언제/,
  /누구/,
  /몇(?:\s|번|개)/,
  /\bwhy\b/i,
  /\bhow\b/i,
  /\bwhat\b/i,
];

/** 명령형/요구 패턴 — offloading 지향 */
const IMPERATIVE_PATTERNS = [
  /해\s*줘/,
  /해\s*주세요/,
  /만들어\s*줘/,
  /알려\s*줘/,
  /알려\s*주세요/,
  /보여\s*줘/,
  /써\s*줘/,
  /고쳐\s*줘/,
  /바꿔\s*줘/,
  /해\s*봐/,
  /답\s*뭐야/,
  /정답\s*(?:뭐|알려)/,
];

/** 즉시 코드 요구 — 가장 강한 offloading 신호 */
const CODE_FIRST_PATTERNS = [
  /이\s*코드\s*(?:돌려|실행)/,
  /코드\s*(?:만들어|짜\s*줘|써\s*줘)/,
  /완성\s*(?:해|시켜)/,
  /전체\s*코드/,
  /바로\s*코드/,
  /정답\s*코드/,
];

/** 메타인지·계획 표현 — 건강한 SRL 신호 */
const METACOG_PATTERNS = [
  /나는\s*.+(?:이해했|생각)/,
  /내가\s*.+(?:만든|작성|짰)/,
  /방향이\s*맞/,
  /접근이\s*맞/,
  /왜\s*이렇게/,
  /이해가\s*안/,
];

export interface UtteranceFeatures {
  hasWhQuestion: boolean;
  hasImperative: boolean;
  hasCodeFirstDemand: boolean;
  hasMetacognitive: boolean;
  length: number;
}

export function extractUtteranceFeatures(text: string): UtteranceFeatures {
  const t = text.trim();
  return {
    hasWhQuestion: WH_PATTERNS.some((p) => p.test(t)),
    hasImperative: IMPERATIVE_PATTERNS.some((p) => p.test(t)),
    hasCodeFirstDemand: CODE_FIRST_PATTERNS.some((p) => p.test(t)),
    hasMetacognitive: METACOG_PATTERNS.some((p) => p.test(t)),
    length: t.length,
  };
}

export interface LinguisticProfile {
  totalUtterances: number;
  avgLength: number;
  whQuestionRate: number;
  imperativeRate: number;
  codeFirstRate: number;
  metacognitiveRate: number;
  /** 0~1 — 높을수록 offloading 경향. (imperative + code_first − wh − metacog) / weights. */
  offloadingScore: number;
}

export function computeLinguisticProfile(utterances: string[]): LinguisticProfile {
  if (utterances.length === 0) {
    return {
      totalUtterances: 0,
      avgLength: 0,
      whQuestionRate: 0,
      imperativeRate: 0,
      codeFirstRate: 0,
      metacognitiveRate: 0,
      offloadingScore: 0,
    };
  }
  let wh = 0;
  let imp = 0;
  let codef = 0;
  let meta = 0;
  let totalLen = 0;
  for (const u of utterances) {
    const f = extractUtteranceFeatures(u);
    if (f.hasWhQuestion) wh++;
    if (f.hasImperative) imp++;
    if (f.hasCodeFirstDemand) codef++;
    if (f.hasMetacognitive) meta++;
    totalLen += f.length;
  }
  const n = utterances.length;
  const whRate = wh / n;
  const impRate = imp / n;
  const codefRate = codef / n;
  const metaRate = meta / n;

  // offloadingScore: 가중치 휴리스틱 (0~1 clamp)
  const raw = 0.4 * impRate + 0.5 * codefRate - 0.3 * whRate - 0.3 * metaRate + 0.3;
  const offloadingScore = Math.max(0, Math.min(1, raw));

  return {
    totalUtterances: n,
    avgLength: Math.round(totalLen / n),
    whQuestionRate: whRate,
    imperativeRate: impRate,
    codeFirstRate: codefRate,
    metacognitiveRate: metaRate,
    offloadingScore,
  };
}
