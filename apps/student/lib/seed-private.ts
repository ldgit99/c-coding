import { getAssignmentByCode } from "@cvibe/db";

/**
 * Hidden tests + reference solution 로더.
 *
 * Single source of truth: `packages/db/src/seeds/assignments.ts` 안의
 * `hiddenTests` · `referenceSolution` 필드. `supabase/seed-private/*` 파일은
 * `pnpm --filter @cvibe/db seed:export` 로 자동 재생성되는 사본일 뿐이다.
 *
 * 과거에는 파일 시스템에서 읽었으나 과제 스펙 변경 시 파일 싱크가 빠지면
 * '정답인데 0%' 버그 유발 → 2026-04 이후 in-memory ASSIGNMENTS 기준으로 통일.
 */

export interface HiddenTestSpec {
  id: number;
  input: string;
  expected: string;
}

/**
 * 해당 과제의 hidden test 케이스 반환. 카탈로그에 없거나 hiddenTests 가 비어
 * 있으면 null — /api/submit 이 hiddenTestResults 를 undefined 로 넘겨 Assessment
 * 가 correctness=null 로 처리하도록.
 */
export async function loadHiddenTests(assignmentCode: string): Promise<HiddenTestSpec[] | null> {
  const asg = getAssignmentByCode(assignmentCode);
  if (!asg || !asg.hiddenTests || asg.hiddenTests.length === 0) return null;
  return asg.hiddenTests.map((t) => ({ id: t.id, input: t.input, expected: t.expected }));
}

/**
 * Reference solution 반환. Safety Guard 유사도 검사에 사용. 학생 응답에는
 * 절대 포함되지 않음 (`/api/chat` 이 `referenceSolution` 를 payload 에 넣지
 * 않고 `checkSafety` 에만 전달).
 */
export async function loadReferenceSolution(assignmentCode: string): Promise<string | null> {
  const asg = getAssignmentByCode(assignmentCode);
  if (!asg || !asg.referenceSolution) return null;
  return asg.referenceSolution;
}
