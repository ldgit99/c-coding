import { describe, expect, it } from "vitest";

import {
  classifyHelpSeeking,
  classifyTerminative,
  classifyToken,
  codeSwitchProfile,
  computeTextMiningProfile,
  discourseMarkerProfile,
  helpSeekingDistribution,
  mtld,
  mtldFromUtterances,
  terminativeDistribution,
  tokenize,
} from "./text-mining";

// ============================================================================
// F1 — 종결어미 분류
// ============================================================================

describe("classifyTerminative", () => {
  it("의문형 종결어미 — 다양한 형태", () => {
    expect(classifyTerminative("이거 왜 안 되나요?")).toBe("interrogative");
    expect(classifyTerminative("포인터가 NULL 인가요?")).toBe("interrogative");
    expect(classifyTerminative("맞나요?")).toBe("interrogative");
    expect(classifyTerminative("이렇게 하면 되죠?")).toBe("interrogative");
    expect(classifyTerminative("어떻게 하지?")).toBe("interrogative");
  });

  it("확신·선언형", () => {
    expect(classifyTerminative("아 이해했어요.")).toBe("assertive");
    expect(classifyTerminative("이제 알겠어요!")).toBe("assertive");
    expect(classifyTerminative("그렇군요.")).toBe("assertive");
    expect(classifyTerminative("실행해 보겠습니다.")).toBe("assertive");
  });

  it("모호·헤지(hedge) — 의문/확신보다 우선", () => {
    expect(classifyTerminative("이게 맞는 것 같아요.")).toBe("hedge");
    expect(classifyTerminative("배열 인덱스 문제인 듯해요.")).toBe("hedge");
    expect(classifyTerminative("아닐까요?")).toBe("hedge");
  });

  it("명령·요청형", () => {
    expect(classifyTerminative("이 코드 고쳐 주세요.")).toBe("directive");
    expect(classifyTerminative("힌트 알려줘")).toBe("directive");
    expect(classifyTerminative("예시 보여줘")).toBe("directive");
  });

  it("none — 매칭 없음 / 너무 짧음", () => {
    expect(classifyTerminative("ㅇㅋ")).toBe("none");
    expect(classifyTerminative("")).toBe("none");
    expect(classifyTerminative("malloc")).toBe("none");
  });

  it("terminativeDistribution 합산", () => {
    const dist = terminativeDistribution([
      "왜 안 되나요?",
      "이해했어요.",
      "맞는 것 같아요.",
      "고쳐줘",
      "ㅎㅎ", // none(짧음)
    ]);
    expect(dist).toEqual({
      interrogative: 1,
      assertive: 1,
      hedge: 1,
      directive: 1,
      none: 1,
      total: 5,
    });
  });
});

// ============================================================================
// F2 — 코드 스위칭
// ============================================================================

describe("classifyToken", () => {
  it("순수 한글", () => {
    expect(classifyToken("포인터")).toBe("hangul");
    expect(classifyToken("배열")).toBe("hangul");
  });

  it("순수 영문 (기술용어)", () => {
    expect(classifyToken("malloc")).toBe("english");
    expect(classifyToken("NULL")).toBe("english");
    expect(classifyToken("printf")).toBe("english");
  });

  it("혼합 — mixed (한글+영문 동시)", () => {
    expect(classifyToken("malloc함수")).toBe("mixed");
    expect(classifyToken("for문")).toBe("mixed");
    expect(classifyToken("NULL이")).toBe("mixed");
  });

  it("숫자·기호", () => {
    expect(classifyToken("123")).toBe("numeric");
    expect(classifyToken("()")).toBe("symbol");
    expect(classifyToken("===")).toBe("symbol");
  });
});

describe("codeSwitchProfile", () => {
  it("코드 스위칭 비율 계산", () => {
    const p = codeSwitchProfile([
      "포인터를 dereference 하면 segfault 가 나요",
      "malloc 으로 메모리 할당했어요",
    ]);
    expect(p.total).toBeGreaterThan(0);
    expect(p.english).toBeGreaterThan(0);
    expect(p.hangul).toBeGreaterThan(0);
    expect(p.codeSwitchRate).toBeGreaterThan(0);
    expect(p.codeSwitchRate).toBeLessThanOrEqual(1);
  });

  it("순 한국어 발화 — codeSwitchRate ≈ 0", () => {
    const p = codeSwitchProfile([
      "이게 왜 안 되는지 모르겠어요",
      "다시 한 번 설명해 주세요",
    ]);
    expect(p.codeSwitchRate).toBe(0);
  });

  it("빈 입력", () => {
    const p = codeSwitchProfile([]);
    expect(p.total).toBe(0);
    expect(p.codeSwitchRate).toBe(0);
  });
});

// ============================================================================
// F3 — MTLD
// ============================================================================

describe("mtld / mtldFromUtterances", () => {
  it("동일 토큰 반복 — 낮은 다양성", () => {
    const repeated = Array(40).fill("같은").map((_, i) => (i % 2 === 0 ? "같은" : "단어"));
    const score = mtld(repeated);
    // 다양성 낮으면 짧은 segment 가 자주 잘려 score 가 작음
    expect(score).toBeLessThan(20);
  });

  it("매번 다른 토큰 — 높은 다양성 (점수 ≥ N)", () => {
    const distinct = Array.from({ length: 30 }, (_, i) => `단어${i}`);
    const score = mtld(distinct);
    expect(score).toBeGreaterThanOrEqual(distinct.length);
  });

  it("빈 입력 → 0", () => {
    expect(mtld([])).toBe(0);
  });

  it("발화 입력 wrapper", () => {
    const result = mtldFromUtterances([
      "포인터는 메모리 주소를 저장합니다",
      "malloc 으로 동적 할당이 가능해요",
      "free 를 호출해서 해제하세요",
    ]);
    expect(result.tokenCount).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it("결정적 — 동일 입력 동일 출력", () => {
    const utters = ["배열은 인덱스 0 부터 시작합니다", "포인터는 주소를 가리킵니다"];
    const a = mtldFromUtterances(utters);
    const b = mtldFromUtterances(utters);
    expect(a).toEqual(b);
  });
});

// ============================================================================
// F4 — Help-seeking strategy
// ============================================================================

describe("classifyHelpSeeking", () => {
  it("executive — 즉시 답·코드 요구", () => {
    expect(classifyHelpSeeking("그냥 답 알려줘")).toBe("executive");
    expect(classifyHelpSeeking("코드 만들어 줘")).toBe("executive");
    expect(classifyHelpSeeking("정답 좀 알려주세요")).toBe("executive");
    expect(classifyHelpSeeking("전체 코드 줘")).toBe("executive");
    expect(classifyHelpSeeking("대신 풀어줘")).toBe("executive");
  });

  it("instrumental — 이해·이유 추구", () => {
    expect(classifyHelpSeeking("왜 이렇게 동작하나요?")).toBe("instrumental");
    expect(classifyHelpSeeking("어떻게 하면 NULL 체크할 수 있나요?")).toBe("instrumental");
    expect(classifyHelpSeeking("배열과 포인터 차이가 뭐예요?")).toBe("instrumental");
    expect(classifyHelpSeeking("이해가 안 돼요")).toBe("instrumental");
    expect(classifyHelpSeeking("힌트 좀 줘")).toBe("instrumental");
  });

  it("other — 인사·상태", () => {
    expect(classifyHelpSeeking("안녕하세요")).toBe("other");
    expect(classifyHelpSeeking("끝났어요")).toBe("other");
  });

  it("helpSeekingDistribution 비율", () => {
    const d = helpSeekingDistribution([
      "왜 NULL 인가요?", // instrumental
      "어떻게 해야 하지?", // instrumental
      "그냥 답 알려줘", // executive
      "안녕", // other
    ]);
    expect(d.instrumental).toBe(2);
    expect(d.executive).toBe(1);
    expect(d.other).toBe(1);
    expect(d.total).toBe(4);
    expect(d.instrumentalShare).toBeCloseTo(2 / 3, 5);
  });

  it("instrumentalShare — 분모 0 시 0", () => {
    const d = helpSeekingDistribution(["안녕", "끝"]);
    expect(d.instrumentalShare).toBe(0);
  });
});

// ============================================================================
// F5 — Discourse markers
// ============================================================================

describe("discourseMarkerProfile", () => {
  it("inference·contrast·hypothesis 카테고리 분리", () => {
    const p = discourseMarkerProfile([
      "그래서 이게 안 되는 거예요",
      "근데 왜 NULL 이 나오죠",
      "혹시 포인터 문제일까요",
      "일단 코드를 다시 봅니다",
      "정리하면 인덱스가 1 더 큰 거네요",
    ]);
    expect(p.byCategory.inference).toBeGreaterThanOrEqual(1);
    expect(p.byCategory.contrast).toBeGreaterThanOrEqual(1);
    expect(p.byCategory.hypothesis).toBeGreaterThanOrEqual(1);
    expect(p.byCategory.sequence).toBeGreaterThanOrEqual(1);
    expect(p.byCategory.reflection).toBeGreaterThanOrEqual(1);
    expect(p.totalMatches).toBeGreaterThanOrEqual(5);
  });

  it("발화당 마커 평균", () => {
    const p = discourseMarkerProfile([
      "그래서 그러면 이렇게 됩니다", // 그래서 + 그러면
      "ok",
    ]);
    expect(p.totalMatches).toBe(2);
    expect(p.totalUtterances).toBe(2);
    expect(p.markersPerUtterance).toBe(1);
  });

  it("빈 입력", () => {
    const p = discourseMarkerProfile([]);
    expect(p.totalMatches).toBe(0);
    expect(p.markersPerUtterance).toBe(0);
  });
});

// ============================================================================
// 종합 프로파일
// ============================================================================

describe("computeTextMiningProfile", () => {
  it("빈 입력 — 모든 카운트 0", () => {
    const p = computeTextMiningProfile([]);
    expect(p.utteranceCount).toBe(0);
    expect(p.terminative.total).toBe(0);
    expect(p.codeSwitch.total).toBe(0);
    expect(p.mtld.tokenCount).toBe(0);
    expect(p.helpSeeking.total).toBe(0);
    expect(p.discourse.totalMatches).toBe(0);
  });

  it("실제 학생 발화 시뮬레이션 — 결정적", () => {
    const utters = [
      "포인터가 NULL 일 때 왜 segfault 가 나나요?",
      "malloc 했는데도 안 돼요. 어떻게 해야 하죠?",
      "그래서 free 를 호출해야 한다는 거네요.",
      "이해했어요!",
    ];
    const a = computeTextMiningProfile(utters);
    const b = computeTextMiningProfile(utters);
    expect(a).toEqual(b);
    expect(a.utteranceCount).toBe(4);
    expect(a.terminative.interrogative).toBeGreaterThan(0);
    expect(a.terminative.assertive).toBeGreaterThan(0);
    expect(a.helpSeeking.instrumental).toBeGreaterThan(0);
    expect(a.codeSwitch.english).toBeGreaterThan(0);
    expect(a.discourse.byMarker["그래서"]).toBe(1);
  });
});

// ============================================================================
// tokenize 보조
// ============================================================================

describe("tokenize", () => {
  it("공백·구두점·괄호로 분리", () => {
    expect(tokenize("malloc(size); free(p);")).toEqual([
      "malloc",
      "size",
      "free",
      "p",
    ]);
  });

  it("한·영 혼합", () => {
    expect(tokenize("포인터는 *p 로 dereference")).toEqual([
      "포인터는",
      "p",
      "로",
      "dereference",
    ]);
  });

  it("빈 입력", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });
});
