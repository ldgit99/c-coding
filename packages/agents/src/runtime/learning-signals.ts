/**
 * 실 데이터 기반 Learning Signals 계산.
 *
 * 클라이언트가 보내던 가짜값(attemptCount = editorCode.length > 20 ? 1 : 0)
 * 대신, 서버가 Supabase + xAPI 로그에서 실측값을 계산해 주입한다.
 *
 * 입력 소스:
 *  - submissions 테이블 (attemptCount, 최근 실패 여부)
 *  - xAPI events — requestedHint, submissionPassed/Failed, runExecuted
 *  - 최근 학생 발화들 (에러 키워드 반복 감지)
 */

import type { SessionState } from "../state";

type LearningSignals = NonNullable<SessionState["learningSignals"]>;

export interface SignalSources {
  /** 해당 assignment 에서 이 학생의 총 제출 횟수. */
  submissionCount: number;
  /** 해당 assignment 에서 이 학생의 최근 실패 연속 횟수. */
  recentFailureStreak: number;
  /** 최근 /api/run 호출로부터 경과 초. null 이면 기록 없음. */
  secondsSinceLastRun: number | null;
  /** xAPI 카운트: 이번 assignment 에서의 requestedHint 누적. */
  hintRequestsThisAssignment: number;
  /** 최근 6턴 학생 발화에 등장한 에러 키워드들 (중복 포함). */
  recentErrorKeywords: string[];
  /** 에디터 코드 길이 (문자 수). 코드 작성 여부 간이 판정용. */
  editorCodeLength: number;
}

/**
 * 여러 소스를 합쳐 LearningSignals 로 변환.
 *
 *  - attemptCount: 실 제출 수 (0 제출이지만 코드가 있으면 1 로 보정 — 게이팅이 움직이도록)
 *  - errorTypes: 최근 발화에서 추출된 고유 에러 키워드
 *  - repeatedErrorCount: 같은 키워드 2회 이상 등장 수
 *  - stagnationSec: 마지막 실행 이후 경과 (미기록이면 0)
 *  - hintRequests: 이 assignment 에서의 누적
 *  - aiDependencyScore: 힌트/(힌트+제출) 비율 간이 근사 (0~1)
 */
export function computeLearningSignals(src: SignalSources): LearningSignals {
  const attemptCount =
    src.submissionCount > 0
      ? src.submissionCount
      : src.editorCodeLength >= 30
        ? 1
        : 0;

  const freq = new Map<string, number>();
  for (const k of src.recentErrorKeywords) freq.set(k, (freq.get(k) ?? 0) + 1);
  const errorTypes = Array.from(freq.keys());
  const repeatedErrorCount = Array.from(freq.values()).filter((n) => n >= 2).length;

  const stagnationSec = src.secondsSinceLastRun ?? 0;
  const hintRequests = src.hintRequestsThisAssignment;
  const denom = attemptCount + hintRequests;
  const aiDependencyScore = denom > 0 ? Math.min(1, hintRequests / denom) : 0;

  return {
    attemptCount,
    errorTypes,
    repeatedErrorCount,
    stagnationSec,
    hintRequests,
    aiDependencyScore,
  };
}

/** 학생 발화에서 간이 에러 키워드 추출. 대/소문자·한국어 모두. */
export function extractErrorKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const terms = [
    "세그폴트",
    "segfault",
    "segmentation",
    "컴파일 에러",
    "컴파일에러",
    "컴파일 오류",
    "런타임 에러",
    "런타임오류",
    "null",
    "undefined",
    "경계",
    "out of bounds",
    "무한 루프",
    "무한루프",
    "타입 에러",
    "warning",
    "경고",
  ];
  const hits: string[] = [];
  for (const t of terms) {
    if (lower.includes(t)) hits.push(t.replace(/\s+/g, "_"));
  }
  return hits;
}
