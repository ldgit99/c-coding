import { NextResponse } from "next/server";

import {
  aggregateMisconceptions,
  buildInterventionQueue,
  summarizeClassroom,
} from "@cvibe/agents";
import { DEMO_COHORT_ID, DEMO_STUDENTS } from "@cvibe/db";

/**
 * GET /api/classroom — Classroom / Intervention Queue / Misconceptions 집계.
 * Week 9 MVP: DEMO_STUDENTS 정적 mock. Week 10에 Supabase 쿼리로 교체.
 */
export async function GET() {
  return NextResponse.json({
    cohortId: DEMO_COHORT_ID,
    summary: summarizeClassroom(DEMO_STUDENTS, DEMO_COHORT_ID),
    interventionQueue: buildInterventionQueue(DEMO_STUDENTS, DEMO_COHORT_ID),
    misconceptions: aggregateMisconceptions(DEMO_STUDENTS, DEMO_COHORT_ID),
    generatedAt: new Date().toISOString(),
  });
}
