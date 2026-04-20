# supabase/seed-private/

각 과제의 **참고 솔루션**(C 소스)과 **hidden tests**(JSON).

⚠️ **절대 커밋 금지 영역이었으나** 파일럿 단계에서는 repo 내부로 가져와
   테스트·리뷰 편의를 우선한다. 프로덕션 배포 전에는 다음 중 하나를 수행:

1. **Git에서 제거** → Vercel Blob Storage / Supabase Storage로 이전 후 CI에서 fetch
2. **.gitignore에 추가**해 로컬에만 두기 (seed 스크립트가 읽어 DB에 insert)

Safety Guard가 `packages/agents/src/runtime/safety-guard.ts`의 Jaccard 유사도
임계(0.7)로 학생 경로 outbound에서 참고 솔루션 누출을 차단한다. 유출 검사
테스트를 반드시 Promptfoo 또는 Playwright로 회귀 등록할 것.

## 구조

```
supabase/seed-private/
├── A01_ref.c       # 참고 솔루션 (C 소스)
├── A01_hidden.json # hidden tests [{ id, input, expected }]
├── A02_ref.c
├── A02_hidden.json
...
```

## 파일럿 체크리스트

- 실행 테스트: 각 `A0X_ref.c`를 Judge0 또는 로컬 gcc로 컴파일해서
  `A0X_hidden.json`의 모든 input에 대해 expected와 일치하는지 확인
  (최소 1회 수동 검증 후 CI로 편입)
- Safety Guard 회귀: `/api/chat` 응답이 ref 유사도 검사에서 걸리는 시나리오
  Promptfoo에 추가
