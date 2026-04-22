import { describe, expect, it } from "vitest";

import {
  classifyUtterance,
  clusterCommonQuestions,
  detectCopyPasteRedFlag,
  detectStuckLoop,
  frustrationScore,
  summarizeConversation,
} from "./conversation";

describe("classifyUtterance", () => {
  it("답 요청을 answer_request로 분류", () => {
    expect(classifyUtterance("그냥 답만 알려줘")).toBe("answer_request");
    expect(classifyUtterance("전체 코드 좀 짜줘")).toBe("answer_request");
  });

  it("에러 용어를 debug로", () => {
    expect(classifyUtterance("세그폴트 났어요")).toBe("debug");
    expect(classifyUtterance("컴파일 에러가 났는데")).toBe("debug");
    expect(classifyUtterance("왜 안 돌아가지")).toBe("debug");
  });

  it("메타인지 신호 우선", () => {
    expect(classifyUtterance("나는 이 부분을 이해했어요")).toBe("metacognitive");
    expect(classifyUtterance("내가 이 코드를 작성했어요")).toBe("metacognitive");
  });

  it("개념 질문", () => {
    expect(classifyUtterance("포인터가 왜 필요해요")).toBe("concept");
  });

  it("빈 문자열은 other", () => {
    expect(classifyUtterance("")).toBe("other");
  });
});

describe("frustrationScore", () => {
  it("긍정 발화는 0", () => {
    expect(frustrationScore(["잘 모르는 부분 알려주세요", "감사해요"])).toBe(0);
  });

  it("frustration 어휘가 있으면 > 0", () => {
    const s = frustrationScore([
      "진짜 모르겠어요 ㅠㅠ",
      "너무 어려워",
      "포기하고 싶어",
    ]);
    expect(s).toBeGreaterThan(0.5);
  });
});

describe("detectCopyPasteRedFlag", () => {
  it("30초 이내 + 짧은 reflection 이면 suspect", () => {
    const res = detectCopyPasteRedFlag({
      lastAssistantTurnAt: "2026-04-22T10:00:00Z",
      lastSubmissionAt: "2026-04-22T10:00:20Z",
      reflectionLength: 10,
    });
    expect(res.suspectedCopy).toBe(true);
    expect(res.gapSec).toBe(20);
  });

  it("충분한 시간 간격이면 통과", () => {
    const res = detectCopyPasteRedFlag({
      lastAssistantTurnAt: "2026-04-22T10:00:00Z",
      lastSubmissionAt: "2026-04-22T10:05:00Z",
      reflectionLength: 10,
    });
    expect(res.suspectedCopy).toBe(false);
  });

  it("타임스탬프 없으면 false", () => {
    expect(detectCopyPasteRedFlag({}).suspectedCopy).toBe(false);
  });
});

describe("detectStuckLoop", () => {
  it("같은 주제 3회 이상 → loop", () => {
    const res = detectStuckLoop([
      "포인터 뭐야",
      "포인터 선언 어떻게",
      "포인터 역참조",
      "배열은?",
    ]);
    expect(res.inLoop).toBe(true);
    expect(res.repeatedTerm).toBe("포인터");
  });

  it("반복 없으면 inLoop=false", () => {
    const res = detectStuckLoop(["배열 공부 중", "함수 쓸 때"]);
    expect(res.inLoop).toBe(false);
  });
});

describe("summarizeConversation", () => {
  it("distribution 이 턴 수와 일치", () => {
    const turns = [
      { studentId: "s1", role: "student" as const, text: "그냥 답 좀", createdAt: "2026-04-22T10:00:00Z" },
      { studentId: "s1", role: "student" as const, text: "세그폴트 났어", createdAt: "2026-04-22T10:01:00Z" },
      { studentId: "s1", role: "assistant" as const, text: "힌트 1단계", createdAt: "2026-04-22T10:01:30Z" },
      { studentId: "s2", role: "student" as const, text: "안녕", createdAt: "2026-04-22T10:02:00Z" },
    ];
    const sum = summarizeConversation("s1", turns);
    expect(sum.turnCount).toBe(3);
    expect(sum.studentUtteranceCount).toBe(2);
    expect(sum.distribution.answer_request).toBe(1);
    expect(sum.distribution.debug).toBe(1);
  });
});

describe("clusterCommonQuestions", () => {
  it("비슷한 질문을 묶어서 상위 k개", () => {
    const clusters = clusterCommonQuestions(
      [
        "포인터 선언 어떻게 해요",
        "포인터 선언 방법",
        "포인터 선언이 뭐지",
        "배열은 어떻게",
        "배열 만드는 법",
      ],
      { minClusterSize: 2, topK: 3 },
    );
    expect(clusters.length).toBeGreaterThanOrEqual(1);
    expect(clusters[0]!.count).toBeGreaterThanOrEqual(2);
  });
});
