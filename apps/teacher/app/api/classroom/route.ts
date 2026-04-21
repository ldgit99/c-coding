import { NextResponse } from "next/server";

import {
  aggregateMisconceptions,
  buildInterventionQueue,
  summarizeClassroom,
  type StudentData,
} from "@cvibe/agents";
import {
  DEMO_COHORT_ID,
  createServiceRoleClientIfAvailable,
  fetchClassroomData,
} from "@cvibe/db";

/**
 * GET /api/classroom — Classroom / Intervention Queue / Misconceptions 집계.
 *
 * Supabase env가 설정돼 있으면 fetchClassroomData가 실 DB에서 profiles·mastery·
 * misconceptions·submissions 4-join을 수행하고, 없으면 DEMO_STUDENTS mock으로
 * fallback. source 필드로 어느 경로였는지 알려준다.
 */
export async function GET() {
  const supabase = createServiceRoleClientIfAvailable();
  const { students, source } = await fetchClassroomData(supabase, DEMO_COHORT_ID);

  const cohortStudents = students as unknown as StudentData[];

  return NextResponse.json({
    cohortId: DEMO_COHORT_ID,
    summary: summarizeClassroom(cohortStudents, DEMO_COHORT_ID),
    interventionQueue: buildInterventionQueue(cohortStudents, DEMO_COHORT_ID),
    misconceptions: aggregateMisconceptions(cohortStudents, DEMO_COHORT_ID),
    source,
    generatedAt: new Date().toISOString(),
  });
}
