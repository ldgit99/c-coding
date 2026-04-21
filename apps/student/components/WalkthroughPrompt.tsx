"use client";

import { useState } from "react";

interface Props {
  kcTags: string[];
  assignmentTitle: string;
  stagnationMinutes: number;
  onDismiss: () => void;
}

/**
 * 30분(설정값) 이상 정체 감지 시 나타나는 부드러운 안내.
 * AI에게 바로 답을 받기보다 학습 자료 복습 습관을 유도한다.
 *
 * 현재는 외부 강의 자료 링크가 없으므로 KC 별 자기학습 질문 3개를 제시.
 * 추후 실제 학교 LMS/강의자료 URL을 연결할 수 있게 KC → URL 매핑을 분리.
 */
export function WalkthroughPrompt({
  kcTags,
  assignmentTitle,
  stagnationMinutes,
  onDismiss,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <span className="text-base">⏸</span>
          <div className="flex-1">
            <div className="text-[12px] font-medium text-text-primary">
              {stagnationMinutes}분째 큰 진전이 없는 것 같아
            </div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-text-secondary">
              AI에게 묻기 전에, 잠깐 자료를 다시 훑어볼래?
            </div>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[10px] font-medium text-warning hover:bg-warning/20"
              >
                📚 자료 보기
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded border border-border-soft px-2 py-1 text-[10px] text-text-secondary hover:text-text-primary"
              >
                계속 풀기
              </button>
            </div>
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-text-primary/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border-soft bg-surface p-6 shadow-card">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Study Self-Check
            </div>
            <h3 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
              {assignmentTitle} · 복습 포인트
            </h3>
            <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
              AI에게 힌트를 요청하기 전에, 아래 질문에 스스로 답해봐. 답이 막히는
              지점이 실제로 막힌 곳이야.
            </p>

            <ul className="mt-4 space-y-2.5">
              {kcTags.slice(0, 3).map((kc) => (
                <li
                  key={kc}
                  className="rounded-md border border-border-soft bg-bg px-3 py-2"
                >
                  <div className="font-mono text-[10px] uppercase tracking-wider text-primary">
                    {kc}
                  </div>
                  <div className="mt-1 text-[12px] text-text-primary">
                    {selfCheckForKC(kc)}
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-[11px] text-neutral">
              담당 교수·강의 자료에서 이 개념을 다룬 슬라이드를 찾아 다시 읽는 것도 좋아요.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onDismiss();
                }}
                className="rounded-md border border-border-soft px-3 py-1.5 text-[12px] text-text-primary hover:border-primary hover:text-primary"
              >
                확인했어
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function selfCheckForKC(kc: string): string {
  const MAP: Record<string, string> = {
    "variables-types": "선언한 변수의 자료형이 저장할 값의 범위를 담을 수 있는가?",
    "io-formatting": "printf 형식 지정자(%d, %s, %f)를 올바르게 골랐는가? 개행은 포함했는가?",
    "control-flow-if": "if·else if·else 순서가 더 구체적인 조건부터 쓰였는가?",
    "control-flow-loop": "루프 종료 조건이 언젠가 반드시 거짓이 되는가? 무한 루프 위험은?",
    "arrays-indexing": "인덱스 범위가 [0, N) 을 벗어나지 않는가? 경계 조건을 점검했는가?",
    "pointer-basics": "& 는 주소를 얻고, * 는 주소가 가리키는 값을 읽는다. 둘의 차이를 말로 설명할 수 있는가?",
    "pointer-arithmetic": "p+i 는 p의 타입 크기만큼 이동한다. sizeof가 다르면 결과도 다름을 기억하는가?",
    "functions-params": "함수가 값 복사로 받는지, 포인터로 받는지 명확한가? 반환값 타입은 맞는가?",
    "memory-allocation": "malloc 으로 얻은 메모리를 모두 free 했는가? 누수·이중 해제·해제 후 접근을 점검했는가?",
    recursion: "기저 사례(base case)가 있는가? 매 재귀 호출에서 상태가 기저 사례로 수렴하는가?",
  };
  return MAP[kc] ?? `이 KC(${kc})의 핵심 개념을 한 문장으로 설명해볼 수 있는가?`;
}
