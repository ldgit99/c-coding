import type { AssignmentSeed } from "./assignments";

/**
 * ASSIGNMENTS · DEMO_COHORT 같은 정적 TS 상수를 Supabase SQL INSERT 문으로
 * 직렬화하는 순수 함수들. `packages/db/scripts/export-seed.ts`가 이를 호출해
 * `supabase/seed.sql`을 생성한다.
 *
 * PostgreSQL dollar-quoted string($$…$$)을 사용해 한국어·개행·특수 문자가
 * 포함된 값도 escape 없이 안전하게 넣는다.
 */

export const SEED_TEACHER_ID = "00000000-0000-4000-8000-000000000001";

export function renderCohortInsert(cohortId: string, name: string, term: string): string {
  return [
    `insert into public.cohorts (id, name, term, teacher_id) values`,
    `  ('${cohortId}', ${dollar(name)}, ${dollar(term)}, '${SEED_TEACHER_ID}')`,
    `on conflict (id) do nothing;`,
  ].join("\n");
}

export function renderAssignmentInsert(a: AssignmentSeed, cohortId: string): string {
  return [
    `insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (`,
    `  '${a.code}',`,
    `  ${a.version},`,
    `  ${dollar(a.title)},`,
    `  ${dollar(a.template)},`,
    `  ${jsonb(a.kcTags)},`,
    `  ${a.difficulty},`,
    `  ${jsonb(a.rubric)},`,
    `  ${jsonb(a.constraints)},`,
    `  ${dollar(a.starterCode)},`,
    `  ${jsonb(a.visibleTests)},`,
    `  ${jsonb(a.reflectionPrompts)},`,
    `  '${cohortId}',`,
    `  true,`,
    `  '${SEED_TEACHER_ID}'`,
    `) on conflict (code) do update set`,
    `  version = excluded.version,`,
    `  title = excluded.title,`,
    `  template = excluded.template,`,
    `  kc_tags = excluded.kc_tags,`,
    `  difficulty = excluded.difficulty,`,
    `  rubric = excluded.rubric,`,
    `  constraints = excluded.constraints,`,
    `  starter_code = excluded.starter_code,`,
    `  visible_tests = excluded.visible_tests,`,
    `  reflection_prompts = excluded.reflection_prompts;`,
  ].join("\n");
}

/**
 * 전체 seed 렌더러. `supabase/seed.sql`에 그대로 쓰이는 최종 문자열.
 */
export function renderSeedSQL(input: {
  cohortId: string;
  cohortName: string;
  cohortTerm: string;
  assignments: AssignmentSeed[];
}): string {
  const header = [
    "-- CVibe Supabase seed — auto-generated. Do NOT edit directly.",
    "-- Regenerate: pnpm --filter @cvibe/db seed:export",
    "--",
    "-- 이 파일은 `supabase db reset` 시 자동 실행된다.",
    "-- profiles/auth 테이블 seed는 auth.users와 엮여 있어 별도 스크립트로 처리.",
    "",
    "begin;",
    "",
    "-- Seed 교사 프로필 (auth.users는 별도 스크립트로 생성 필요).",
    `insert into public.profiles (id, email, role, display_name)`,
    `values ('${SEED_TEACHER_ID}', 'seed-teacher@cvibe.dev', 'teacher', 'Seed Teacher')`,
    `on conflict (id) do nothing;`,
    "",
  ].join("\n");

  const cohort = renderCohortInsert(input.cohortId, input.cohortName, input.cohortTerm);
  const assignments = input.assignments.map((a) => renderAssignmentInsert(a, input.cohortId)).join("\n\n");

  return [header, cohort, "", assignments, "", "commit;", ""].join("\n");
}

function dollar(text: string): string {
  // dollar-quoted: 텍스트에 `$$`가 있으면 고유 태그 사용
  if (!text.includes("$$")) return `$$${text}$$`;
  let tag = "CVS";
  while (text.includes(`$${tag}$`)) tag += "X";
  return `$${tag}$${text}$${tag}$`;
}

function jsonb(value: unknown): string {
  return `${dollar(JSON.stringify(value))}::jsonb`;
}
