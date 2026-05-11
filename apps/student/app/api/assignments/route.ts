import { NextResponse } from "next/server";

import {
  ASSIGNMENTS,
  getLearningObjectives,
  pickVariantIndex,
  resolveUserFromRequest,
} from "@cvibe/db";

/**
 * GET /api/assignments — 학생에게 노출 가능한 과제 목록.
 *
 * 각 과제에 `variantCount`와 이 학생이 받을 `variantIndex`를 결정적으로
 * 계산해 포함한다. 학생 재접속·새로고침·재평가 모두 같은 variant를
 * 받도록 FNV-1a 해시 기반(`packages/db/src/variant-assignment.ts`).
 * Week 10+에 실제 `assignment_variants` 테이블 연결 시에도 같은 규칙을
 * 공유한다.
 *
 * catalog-rev: 2026-05-12 A02 교체 (포인터 swap → 포인터 순회 + max/min).
 */
export async function GET(request: Request) {
  const user = resolveUserFromRequest(request, { preferredRole: "student" });

  const publicView = ASSIGNMENTS.map((a) => {
    const variantCount = a.variantCount ?? 1;
    const variantIndex = pickVariantIndex({
      studentId: user.id,
      assignmentCode: a.code,
      variantCount,
    });
    return {
      code: a.code,
      title: a.title,
      template: a.template,
      kcTags: a.kcTags,
      difficulty: a.difficulty,
      rubric: a.rubric,
      constraints: a.constraints,
      starterCode: a.starterCode,
      visibleTests: a.visibleTests,
      reflectionPrompts: a.reflectionPrompts,
      learningObjectives: getLearningObjectives(a.kcTags, 2),
      variantCount,
      variantIndex,
    };
  });
  return NextResponse.json({ assignments: publicView });
}
