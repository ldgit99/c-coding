import { createServiceRoleClientIfAvailable, insertEvent } from "@cvibe/db";
import { setEventPersister, type XApiStatementT } from "@cvibe/xapi";

/**
 * xAPI 이벤트 영구 저장 싱크.
 *
 * 매 recordEvent 호출 시 fire-and-forget 으로 Supabase events 테이블에
 * INSERT. 학생 손실 0 원칙 — 메모리 buffer 외에 DB 에도 기록.
 *
 * 호출처: apps/student/instrumentation.ts (Next.js 부팅 훅).
 */

let registered = false;

export function registerEventPersistence(): void {
  if (registered) return;
  registered = true;

  setEventPersister(async (stmt: XApiStatementT) => {
    const supabase = createServiceRoleClientIfAvailable();
    if (!supabase) return; // env 미설정 — demo 모드
    // statement.actor.account.name 은 hashLearnerId 결과 (예: "learner_xxxx")
    // → profiles.id 와 직접 매칭 안 됨. 이 함수는 statement 의 actor 만 그대로
    // 저장하고 student_id/assignment_id 는 라우트에서 명시적으로 넘기는 흐름이
    // 정석. 여기서는 actor.homePage 가 있는지로 판단해 student_id 에 null
    // 또는 추후 routing 키를 넣는다 (현재는 null — 학생 ID 매핑은 분석 단계).
    await insertEvent(supabase, {
      statement: {
        actor: stmt.actor as { account: { name: string } } & Record<string, unknown>,
        verb: stmt.verb as { id: string } & Record<string, unknown>,
        object: stmt.object as { id: string } & Record<string, unknown>,
        result: stmt.result,
        context: stmt.context,
        timestamp: stmt.timestamp,
      },
    });
  });
}
