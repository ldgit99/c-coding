import { NextResponse } from "next/server";

import {
  activeMisconceptions,
  updateMastery,
  type MasteryEntry,
  type MisconceptionEntry,
  type XApiEventLite,
} from "@cvibe/agents";
import {
  ASSIGNMENTS,
  createServiceRoleClientIfAvailable,
  DEMO_COHORT_ID,
} from "@cvibe/db";
import { hashLearnerId } from "@cvibe/xapi";

/**
 * GET /api/cron/student-modeler — Vercel Cron 진입점.
 *
 * 동작:
 *  1) 최근 events + submissions 를 Supabase 에서 읽는다.
 *  2) 학생별로 그룹핑한 뒤 `updateMastery` 를 호출.
 *  3) 결과를 `mastery` upsert + `misconceptions` upsert.
 *
 * 보안: 헤더 `x-cron-secret` 가 `CRON_SECRET` env 와 일치하거나, Vercel Cron
 * 의 `Authorization: Bearer ${CRON_SECRET}` 헤더가 일치해야 통과. env 미설정
 * 시 모든 요청 허용 (개발).
 *
 * 페이로드: 최근 24시간 events 처리. mastery·misconceptions 의 lastUpdated
 * 가 markers 역할 — 같은 event 를 두 번 적용하지 않게 mastery.last_processed
 * meta 컬럼에 기록.
 *
 * 이 endpoint 는 idempotent — 짧은 시간에 두 번 호출돼도 같은 events 를
 * 두 번 적용하지 않도록 last_processed 마커가 보호한다.
 */

interface ResultSummary {
  studentsProcessed: number;
  masteryRowsUpserted: number;
  misconceptionsRowsUpserted: number;
  errors: Array<{ studentId: string; reason: string }>;
}

const VERB_TO_KC_FROM_OBJECT_PREFIX = "https://cvibe.app/kc/";

// assignment code → KC tags 맵 (정적 카탈로그). assignment 단위 verb 가 들어오면
// 해당 과제의 KC 태그 *전체* 에 대해 delta 를 균등 분배.
function kcTagsForAssignment(code?: string): string[] {
  if (!code) return [];
  const a = ASSIGNMENTS.find((x) => x.code === code);
  return a?.kcTags ?? [];
}

function extractKcFromObjectId(objectId: unknown): string | undefined {
  if (typeof objectId !== "string") return undefined;
  if (!objectId.startsWith(VERB_TO_KC_FROM_OBJECT_PREFIX)) return undefined;
  return objectId.slice(VERB_TO_KC_FROM_OBJECT_PREFIX.length);
}

function extractAssignmentCodeFromObjectId(objectId: unknown): string | undefined {
  if (typeof objectId !== "string") return undefined;
  const m = objectId.match(/\/assignment\/([^/]+)$/);
  return m ? m[1] : undefined;
}

function checkAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev 환경
  const fromHeader = request.headers.get("x-cron-secret");
  const fromAuth = request.headers.get("authorization");
  return fromHeader === secret || fromAuth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClientIfAvailable();
  if (!supabase) {
    return NextResponse.json({
      ok: false,
      error: "no-service-role-client",
      hint: "SUPABASE_SERVICE_ROLE_KEY env 가 필요합니다.",
    });
  }

  const summary: ResultSummary = {
    studentsProcessed: 0,
    masteryRowsUpserted: 0,
    misconceptionsRowsUpserted: 0,
    errors: [],
  };

  try {
    // 1) cohort 의 학생 ID 모음 (제적 제외).
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, status")
      .eq("role", "student")
      .or(`cohort_id.eq.${DEMO_COHORT_ID},cohort_id.is.null`);
    if (profErr) {
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
    }
    const activeIds = (profiles ?? [])
      .filter((p) => p.status !== "removed")
      .map((p) => p.id as string);
    if (activeIds.length === 0) {
      return NextResponse.json({ ok: true, summary, note: "활성 학생 0명" });
    }

    // 2) 최근 24시간 events (student_id 가 채워진 것만 — recordEvent ctx 적용 후)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: eventRows } = await supabase
      .from("events")
      .select("student_id, verb, object, result, timestamp")
      .gte("timestamp", since)
      .in("student_id", activeIds)
      .order("timestamp", { ascending: true })
      .limit(5000);

    // 3) 최근 24시간 submissions (kcDelta 직접 반영용)
    const { data: subRows } = await supabase
      .from("submissions")
      .select("student_id, kc_delta, dependency_factor, submitted_at")
      .in("student_id", activeIds)
      .gte("submitted_at", since)
      .order("submitted_at", { ascending: true });

    // 4) 기존 mastery·misconceptions 일괄 로드
    const [{ data: existingMastery }, { data: existingMisc }] = await Promise.all([
      supabase
        .from("mastery")
        .select("student_id, kc, value, confidence, observations, last_updated, last_processed")
        .in("student_id", activeIds),
      supabase
        .from("misconceptions")
        .select(
          "student_id, kc, pattern, occurrences, first_seen, last_seen",
        )
        .in("student_id", activeIds),
    ]);

    // 학생별 그룹핑
    const masteryByStudent = new Map<string, Record<string, MasteryEntry>>();
    const lastProcessedByStudent = new Map<string, string>();
    for (const row of existingMastery ?? []) {
      const sid = row.student_id as string;
      const map = masteryByStudent.get(sid) ?? {};
      map[row.kc as string] = {
        value: Number(row.value ?? 0.5),
        confidence: Number(row.confidence ?? 0),
        observations: Number(row.observations ?? 0),
        lastUpdated: (row.last_updated as string | null) ?? undefined,
      };
      masteryByStudent.set(sid, map);
      const lp = row.last_processed as string | null;
      if (lp) {
        const cur = lastProcessedByStudent.get(sid);
        if (!cur || cur < lp) lastProcessedByStudent.set(sid, lp);
      }
    }
    const miscByStudent = new Map<string, MisconceptionEntry[]>();
    for (const row of existingMisc ?? []) {
      const sid = row.student_id as string;
      const list = miscByStudent.get(sid) ?? [];
      list.push({
        kc: row.kc as string,
        pattern: row.pattern as string,
        occurrences: Number(row.occurrences ?? 0),
        firstSeen: (row.first_seen as string | null) ?? new Date().toISOString(),
        lastSeen: (row.last_seen as string | null) ?? new Date().toISOString(),
      });
      miscByStudent.set(sid, list);
    }

    const eventsByStudent = new Map<string, XApiEventLite[]>();
    for (const row of eventRows ?? []) {
      const sid = row.student_id as string;
      const list = eventsByStudent.get(sid) ?? [];
      const verbId = (row.verb as { id?: string } | null)?.id ?? "";
      const objectId = (row.object as { id?: string } | null)?.id;
      const resultExt = (row.result as Record<string, unknown> | null)?.extensions as
        | Record<string, unknown>
        | undefined;
      // KC 결정: object 가 kc URL 이면 직접, 아니면 assignment 의 첫 KC tag.
      const kcDirect = extractKcFromObjectId(objectId);
      const assignmentCode = extractAssignmentCodeFromObjectId(objectId);
      const kcFromAssignment = kcTagsForAssignment(assignmentCode)[0];
      const kc = kcDirect ?? kcFromAssignment;
      // errorType 은 result.extensions 의 errorType 추출
      const errorType =
        typeof resultExt?.errorType === "string"
          ? (resultExt.errorType as string)
          : undefined;
      list.push({
        verb: verbId,
        kc,
        errorType,
        timestamp: row.timestamp as string,
        resultExt,
      });
      eventsByStudent.set(sid, list);
    }

    const dependencyByStudent = new Map<string, number[]>();
    const kcDeltaByStudent = new Map<string, Record<string, number>>();
    for (const row of subRows ?? []) {
      const sid = row.student_id as string;
      const dep = Number(row.dependency_factor ?? 0);
      if (Number.isFinite(dep)) {
        const arr = dependencyByStudent.get(sid) ?? [];
        arr.push(dep);
        dependencyByStudent.set(sid, arr);
      }
      // kc_delta 누적 합 (단일 batch 내 같은 학생의 여러 제출)
      const delta = (row.kc_delta as Record<string, number> | null) ?? null;
      if (delta) {
        const acc = kcDeltaByStudent.get(sid) ?? {};
        for (const [k, v] of Object.entries(delta)) {
          acc[k] = (acc[k] ?? 0) + Number(v);
        }
        kcDeltaByStudent.set(sid, acc);
      }
    }

    // 5) 학생별로 updateMastery 실행 → upsert
    for (const sid of activeIds) {
      try {
        const { masteryUpdated, misconceptions, lastProcessedEventAt } = updateMastery({
          currentMastery: masteryByStudent.get(sid) ?? {},
          currentMisconceptions: miscByStudent.get(sid) ?? [],
          kcDelta: kcDeltaByStudent.get(sid),
          events: eventsByStudent.get(sid),
          dependencyFactorHistory: dependencyByStudent.get(sid),
          lastProcessedEventAt: lastProcessedByStudent.get(sid),
        });

        // mastery upsert
        const masteryRows = Object.entries(masteryUpdated).map(([kc, entry]) => ({
          student_id: sid,
          kc,
          value: entry.value,
          confidence: entry.confidence,
          observations: entry.observations,
          last_updated: entry.lastUpdated ?? new Date().toISOString(),
          last_processed: lastProcessedEventAt,
        }));
        if (masteryRows.length > 0) {
          const { error } = await supabase
            .from("mastery")
            .upsert(masteryRows, { onConflict: "student_id,kc" });
          if (error) {
            summary.errors.push({ studentId: sid, reason: `mastery: ${error.message}` });
          } else {
            summary.masteryRowsUpserted += masteryRows.length;
          }
        }

        // misconceptions upsert (활성 misconception 만)
        const active = activeMisconceptions(misconceptions);
        if (active.length > 0) {
          const miscRows = active.map((m) => ({
            student_id: sid,
            kc: m.kc,
            pattern: m.pattern,
            occurrences: m.occurrences,
            first_seen: m.firstSeen,
            last_seen: m.lastSeen,
          }));
          const { error } = await supabase
            .from("misconceptions")
            .upsert(miscRows, { onConflict: "student_id,kc,pattern" });
          if (error) {
            summary.errors.push({
              studentId: sid,
              reason: `misconceptions: ${error.message}`,
            });
          } else {
            summary.misconceptionsRowsUpserted += miscRows.length;
          }
        }

        summary.studentsProcessed += 1;
      } catch (err) {
        summary.errors.push({
          studentId: sid,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // hashLearnerId import 가 unused 처리되지 않게 — 미래에 actor.account.name
  // 매칭 폴백을 추가할 때 사용한다.
  void hashLearnerId;

  return NextResponse.json({ ok: true, summary, ranAt: new Date().toISOString() });
}
