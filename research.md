# C언어 학습을 위한 바이브 코딩 멀티 에이전트 시스템 설계 연구

> **프로젝트 코드네임**: *CVibe — Collaborative Vibe Coding Agent for C*
> **대상**: 대학교 1학년 C언어 입문 학습자
> **목표**: 학생–AI 짝프로그래밍(Pair Programming)을 지원하는 멀티 에이전트 기반 학습 플랫폼 설계 및 배포 전략 수립
> **작성 기준일**: 2026-04-20

---

## 0. 연구 요약 (Executive Summary)

본 문서는 [참고자료.txt](참고자료.txt)에서 초안 수준으로 정리된 "바이브 코딩(Vibe Coding) 학습 에이전트" 아이디어를 **실제 구현 가능한 시스템**으로 구체화하기 위한 심층 연구 결과다. 연구는 네 축으로 진행된다.

1. **교육학적 기반** — 왜 단일 LLM 챗봇이 아니라 *멀티 에이전트*여야 하는가?
2. **에이전트 아키텍처** — 문제 출제, 힌트, 코드 리뷰, 평가, 대시보드 분석 등 역할 분리 설계
3. **기술 스택** — Next.js + Vercel AI SDK + Claude Agent SDK + Supabase 조합의 근거
4. **운영 전략** — GitHub 기반 CI/CD와 Vercel 무중단 배포, 교사 대시보드 분리 구조

핵심 통찰은 다음과 같다.

- **"AI가 문제를 풀어준다"가 아니라 "학생의 메타인지를 증강한다"**가 제1 원칙이다. 초보자는 프롬프트에 계산적(computational) 개념이 부족해 문제를 한 번에 통째로 요청하는 경향이 있어, 무분별한 코드 생성은 학습을 *단락(short-circuit)*시킨다 ([arXiv 2507.22614](https://arxiv.org/abs/2507.22614)).
- 따라서 에이전트는 **Socratic(소크라테스식) 단계적 힌트**를 제공해야 하며, 이는 단일 프롬프트가 아닌 **역할이 분리된 다수 에이전트의 협업**으로 구현할 때 품질과 통제력이 높아진다 ([arXiv 2504.20082](https://arxiv.org/pdf/2504.20082)).
- 교사 대시보드는 **"모니터링 도구"가 아닌 "오케스트레이션 컨트롤 타워"**로 설계되어야 하며, 학생 모델(Student Model)을 공유 상태로 가져야 한다.
- 이 원칙은 운영 수준에서 **학습자 주도성, 단계적 지원, 협력적 사고 촉진, 학습 데이터 기반 개입, 교사 오케스트레이션, 반복 개선**의 6개 설계 원리로 구체화된다.

---

## 1. 연구 배경 및 문제 정의

### 1.1 바이브 코딩의 정의와 양면성

바이브 코딩은 개발자가 코드를 직접 작성하기보다 LLM과의 대화를 통해 코드를 "생성시키는" 개발 방식이다 ([Wikipedia — Vibe coding](https://en.wikipedia.org/wiki/Vibe_coding)). 실무에서는 생산성을 올리지만, **교육 맥락에서는 양날의 칼**이다.

| 긍정 측면 | 부정 측면 |
|---|---|
| 저수준 구현 부담 감소 → 개념 학습에 집중 가능 | 문제를 "통으로" 해결 요청 → 학습 단락 |
| 즉각적 피드백으로 디버깅 시간 단축 | AI 답 복붙 의존 → 기본 역량 붕괴 |
| 실패 두려움 감소, 심리적 안전감 | 검증 능력(Verification) 미형성 |

Stanford의 *Vibe Coding* 과정 및 CACM의 분석에 따르면, 바이브 코딩이 교육적으로 기능하려면 **"생성"이 아닌 "개념 중심(concept-centric)" 설계**가 필수다 ([arXiv 2602.01919](https://arxiv.org/html/2602.01919v1), [CACM Blog](https://cacm.acm.org/blogcacm/how-can-vibe-coding-transform-programming-education/)).

### 1.2 CS1 학습자의 AI 상호작용 실증 연구

arXiv 2507.22614의 연구에 따르면 CS1 학생들은 다음 특징을 보인다.

- 프롬프트에 **계산 개념(변수, 조건, 반복, 배열, 재귀)**을 충분히 명시하지 못한다.
- **한 번에 전체 문제**를 AI에 던지는 경향이 강하다.
- AI 출력의 **검증(verification) 전략**이 미성숙하다.

이는 본 시스템이 해결해야 할 **교육적 문제 정의**를 명확히 해준다.

> **문제**: 초보자가 AI와 상호작용할 때 *분해·명세·검증*이라는 계산적 사고 활동을 대신 수행시키면 안 된다. 에이전트는 그 활동을 **학생에게 되돌려야** 한다.

### 1.3 설계 제1 원칙

> **"Navigator Agent, Not Driver Agent"** — 학생은 운전대를 잡고, AI는 옆자리에서 질문·안내·리뷰만 한다.

### 1.4 핵심 설계(작동) 원리

본 시스템의 실제 작동 규칙은 다음 6개 원리로 명시한다.

1. **학습자 주도성 원리** — 학생이 먼저 코드를 작성한 뒤 AI가 피드백한다. AI는 정답보다 질문과 힌트를 우선 제공하며, AI 제안을 적용하기 전 학생은 그 제안을 왜 수락하거나 거절하는지 설명해야 한다.
2. **단계적 지원 원리** — 지원은 `힌트 → 개념 설명 → 의사코드 → 예시 코드` 순서로만 개방한다. 시도 횟수, 오류 유형, 정체 시간에 따라 지원 수준을 조절하고, 초보자의 인지 부하를 줄이기 위해 피드백은 작은 단위로 분절한다.
3. **협력적 사고 촉진 원리** — AI는 navigator, 학생은 driver 역할을 유지한다. 에이전트는 "왜 이렇게 생각했는가?"를 묻고, 가능한 경우 둘 이상의 해결안을 비교하게 하여 단일 정답 추종을 막는다.
4. **학습 데이터 기반 개입 원리** — 오류 빈도, 정체 시간, 힌트 요청 수, AI 제안 수락 패턴을 이벤트 로그로 기록한다. AI 의존도가 높은 학생은 `intervention flag`를 생성해 교사 개입 큐에 올린다.
5. **교사 오케스트레이션 원리** — 교사는 전체 진행률과 개별 상태를 동시에 확인하고 AI 개입 수준을 약·중·강으로 조정한다. 공통 오류와 취약 개념은 다음 수업의 즉시 피드백 소재로 환류한다.
6. **반복 개선 원리** — `수업 적용 → 로그 분석 → 설계 수정`의 순환을 운영 단위로 고정한다. 프롬프트, UI, 피드백 규칙, 에이전트 조합 패턴은 버전 관리되며 재사용 가능한 설계 자산으로 축적한다.

---

## 2. 이론적 토대

### 2.1 Intelligent Tutoring System (ITS) 4-모듈 아키텍처

고전적 ITS는 네 모듈로 구성된다 ([arXiv 2507.18882](https://arxiv.org/pdf/2507.18882)).

1. **Domain Model** — C언어 문법·알고리즘 개념 지식 그래프
2. **Student Model** — 학습자의 숙련도·오개념 추론 (BKT, DKT, LLM 기반 KT)
3. **Pedagogical Module** — "지금 어떤 개입을 할 것인가"의 의사결정
4. **User Interface** — 학생/교사의 상호작용 화면

본 프로젝트의 멀티 에이전트는 이 4-모듈을 **분산 구현**한 형태라고 볼 수 있다.

### 2.2 Knowledge Tracing with LLMs

LLM 기반 Knowledge Tracing은 대화 턴에서 **지식 요소(Knowledge Components, KC)**를 식별하고 숙련도를 업데이트한다 ([arXiv 2409.16490](https://arxiv.org/html/2409.16490v2)). 본 시스템에서는 학생의 코드 제출·대화 로그를 입력으로 "포인터, 반복문, 배열 인덱싱, 메모리 할당" 등 KC 단위 숙련도 벡터를 유지한다.

### 2.3 Socratic Prompting

Socratic 기법은 "답 대신 질문"으로 사고를 유도한다 ([arXiv 2303.08769](https://arxiv.org/pdf/2303.08769)). 본 시스템의 힌트 에이전트는 4단계 소크라테스식 체인을 따른다.

1. **정의 질문** — "지금 해결하려는 문제가 정확히 뭐라고 생각해?"
2. **가정 질문** — "이 루프가 몇 번 도는지 어떻게 확신해?"
3. **증거 질문** — "n=0일 때 이 코드는 어떻게 동작하지?"
4. **대안 질문** — "다른 방식은 없을까?"

답변형 힌트는 **4단계 이후에만**, 그것도 *학생의 명시적 요청이 있을 때*만 제공한다.

### 2.4 Scaffolding과 Fading

Vygotsky의 근접발달영역(ZPD) 개념에 따라, 에이전트의 개입 강도는 학생 숙련도에 따라 **페이딩(fading)**되어야 한다. 숙련도가 낮을수록 힌트 세분화↑, 높을수록 에이전트 침묵 유지.

---

## 3. 학생용 에이전트 UX 설계 심화

### 3.1 3-패널 레이아웃 (참고자료의 확장)

참고자료의 "좌: 문제 / 중: 코드 / 우: AI 패널" 구조를 유지하되 다음을 추가한다.

```
┌─────────────────┬─────────────────────────┬──────────────────┐
│ 문제 설명       │ Monaco C 에디터         │ AI 협력 패널     │
│ - 학습 목표     │ - 실행(WASM)             │ [대화 탭]        │
│ - 입출력 예시   │ - 단위테스트 결과        │ [힌트 탭]        │
│ - 관련 KC       │ - 에러 하이라이팅        │ [리플렉션 탭]    │
│ - 제약사항      │ - AI 제안 diff 뷰        │ [코드리뷰 탭]    │
└─────────────────┴─────────────────────────┴──────────────────┘
  하단 스테이터스 바: 현재 KC 숙련도 · AI 개입 수준 · 경과 시간 · 자기 평가 버튼
```

- **Monaco Editor** for C 문법 하이라이팅/LSP 연동 ([monaco-editor/react](https://www.npmjs.com/package/@monaco-editor/react))
- **AI 제안 diff 뷰**: Replace 대신 Monaco `deltaDecorations`로 *inline suggestion* 표시 → 학생이 수락/비교/무시 선택
- **Code-first 게이트**: 학생이 최소 1회 직접 코드를 작성하거나 실행하기 전에는 AI 패널이 정답형 응답을 생성하지 않고, 문제 재진술·계획 점검 질문만 제공
- **제안 적용 이유 입력**: 학생이 AI diff를 수락하려면 "이 수정이 왜 필요한가?"를 1~2문장으로 먼저 설명해야 하며, 이 자기 설명은 로그에 저장

### 3.2 상호작용 모드 스위치

우측 패널 상단에는 **AI 개입 수준 스위치**가 있다.

- 🟢 **조용히(Silent)** — 요청하기 전까지 AI는 말하지 않음
- 🟡 **관찰자(Observer)** — 명백한 오류만 지적
- 🟠 **페어(Pair)** — 기본값. 힌트 및 질문 제공
- 🔴 **튜터(Tutor)** — 개념 설명·예시 코드까지 제공 (시험 불가 모드)

교사는 반 전체/개별 학생의 모드를 **강제(lock)**할 수 있으며, 대시보드에서는 이를 `약·중·강` 개입 프리셋으로 묶어 운영한다.

### 3.3 점진적 힌트 UI

힌트 버튼은 단일 버튼이 아니라 "계단식"이며, `attemptCount`, `errorType`, `stagnationSec` 신호에 따라 단계가 열린다.

```
[ 약한 힌트 ]   <- 방향만 제시 (질문 형태)
   ↓ (요청 시)
[ 중간 힌트 ]   <- 관련 개념 설명
   ↓ (요청 시)
[ 강한 힌트 ]   <- 의사코드 제공
   ↓ (요청 시, 그리고 3회 실패 이후에만)
[ 코드 예시 ]   <- 실제 코드 스니펫 (학생 코드에 직접 삽입 불가)
```

각 단계 요청은 **Student Model에 기록**되어 KC 숙련도 감점 요인이 된다(평가 시 참조).

- 동일 오류가 반복되면 단순 정답 대신 해당 오류 범주의 개념 설명이 먼저 열린다.
- 의사코드는 로직 정체가 지속되거나 3회 이상 시도 실패가 누적될 때만 제공한다.
- 예시 코드는 학생이 자신의 해결 전략 또는 막힌 이유를 설명한 뒤에만 노출한다.
- 초보자 모드에서는 한 턴에 1~2개의 피드백만 제시해 인지적 부담을 줄인다.

### 3.4 리플렉션(메타인지) 루프

과제 제출 전 반드시 **리플렉션 탭**을 통과해야 한다.

- "이 코드에서 가장 어려웠던 부분은?"
- "AI의 어떤 힌트가 결정적이었나?"
- "왜 그렇게 생각했는가?"
- "가능했던 두 가지 해결안은 무엇이었고, 왜 이 방식을 선택했는가?"
- "다음에 비슷한 문제를 만나면 어떻게 접근하겠나?"

이 응답은 학생 모델 및 교사 대시보드로 전송된다.

---

## 4. 교사 대시보드 심화 설계

참고자료의 "컨트롤 타워" 비전을 **실시간·실행 가능(actionable)**한 형태로 확장한다.

### 4.1 3단 뷰 구조

| 뷰 | 목적 | 갱신 주기 |
|---|---|---|
| **Classroom View** | 반 전체 상태 오버뷰 (히트맵) | 실시간 (SSE) |
| **Student View** | 개별 학생 상세 진행·대화 로그 | 실시간 |
| **Assignment View** | 과제별 공통 오답·KC 분석 | 5분 주기 배치 |

### 4.2 주요 위젯

1. **Progress Overview** — 과제별 완료율, 미제출자, 현재 평균 진행률
2. **Heatmap of Struggle** — 학생×KC 매트릭스. 붉을수록 오류 빈도↑, 셀 툴팁에는 정체 시간과 최근 오류 유형 표시
3. **Intervention Queue** — AI가 "교사 개입 필요"로 플래그한 학생 목록 (정체 시간, 힌트 요청 급증, AI 의존도 상승, 복붙 패턴 감지)
4. **Live Code Stream** — 선택한 학생의 에디터를 실시간 관찰(읽기 전용)
5. **AI Usage Monitor** — 힌트 요청 빈도, 개입 수준 분포, AI 제안 수락률, 자기 설명 완료율
6. **Common Misconception Panel** — Evaluator Agent가 집계한 반 전체의 반복 오류 패턴과 취약 KC

### 4.3 교사 개입 도구

- 🔔 개별 학생에게 쪽지 보내기(풀스크린 오버레이 가능)
- 🔒 AI 개입 수준 강제 변경 (약/중/강 또는 시험 중 🟢 잠금)
- 🎯 과제 난이도/제약 실시간 수정(패치 배포)
- 📝 직접 힌트 작성하여 주입(학생에게는 AI 힌트와 구분되어 표시)
- 📣 공통 오류와 취약 개념을 수업 피드백 카드로 묶어 전체 공지

### 4.4 xAPI 기반 이벤트 스트림

모든 상호작용은 [xAPI](https://www.lambdasolutions.net/en/blog/learning-analytics-what-is-xapi-and-lrs-how-do-they-support-data-analytics-reporting) 스테이트먼트 형식으로 저장한다.

```json
{
  "actor": { "account": { "name": "student_042" } },
  "verb": { "id": "https://cvibe.app/verbs/requested-hint" },
  "object": { "id": "https://cvibe.app/kc/pointer-arithmetic" },
  "result": { "extensions": { "hintLevel": "weak", "attemptNo": 3 } },
  "timestamp": "2026-04-20T10:22:11Z"
}
```

핵심 이벤트는 `compile_error`, `runtime_error`, `stagnation`, `hint_request`, `ai_suggestion_accept`, `self_explanation_submitted`를 포함하며, 이 조합으로 교사 개입 필요 여부를 판정한다.

이를 통해 외부 LRS(Learning Record Store)와 연동 가능하며, 추후 연구용 데이터셋 공개도 용이하다.

---

## 5. 멀티 에이전트 시스템 아키텍처

### 5.1 왜 멀티 에이전트인가?

단일 LLM 프롬프트로 "문제 출제·힌트·리뷰·평가"를 모두 처리하면 다음 문제가 발생한다.

- **역할 충돌** — 평가자가 힌트를 주면 학생은 평가를 길들이게 된다.
- **맥락 오염** — 긴 시스템 프롬프트는 모델 집중도를 떨어뜨린다.
- **통제·감사 곤란** — 무엇이 어떤 역할로 작동했는지 로그에서 구분 불가.

LangGraph·Claude Agent SDK 기반의 **supervisor + 전문가 에이전트** 패턴이 정답이다 ([LangChain LangGraph](https://www.langchain.com/langgraph), [LangGraph Multi-Agent Tutorial](https://blog.futuresmart.ai/multi-agent-system-with-langgraph)).

### 5.2 에이전트 카탈로그

| 에이전트 | 역할 | 모델 선택 | 접근 권한 |
|---|---|---|---|
| **Supervisor** | 사용자 발화를 분류해 적절한 전문가로 라우팅 | Haiku 4.5 (저지연 분류) | 상태 읽기/쓰기 |
| **Problem Architect** | 과제 생성·변형·난이도 조절 | Opus 4.7 (창의적 생성) | 교사 전용 |
| **Pedagogy Coach** | Socratic 힌트 생성·페이싱 | Sonnet 4.6 | 학생 상태/대화 |
| **Code Reviewer** | 정적 분석·스타일·메모리 안전성 지적 | Sonnet 4.6 + tools | 학생 코드 |
| **Runtime Debugger** | 실행 결과·에러 메시지 해석 | Haiku 4.5 | WASM 실행 결과 |
| **Assessment** | 자동 채점·루브릭 평가·리플렉션 점수화 | Sonnet 4.6 | 제출물·루브릭 |
| **Student Modeler** | KC 숙련도 갱신·과의존 탐지 | Sonnet 4.6 (배치) | DB 쓰기 |
| **Teacher Copilot** | 대시보드 요약·개입 추천 | Opus 4.7 | 전체 집계 데이터 |
| **Safety Guard** | 답 유출 방지·부적절 발화 필터 | Haiku 4.5 | 모든 인/아웃바운드 |

### 5.3 오케스트레이션 그래프 (개념 다이어그램)

```
                      ┌───────────────┐
   학생 발화 ───▶    │  Supervisor   │    ◀─── 교사 명령
                      └───────┬───────┘
          ┌──────────┬────────┼────────┬───────────┐
          ▼          ▼        ▼        ▼           ▼
     Pedagogy   CodeReviewer  Runtime  Assessment  ProblemArchitect
       Coach     ─── tool ──▶  Debugger
          │          │         │         │
          ▼          ▼         ▼         ▼
              (공유 상태: Student Model + Conversation Log)
                             │
                             ▼
                      Student Modeler (비동기)
                             │
                             ▼
                      Teacher Copilot ──▶ 대시보드
                             │
                             ▼
          모든 I/O 경로에 Safety Guard 필터
```

### 5.4 상태 공유 설계

LangGraph의 **shared state** 패턴을 차용한다.

```ts
type SessionState = {
  studentId: string
  assignmentId: string
  currentKC: string[]
  mastery: Record<string, number>  // 0..1
  learningSignals: {
    attemptCount: number
    errorTypes: string[]
    repeatedErrorCount: number
    stagnationSec: number
    hintRequests: number
    aiDependencyScore: number
  }
  dependency: {
    hintRequests: number
    acceptedAIBlocks: number
    rejectedAIBlocks: number
  }
  conversation: Message[]
  editorSnapshot: { files: File[]; cursor: Position }
  interventionFlags: string[]
  supportLevel: 0 | 1 | 2 | 3
  selfExplanationRequired: boolean
  teacherInterventionLevel: "weak" | "medium" | "strong"
  mode: "silent" | "observer" | "pair" | "tutor"
}
```

- **불변 업데이트** — 각 에이전트는 state의 *delta*만 반환.
- **낙관적 잠금** — 동시 수정 시 Supervisor가 머지.
- **Persist 경계** — 매 턴 종료 시 Postgres(Supabase)에 직렬화 저장.

### 5.5 에이전트별 시스템 프롬프트 골격 (요약)

#### Pedagogy Coach
```
You are a Socratic programming tutor for a CS1 student learning C.
Require the student to attempt code first, then give feedback.
Gate all help in this order: hint -> concept -> pseudocode -> example code.
NEVER write runnable code unless the student has explicitly requested
"Level 4 hint" AND has made ≥3 attempts. Prefer questions over answers.
When the student asks the AI to "solve it", redirect by asking them to
decompose the problem into sub-problems first.
Before the student accepts an AI suggestion, ask them to explain why it
should work. Frequently ask "Why do you think that?" and request a brief
comparison of alternative approaches when feasible.
```

#### Code Reviewer
```
Review the student's C code. Focus on:
(1) correctness vs the assignment spec
(2) undefined behavior, memory safety
(3) style (naming, indentation per course style guide)
Return findings as structured JSON { severity, line, kc, suggestion }.
For novice students, chunk feedback into the top 1-2 issues first.
DO NOT propose replacement code unless severity == "blocker".
```

#### Teacher Copilot
```
Summarize whole-class progress and individual risk states.
Recommend intervention levels as weak, medium, or strong based on
error frequency, stagnation time, hint requests, and AI dependency.
Aggregate common misconceptions into class feedback topics.
```

#### Assessment
```
Grade the submission against the rubric. Produce:
- rubric scores (0..n per criterion)
- evidence citations (line ranges)
- KC mastery delta (+/- per tagged KC)
- an "AI dependency" factor derived from the hint request log
Be conservative: prefer underscoring dependence rather than accusing.
```

### 5.6 도구(tool) 정의

각 에이전트에 노출되는 tool 함수(예시).

| Tool | 에이전트 | 설명 |
|---|---|---|
| `runC(code, stdin)` | Runtime Debugger, Assessment | WASM 빌드/실행 결과 반환 |
| `lintC(code)` | Code Reviewer | clang-tidy(WASM) 결과 반환 |
| `searchKC(query)` | Pedagogy Coach | 도메인 지식 그래프 검색 |
| `recordLearningSignal(event)` | Supervisor, Student Modeler | 시도 횟수, 오류 유형, 정체 시간, 힌트 요청 수 저장 |
| `updateMastery(kc, delta, reason)` | Student Modeler | 숙련도 갱신 |
| `requireRationale(suggestionId)` | Pedagogy Coach | AI 제안 적용 전 학생 자기 설명 요구 |
| `flagTeacher(studentId, reason)` | 모두 | 교사 개입 큐에 추가 |
| `genProblem(kc, difficulty, seed)` | Problem Architect | 과제 템플릿 생성 |
| `gradeAgainstRubric(submission, rubric)` | Assessment | 루브릭 자동 채점 |

### 5.7 Safety Guard의 역할

- **답 유출 차단** — 평가 중인 과제의 정답 코드를 Pedagogy Coach가 뱉지 않도록 출력 정규식 + LLM 분류기 이중 검증.
- **프롬프트 인젝션** — 학생 코드의 주석이 시스템 프롬프트를 오염시키지 않도록 격리.
- **부적절 발화 필터** — 욕설/개인정보.

---

## 6. 문제 출제·평가 파이프라인 상세

### 6.1 문제 출제 (Problem Architect)

10개 과제 각각에 대해 **템플릿 + 파라미터화** 구조로 정의한다.

```yaml
assignment_id: A03_arrays_basic
kc_tags: [arrays, indexing, bounds-checking]
difficulty: 2
template: |
  Given an array of {N} integers...
params:
  N: [5, 7, 10]
variants: 6   # Problem Architect가 시드로 N을 흔들어 다른 문제 파생
rubric:
  correctness: 0.5
  style: 0.15
  memory_safety: 0.2
  reflection: 0.15
reference_solution: ...  # Safety Guard가 학생에 유출되지 않도록 보호
```

변형(variants)은 **표절·공유 방지**와 **재응시** 용으로 쓰인다.

### 6.2 자동 평가 흐름

1. 학생 제출 → Runtime Debugger가 **숨겨진 테스트셋**으로 실행 → 통과/실패/런타임 에러 분류
2. Code Reviewer가 정적 분석 수행 (memory leak, UB)
3. Assessment가 루브릭별 점수 통합 + LLM 판정 설명
4. Student Modeler가 KC 숙련도 갱신
5. Teacher Copilot이 대시보드 요약 재생성

### 6.3 AI 의존도 지표 (Dependency Factor)

다음을 가중합하여 **0~1 값**으로 계산.

- 강한 힌트/코드 예시 요청 횟수
- AI 제안을 *비교 없이 수락*한 비율
- 대화당 질문 깊이(follow-up 수)
- 리플렉션 품질 점수(Assessment 자체 평가)

의존도가 높으면 최종 점수에 감점은 **주지 않고**, 교사에게만 표시한다(낙인 방지, [Springer 10.1007/s10639-024-12523-3](https://link.springer.com/article/10.1007/s10639-024-12523-3) 권고).

### 6.4 교사 개입 트리거

다음 조합 중 하나라도 충족하면 Teacher Copilot이 교사 큐에 개입 권고를 올린다.

- 동일 오류 3회 이상 반복 + 정체 시간 10분 이상
- 강한 힌트 또는 예시 코드 요청이 짧은 시간 안에 누적
- AI 제안 연속 수락 + 이유 설명의 질 저하
- 리플렉션 누락 또는 대안 비교 회피가 반복

개입 권고는 `weak`, `medium`, `strong` 세 단계로 제시하며, 교사는 이를 그대로 적용하거나 수동 조정할 수 있다.

---

## 7. 기술 스택 선정 및 근거

### 7.1 전체 스택

| 레이어 | 선택 | 근거 |
|---|---|---|
| 프런트엔드 | **Next.js 15 App Router + React 19** | Vercel과 1급 호환, RSC로 LLM 스트리밍 최적 |
| 에디터 | **@monaco-editor/react** | VS Code와 동일 엔진, Next.js에서 `dynamic()`로 로드 |
| C 실행 | **Emscripten → WASM + clang.wasm** | 서버 비용 0, 학생 브라우저 내 격리 실행 |
| 백업 실행 | **Judge0 API** (선택) | 복잡한 과제용 서버 실행 fallback |
| AI Orchestration | **Vercel AI SDK 5 + Claude Agent SDK (TS)** | 스트리밍·tool calling·prompt caching 기본 지원 |
| 모델 라우팅 | **Vercel AI Gateway** | Opus/Sonnet/Haiku 단일 인터페이스 |
| DB/Auth | **Supabase (Postgres + Auth + Realtime)** | RLS로 학생 간 격리, Realtime으로 대시보드 live |
| 벡터 저장 | **Supabase pgvector** | KC 지식 그래프 RAG |
| 실시간 대시보드 | **Supabase Realtime + SSE** | xAPI 이벤트 fan-out |
| 분석 배치 | **Vercel Cron** + Edge Functions | Student Modeler 주기 실행 |
| 관측성 | **Vercel Observability + Langfuse(self-host)** | LLM 토큰·품질 모니터링 |

### 7.2 모델 선택 전략 (비용 최적화)

[Claude 가격 정책](https://platform.claude.com/docs/en/about-claude/pricing)에 따른 계층화.

- **Haiku 4.5**: 분류·필터·가벼운 요약 (Supervisor, Safety Guard, Runtime Debugger)
- **Sonnet 4.6**: 일상적 튜터링·리뷰·채점 (기본 엔진) — 70% 토큰 효율 향상을 근거로 주력 모델
- **Opus 4.7**: 과제 생성, 교사 Copilot 보고서 작성 (저빈도 고품질)

**Prompt caching**을 모든 에이전트 시스템 프롬프트에 적용 → 최대 90% 비용 절감 ([Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)).

**Batch API**는 야간 Student Modeler 업데이트에 활용 → 50% 추가 절감.

### 7.3 브라우저 내 C 실행 상세

- 초기 POC: **Emscripten**으로 `clang`·`lld`를 WASM으로 빌드 → Web Worker에서 컴파일+실행
- 대안: [twr-wasm](https://github.com/twiddlingbits/twr-wasm)은 경량화 가능
- 표준 입출력은 MessageChannel로 라우팅
- 실행 타임아웃(2s) + 메모리 상한(64MB)으로 샌드박싱
- 서버 의존 제로 → Vercel 비용 최소화의 핵심

### 7.4 데이터 모델 (주요 테이블)

```sql
-- students
id uuid pk, email, cohort, created_at
-- assignments
id uuid pk, code, kc_tags jsonb, rubric jsonb, active bool
-- submissions
id uuid pk, student_id fk, assignment_id fk, code text,
  score jsonb, dependency_factor float, submitted_at
-- conversations
id uuid pk, student_id, assignment_id, messages jsonb, mode text
-- mastery
student_id, kc text, value float, updated_at  -- PK(student_id, kc)
-- events (xAPI)
id bigserial, actor jsonb, verb jsonb, object jsonb,
  result jsonb, timestamp timestamptz
-- interventions
id, student_id, teacher_id, type, payload jsonb, created_at
```

모든 테이블에 **RLS(Row Level Security)** 적용: 학생은 자기 것만, 교사는 담당 cohort만.

---

## 8. GitHub 및 Vercel 배포 전략

### 8.1 리포지터리 구조 (모노리포)

```
cvibe/
├── apps/
│   ├── student/         # Next.js — 학생 에디터/챗
│   ├── teacher/         # Next.js — 교사 대시보드
│   └── docs/            # 학습 가이드/교사 매뉴얼
├── packages/
│   ├── agents/          # Claude Agent SDK 정의 + 프롬프트
│   ├── shared-ui/       # 공용 컴포넌트 (shadcn/ui)
│   ├── db/              # Drizzle ORM 스키마 + 마이그레이션
│   ├── wasm-runtime/    # C→WASM 빌드·실행 래퍼
│   └── xapi/            # 이벤트 스테이트먼트 빌더
├── supabase/
│   └── migrations/
├── .github/workflows/
│   ├── ci.yml           # lint, typecheck, test
│   ├── e2e.yml          # Playwright
│   ├── deploy-preview.yml
│   └── deploy-prod.yml
├── turbo.json           # Turborepo
└── pnpm-workspace.yaml
```

**Turborepo + pnpm** 으로 병렬 빌드·캐시 공유.

### 8.2 브랜치/릴리스 전략

- `main` → Vercel Production
- `develop` → Vercel Preview (교사 내부 테스트)
- `feature/*` → Per-PR Preview URL

모든 PR은 다음 체크를 통과해야 merge.

1. **TypeScript strict + ESLint**
2. **Vitest unit** (에이전트 프롬프트 골든 테스트 포함)
3. **Playwright E2E** — "힌트 4단계까지 받는 학생 시나리오"
4. **Promptfoo** — 에이전트 출력의 교육적 적절성 회귀 테스트
5. **Lighthouse CI** — 에디터 페이지 LCP < 2.5s

### 8.3 Vercel 배포 구성

- **2개 Vercel 프로젝트**: `cvibe-student`, `cvibe-teacher` (권한·쿠키 도메인 분리)
- **공용 도메인 전략**: `student.cvibe.app`, `teacher.cvibe.app`
- **환경 변수**: Supabase URL/anon/service, Anthropic API key, AI Gateway endpoint
- **Preview Deployments**: 모든 PR에 unique URL. Supabase Redirect URLs에 와일드카드 설정 ([Supabase+Vercel guide](https://supabase.com/blog/using-supabase-with-vercel)).
- **리전**: Supabase 리전과 매칭(예: ap-northeast-2) — 레이턴시 최소화
- **Cron**: `/api/cron/student-modeler` 매 15분 실행
- **Edge vs Node**: LLM 스트리밍은 Edge, WASM 빌드·분석 배치는 Node runtime

### 8.4 CI/CD 파이프라인 (예시)

```yaml
# .github/workflows/deploy-prod.yml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck test
      - run: pnpm turbo run build
      - run: pnpm supabase db push
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: '--prod'
```

### 8.5 비밀관리 및 안전

- **API 키**는 절대 클라이언트 번들에 포함 금지 → Next.js Route Handler를 BFF로 사용
- Claude 호출은 항상 **서버 측에서만**, 학생 브라우저엔 streaming chunk만 전달
- Supabase **Service Role** 키는 서버 전용, 학생은 anon+JWT

### 8.6 관측성

- **Langfuse**(self-host on Supabase) — 프롬프트/응답/토큰/비용 추적
- **Vercel Analytics**(Web Vitals)
- **Sentry** — 프런트 에러 + 서버 에러
- **Supabase Logs** — DB 이상치

---

## 9. 리스크 및 완화 전략

| 리스크 | 영향 | 완화 |
|---|---|---|
| LLM이 정답 코드를 유출 | 평가 무력화 | Safety Guard + 평가 중엔 🔴 튜터 모드 비활성, 숨김 테스트셋 분리 |
| AI 의존 심화 | 학습 단절 | Dependency Factor 추적·리플렉션 강제·페이딩 UI |
| 브라우저 WASM 실행 실패 | 수업 중단 | Judge0 fallback + 교사 수동 채점 경로 |
| 토큰 비용 폭발 | 운영 불가 | Haiku 우선·prompt caching·대화 길이 상한·배치 분리 |
| 프롬프트 인젝션(학생 코드의 주석) | 시스템 탈취 | 에이전트 입력은 코드 블록으로 포장·Safety Guard 사전 검사 |
| 개인정보/FERPA 이슈 | 법적 리스크 | xAPI 이벤트 저장 시 PII 최소화, 데이터 주권 리전 고정 |
| 모델 업데이트로 행동 변화 | 교육적 일관성 붕괴 | 프롬프트 버전 고정·Promptfoo 회귀 테스트 |
| 부정행위(과제 공유) | 평가 왜곡 | Problem Architect variants + 편집 타임라인 분석 |

---

## 10. 평가 방법론 (시스템 자체의 효과 측정)

연구용으로 다음을 수집한다.

- **사전/사후 개념 테스트** — C 기초 개념 이해도
- **코드 품질 지표** — 평균 스타일 점수, 런타임 에러 빈도
- **학습 태도** — 자기효능감·몰입도 설문 (CS1 표준 척도)
- **AI 상호작용 품질** — 프롬프트의 계산 개념 포함 비율 변화
- **학습자 주도성 지표** — AI 도움 요청 전 자발적 코드 작성 비율, AI 제안 수락 전 자기 설명 완료율
- **지원 적응성 지표** — 시도 횟수·오류 유형·정체 시간에 따라 지원 단계가 적절히 조절되었는지
- **교사 개입 타당도 지표** — Intervention Queue 적중률, 공통 오류 기반 수업 피드백 후 개선 폭

비교군은 (1) 전통 IDE만 사용, (2) 일반 ChatGPT, (3) 본 시스템 3군 설계.

### 10.1 반복 개선 루프

운영은 일회성 배포가 아니라 다음 순환을 기본 단위로 삼는다.

1. 수업 적용
2. 로그 분석
3. 프롬프트·UI·피드백 규칙 수정
4. 다음 수업에 재배포

이 과정에서 효과가 검증된 프롬프트 템플릿, 개입 규칙, 대시보드 카드 구성은 **에이전트 설계 패턴 라이브러리**로 축적해 재사용한다.

---

## 11. 구현 로드맵 (12주 스프린트)

| 주차 | 마일스톤 | 산출물 |
|---|---|---|
| 1–2 | 모노리포 부트스트랩, Supabase 스키마, Monaco 통합 | `apps/student` Hello World |
| 3 | WASM C 실행 파이프라인 | 학생 페이지에서 C 코드 실행 |
| 4–5 | Supervisor + Pedagogy Coach 에이전트 MVP | Socratic 힌트 4단계 동작 |
| 6 | Code Reviewer + Runtime Debugger 추가 | 피드백 JSON 렌더 |
| 7 | Assessment + Student Modeler | 1차 자동 채점 |
| 8 | Problem Architect + 과제 10개 템플릿화 | 문제 카탈로그 |
| 9 | 교사 대시보드 v1 (Classroom/Student View) | Realtime heatmap |
| 10 | Safety Guard, Dependency Factor, 리플렉션 | 안전장치 완성 |
| 11 | E2E·Promptfoo·Lighthouse CI 구축 | 초록불 배포 |
| 12 | 교사 매뉴얼, 파일럿 수업 1회, 로그 분석 회고 | 운영 가이드 v1 + 설계 패턴 초안 |

---

## 12. 개방된 연구 질문

1. **페이딩의 최적 곡선** — 어떤 숙련도 임계치에서 개입을 줄여야 하는가?
2. **Socratic 힌트의 문화적 적응** — 한국어 CS1 맥락에서 효과적인 질문 형식?
3. **멀티 에이전트 vs 단일 대형 프롬프트** — 교육 효과 차이의 정량 측정
4. **교사 Copilot의 신뢰도** — 교사가 AI 개입 추천을 따르는/무시하는 패턴 분석
5. **의존도 지표의 타당도** — Dependency Factor가 실제 학습 단절과 상관관계가 있는가?

---

## 13. 결론

본 시스템의 본질은 *코딩 도구*가 아니라 **"학습자 주도성, 단계적 지원, 협력적 사고, 데이터 기반 개입, 교사 오케스트레이션을 함께 구현하는 교육용 다중 에이전트 플랫폼"**이다. 멀티 에이전트는 책임 분리를 통해 *답을 뱉는 조수*가 아니라 *사고를 되돌려주는 파트너*를 만드는 가장 현실적인 방법이며, Next.js/Vercel/Supabase/Claude Agent SDK 조합은 이를 **저비용·고가용성**으로 배포할 수 있는 현 시점 최선의 스택이다.

구현의 성공 지표는 LCP·응답 속도가 아니라 **"학생이 제출 전 스스로 한 번 더 생각하게 만들었는가, 그리고 그 흔적을 교사와 시스템이 다음 수업 개선에 다시 활용할 수 있는가"**이다.

---

## 참고문헌

### 교육학·ITS·평가
- [arXiv 2507.22614 — Exploring Student-AI Interactions in Vibe Coding](https://arxiv.org/abs/2507.22614)
- [arXiv 2506.23253 — Vibe coding: programming through conversation with AI](https://arxiv.org/abs/2506.23253)
- [arXiv 2602.01919 — Teaching NLP with LLM-Assisted Vibe Coding](https://arxiv.org/html/2602.01919v1)
- [arXiv 2504.20082 — Evolution of AI in Education: Agentic Workflows](https://arxiv.org/pdf/2504.20082)
- [arXiv 2507.18882 — A Comprehensive Review of AI-based ITS](https://arxiv.org/pdf/2507.18882)
- [arXiv 2508.16659 — Multi-Agent Systems as Learning Designers](https://arxiv.org/html/2508.16659)
- [arXiv 2409.16490 — Knowledge Tracing in Tutor-Student Dialogues using LLMs](https://arxiv.org/html/2409.16490v2)
- [arXiv 2405.04645 — Enhancing LLM-Based Feedback from ITS insights](https://arxiv.org/html/2405.04645v2)
- [arXiv 2303.08769 — Prompting LLMs with the Socratic Method](https://arxiv.org/pdf/2303.08769)
- [CACM Blog — How Can Vibe Coding Transform Programming Education?](https://cacm.acm.org/blogcacm/how-can-vibe-coding-transform-programming-education/)
- [Stanford Online — Vibe Coding: Using AI for Programming](https://online.stanford.edu/courses/csp-xtech36-vibe-coding-using-ai-programming)
- [Springer — AI in Education meta-review (10.1007/s10639-024-12523-3)](https://link.springer.com/article/10.1007/s10639-024-12523-3)
- [MDPI Applied Sciences — Adaptive Multi-Agent ITS on Moodle](https://www.mdpi.com/2076-3417/16/3/1323)
- [Wikipedia — Vibe coding](https://en.wikipedia.org/wiki/Vibe_coding)
- [Addy Osmani — Vibe coding vs AI-Assisted engineering](https://addyo.substack.com/p/vibe-coding-is-not-the-same-as-ai)

### 멀티 에이전트 아키텍처
- [LangChain — LangGraph overview](https://www.langchain.com/langgraph)
- [Latenode — LangGraph Multi-Agent Orchestration 2025](https://latenode.com/blog/ai-frameworks-technical-infrastructure/langgraph-multi-agent-orchestration/langgraph-multi-agent-orchestration-complete-framework-guide-architecture-analysis-2025)
- [FutureSmart — Multi-Agent System Tutorial with LangGraph](https://blog.futuresmart.ai/multi-agent-system-with-langgraph)
- [Google Codelabs — Aidemy multi-agent](https://codelabs.developers.google.com/aidemy-multi-agent/instructions)

### 기술 스택
- [Vercel AI SDK docs](https://ai-sdk.dev/docs/introduction)
- [Vercel KB — How to build AI Agents with Vercel and the AI SDK](https://vercel.com/kb/guide/how-to-build-ai-agents-with-vercel-and-the-ai-sdk)
- [vercel/chatbot — Next.js AI Chatbot](https://github.com/vercel/chatbot)
- [Claude Agent SDK — TypeScript reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude Sonnet 4.6 product page](https://www.anthropic.com/claude/sonnet)
- [Supabase + Vercel integration](https://supabase.com/blog/using-supabase-with-vercel)
- [Supabase & Next.js App Router Starter](https://vercel.com/templates/next.js/supabase)
- [@monaco-editor/react](https://www.npmjs.com/package/@monaco-editor/react)
- [Deno — Monaco + Next.js securely running untrusted code](https://deno.com/blog/monaco-nextjs)
- [MDN — Compiling C/C++ to WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly/Guides/C_to_Wasm)
- [twr-wasm — lightweight C→WASM](https://github.com/twiddlingbits/twr-wasm)

### 학습 분석·xAPI
- [Lambda Solutions — xAPI & LRS basics](https://www.lambdasolutions.net/en/blog/learning-analytics-what-is-xapi-and-lrs-how-do-they-support-data-analytics-reporting)
- [MDPI Sensors — Real-Time Learning Analytics Dashboard](https://www.mdpi.com/1424-8220/23/9/4243)
- [8allocate — AI Learning Analytics Dashboards](https://8allocate.com/blog/ai-learning-analytics-dashboards-for-instructors-turning-data-into-actionable-insights/)

### 참고자료
- 프로젝트 원 초안: [참고자료.txt](참고자료.txt)
