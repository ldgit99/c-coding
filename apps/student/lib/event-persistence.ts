import { createServiceRoleClientIfAvailable, insertEvent } from "@cvibe/db";
import {
  incrementWriteAttempt,
  incrementWriteFailure,
  setEventPersister,
  type PersistContext,
  type XApiStatementT,
} from "@cvibe/xapi";

/**
 * xAPI 이벤트 영구 저장 싱크.
 *
 * 매 recordEvent 호출 시 fire-and-forget 으로 Supabase events 테이블에
 * INSERT. 학생 손실 0 원칙 — 메모리 buffer 외에 DB 에도 기록.
 *
 * 호출처: apps/student/instrumentation.ts (Next.js 부팅 훅).
 */

let registered = false;

const ASSIGNMENT_OBJECT_PREFIX_RE = /\/assignment\/([^/]+)$/;

/** statement.object 에서 assignment code 추출 (object.id 가 .../assignment/<code> 형식). */
function extractAssignmentCodeFromObject(stmt: XApiStatementT): string | undefined {
  const id = stmt.object?.id;
  if (typeof id !== "string") return undefined;
  const m = id.match(ASSIGNMENT_OBJECT_PREFIX_RE);
  return m ? m[1] : undefined;
}

export function registerEventPersistence(): void {
  if (registered) return;
  registered = true;

  setEventPersister(async (stmt: XApiStatementT, ctx?: PersistContext) => {
    const supabase = createServiceRoleClientIfAvailable();
    if (!supabase) return; // env 미설정 — demo 모드

    // 1) studentId 결정: ctx 우선, 없으면 null 저장 (hashLearnerId 는 단방향이라
    //    여기서 profiles.id 로 역산 불가).
    const studentId = ctx?.studentId;

    // 2) assignment code 결정: ctx 우선, 없으면 statement.object.id 에서 추출.
    //    (Verbs.requestedHint 등은 object 가 kc 일 수 있어 추출 실패 → undefined.)
    const assignmentCode =
      ctx?.assignmentCode ?? extractAssignmentCodeFromObject(stmt);

    // 3) assignmentCode → assignments.id 조회 (uuid 컬럼). 실패해도 다른 필드는
    //    저장되도록 try-catch 격리.
    let assignmentId: string | undefined;
    if (assignmentCode && assignmentCode !== "ungoverned") {
      try {
        const { data } = await supabase
          .from("assignments")
          .select("id")
          .eq("code", assignmentCode)
          .maybeSingle();
        assignmentId = (data?.id as string | undefined) ?? undefined;
      } catch {
        // ignore — assignmentId 미지정 상태로 진행
      }
    }

    incrementWriteAttempt("events");
    const result = await insertEvent(supabase, {
      statement: {
        actor: stmt.actor as { account: { name: string } } & Record<string, unknown>,
        verb: stmt.verb as { id: string } & Record<string, unknown>,
        object: stmt.object as { id: string } & Record<string, unknown>,
        result: stmt.result,
        context: stmt.context,
        timestamp: stmt.timestamp,
      },
      studentId,
      assignmentId,
    });
    if (!result.ok) incrementWriteFailure("events", result.error);
  });
}
