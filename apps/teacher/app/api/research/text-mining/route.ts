import { NextResponse } from "next/server";

import {
  DEMO_COHORT_ID,
  createServiceRoleClientIfAvailable,
  fetchAnalyticsFromDb,
  fetchClassroomData,
} from "@cvibe/db";
import {
  bootstrapCI,
  classifyHelpSeeking,
  classifyTerminative,
  codeSwitchProfile,
  computeTextMiningProfile,
  describe as describeStats,
  discourseMarkerProfile,
  hashLearnerId,
  helpSeekingDistribution,
  isRealUtterance,
  mtldFromUtterances,
  terminativeDistribution,
  type DiscourseCategory,
  type HelpSeekingStrategy,
  type TerminativeEnding,
} from "@cvibe/xapi";

/**
 * GET /api/research/text-mining
 *
 * Paper 6 — Korean CS1 Discourse Patterns.
 *
 * 5 figures 의 raw + summary 를 한 번에 반환:
 *   F1 종결어미 분포 (cohort + per-student)
 *   F2 코드-스위칭 (cohort + per-student) + 주차별 trajectory
 *   F3 MTLD per student
 *   F4 Help-seeking instrumental vs executive
 *   F5 Discourse marker 빈도
 *
 * 표본·재현성 메타데이터 + bootstrap 95% CI 동봉.
 */

interface PerStudent {
  studentIdHashed: string;
  utteranceCount: number;
  terminative: Record<TerminativeEnding, number>;
  helpSeeking: Record<HelpSeekingStrategy, number>;
  helpSeekingInstrumentalShare: number;
  codeSwitchRate: number;
  mtld: number;
  discourseMarkersPerUtterance: number;
  discourseByCategory: Record<DiscourseCategory, number>;
}

export async function GET() {
  const supabase = createServiceRoleClientIfAvailable();
  const { students, source } = await fetchClassroomData(supabase, DEMO_COHORT_ID);

  // 7일 윈도우 — paper 분석은 좁은 범위가 reproducibility 에 유리.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let allTurns: Array<{
    studentId: string;
    text: string;
    timestamp: string;
  }> = [];

  if (supabase && students.length > 0) {
    const bundle = await fetchAnalyticsFromDb({
      client: supabase,
      studentIds: students.map((s) => s.id),
      since,
      turnLimit: 8000,
      eventLimit: 1,
    });
    for (const t of bundle.turns) {
      if (t.role !== "student") continue;
      if (!isRealUtterance(t.text)) continue;
      allTurns.push({
        studentId: t.studentId,
        text: t.text,
        timestamp: t.timestamp,
      });
    }
  }

  const utteranceByStudent = new Map<string, string[]>();
  const tsByStudent = new Map<string, string[]>();
  for (const t of allTurns) {
    const arr = utteranceByStudent.get(t.studentId) ?? [];
    arr.push(t.text);
    utteranceByStudent.set(t.studentId, arr);
    const ts = tsByStudent.get(t.studentId) ?? [];
    ts.push(t.timestamp);
    tsByStudent.set(t.studentId, ts);
  }

  // ----- per-student profile -----
  const perStudent: PerStudent[] = [];
  for (const s of students) {
    const utters = utteranceByStudent.get(s.id) ?? [];
    if (utters.length === 0) continue; // research 분석에서는 발화 0 제외
    const profile = computeTextMiningProfile(utters);
    perStudent.push({
      studentIdHashed: hashLearnerId(s.id),
      utteranceCount: utters.length,
      terminative: {
        interrogative: profile.terminative.interrogative,
        assertive: profile.terminative.assertive,
        hedge: profile.terminative.hedge,
        directive: profile.terminative.directive,
        none: profile.terminative.none,
      } as Record<TerminativeEnding, number>,
      helpSeeking: {
        instrumental: profile.helpSeeking.instrumental,
        executive: profile.helpSeeking.executive,
        other: profile.helpSeeking.other,
      } as Record<HelpSeekingStrategy, number>,
      helpSeekingInstrumentalShare: Number(
        profile.helpSeeking.instrumentalShare.toFixed(3),
      ),
      codeSwitchRate: Number(profile.codeSwitch.codeSwitchRate.toFixed(3)),
      mtld: Number(profile.mtld.score.toFixed(2)),
      discourseMarkersPerUtterance: Number(
        profile.discourse.markersPerUtterance.toFixed(3),
      ),
      discourseByCategory: {
        inference: profile.discourse.byCategory.inference,
        contrast: profile.discourse.byCategory.contrast,
        hypothesis: profile.discourse.byCategory.hypothesis,
        sequence: profile.discourse.byCategory.sequence,
        reflection: profile.discourse.byCategory.reflection,
      },
    });
  }
  perStudent.sort((a, b) => b.utteranceCount - a.utteranceCount);

  // ----- cohort aggregates -----
  const cohortUtterances = allTurns.map((t) => t.text);
  const cohortTerminative = terminativeDistribution(cohortUtterances);
  const cohortHelpSeeking = helpSeekingDistribution(cohortUtterances);
  const cohortCodeSwitch = codeSwitchProfile(cohortUtterances);
  const cohortDiscourse = discourseMarkerProfile(cohortUtterances);
  const cohortMtld = mtldFromUtterances(cohortUtterances);

  // ----- bootstrap 95% CI for key per-student metrics -----
  const codeSwitchRates = perStudent.map((p) => p.codeSwitchRate);
  const instrumentalShares = perStudent.map((p) => p.helpSeekingInstrumentalShare);
  const mtldScores = perStudent.map((p) => p.mtld);
  const discourseRates = perStudent.map((p) => p.discourseMarkersPerUtterance);

  const meanFn = (xs: number[]) =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

  const cis = {
    codeSwitchRate: bootstrapCI(codeSwitchRates, meanFn, { iterations: 2000, seed: 42 }),
    instrumentalShare: bootstrapCI(instrumentalShares, meanFn, { iterations: 2000, seed: 42 }),
    mtld: bootstrapCI(mtldScores, meanFn, { iterations: 2000, seed: 42 }),
    discourseMarkersPerUtterance: bootstrapCI(discourseRates, meanFn, {
      iterations: 2000,
      seed: 42,
    }),
  };

  // ----- F2 — 일자별 코드-스위칭 trajectory (cohort 평균) -----
  // 7일을 일 단위 7 bin 으로 나눠 그날 발화 전체로 codeSwitchRate 계산.
  const trajectoryBins = 7;
  const dayMs = 24 * 60 * 60 * 1000;
  const startTs = new Date(since).getTime();
  const codeSwitchByDay: number[] = new Array(trajectoryBins).fill(0);
  const helpSeekingByDay: number[] = new Array(trajectoryBins).fill(0);
  for (let i = 0; i < trajectoryBins; i++) {
    const begin = startTs + i * dayMs;
    const end = begin + dayMs;
    const dayTexts: string[] = [];
    for (const t of allTurns) {
      const ts = new Date(t.timestamp).getTime();
      if (ts >= begin && ts < end) dayTexts.push(t.text);
    }
    if (dayTexts.length > 0) {
      codeSwitchByDay[i] = Number(
        codeSwitchProfile(dayTexts).codeSwitchRate.toFixed(3),
      );
      const hs = helpSeekingDistribution(dayTexts);
      helpSeekingByDay[i] = Number(hs.instrumentalShare.toFixed(3));
    }
  }

  // ----- descriptives (paper Table 용) -----
  const descriptives = {
    codeSwitchRate: describeStats(codeSwitchRates),
    instrumentalShare: describeStats(instrumentalShares),
    mtld: describeStats(mtldScores),
    discourseMarkersPerUtterance: describeStats(discourseRates),
  };

  return NextResponse.json({
    source,
    sample: {
      students: students.length,
      studentsWithUtterances: perStudent.length,
      utterances: cohortUtterances.length,
      windowDays: 7,
      since,
      until: new Date().toISOString(),
    },
    cohort: {
      terminative: cohortTerminative,
      helpSeeking: cohortHelpSeeking,
      codeSwitch: {
        hangul: cohortCodeSwitch.hangul,
        english: cohortCodeSwitch.english,
        mixed: cohortCodeSwitch.mixed,
        total: cohortCodeSwitch.total,
        codeSwitchRate: Number(cohortCodeSwitch.codeSwitchRate.toFixed(3)),
      },
      discourse: {
        byCategory: cohortDiscourse.byCategory,
        byMarker: cohortDiscourse.byMarker,
        markersPerUtterance: Number(cohortDiscourse.markersPerUtterance.toFixed(3)),
      },
      mtld: {
        score: Number(cohortMtld.score.toFixed(2)),
        tokenCount: cohortMtld.tokenCount,
      },
    },
    perStudent,
    confidenceIntervals: cis,
    descriptives,
    trajectory: {
      bins: trajectoryBins,
      binSizeHours: 24,
      codeSwitchByDay,
      instrumentalShareByDay: helpSeekingByDay,
    },
    generatedAt: new Date().toISOString(),
    pipeline: "cvibe-text-mining@0.1.0",
  });
}
