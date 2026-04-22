import { describe, expect, it } from "vitest";

import { ASSIGNMENTS } from "./assignments";
import { DEMO_COHORT_ID } from "./demo-cohort";
import { renderAssignmentInsert, renderCohortInsert, renderSeedSQL, SEED_TEACHER_ID } from "./sql";

describe("renderCohortInsert", () => {
  it("id·teacher·conflict 절 포함", () => {
    const sql = renderCohortInsert("c-test", "Test Cohort", "2026-Spring");
    expect(sql).toContain("insert into public.cohorts");
    expect(sql).toContain("'c-test'");
    expect(sql).toContain(SEED_TEACHER_ID);
    expect(sql).toContain("on conflict (id) do nothing");
  });
});

describe("renderAssignmentInsert", () => {
  it("한국어 제목·템플릿이 dollar-quoted로 escape 없이 포함", () => {
    const sql = renderAssignmentInsert(ASSIGNMENTS[0]!, "c-demo");
    expect(sql).toContain("'A01_bubble_sort'");
    expect(sql).toContain("배열과 버블정렬");
    expect(sql).toContain("'c-demo'");
    expect(sql).toContain("on conflict (code) do update set");
  });

  it("JSONB 필드는 ::jsonb 캐스트 포함", () => {
    const sql = renderAssignmentInsert(ASSIGNMENTS[0]!, "c-demo");
    expect(sql).toMatch(/\$\$\{.*"correctness".*\}\$\$::jsonb/);
  });

  it("$$가 값 안에 있어도 고유 태그로 escape", () => {
    const sql = renderAssignmentInsert(
      {
        ...ASSIGNMENTS[0]!,
        template: "값에 $$ 포함",
      },
      "c-demo",
    );
    // dollar 안에 $$이 있으면 고유 태그 $CVS$…$CVS$로 전환
    expect(sql).toContain("$CVS$값에 $$ 포함$CVS$");
  });
});

describe("renderSeedSQL — 결정성", () => {
  it("같은 입력은 같은 출력", () => {
    const input = {
      cohortId: DEMO_COHORT_ID,
      cohortName: "test",
      cohortTerm: "x",
      assignments: ASSIGNMENTS,
    };
    expect(renderSeedSQL(input)).toBe(renderSeedSQL(input));
  });

  it("ASSIGNMENTS 10개 전부 포함 + begin/commit 트랜잭션 감쌈", () => {
    const sql = renderSeedSQL({
      cohortId: DEMO_COHORT_ID,
      cohortName: "2026 Spring CS1",
      cohortTerm: "2026-Spring",
      assignments: ASSIGNMENTS,
    });
    expect(sql.startsWith("-- CVibe Supabase seed")).toBe(true);
    expect(sql).toContain("begin;");
    expect(sql.trim().endsWith("commit;")).toBe(true);
    for (const a of ASSIGNMENTS) {
      expect(sql).toContain(`'${a.code}'`);
    }
  });
});
