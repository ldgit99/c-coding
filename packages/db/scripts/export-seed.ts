import * as fs from "node:fs";
import * as path from "node:path";

import { ASSIGNMENTS, filePrefixForCode } from "../src/seeds/assignments";
import { DEMO_COHORT_ID } from "../src/seeds/demo-cohort";
import { renderSeedSQL } from "../src/seeds/sql";

/**
 * Regenerate supabase/seed.sql AND supabase/seed-private/* from TS constants.
 *
 * Single source of truth: `packages/db/src/seeds/assignments.ts`.
 * 실행: pnpm --filter @cvibe/db seed:export
 *
 * 출력:
 *   - supabase/seed.sql                       (assignments upsert)
 *   - supabase/seed-private/{prefix}_hidden.json  (학생 미노출 채점 케이스)
 *   - supabase/seed-private/{prefix}_ref.c        (Safety Guard 유사도 비교)
 */

const repoRoot = path.resolve(__dirname, "..", "..", "..");

// 1. seed.sql
const sql = renderSeedSQL({
  cohortId: DEMO_COHORT_ID,
  cohortName: "2026 Spring CS1",
  cohortTerm: "2026-Spring",
  assignments: ASSIGNMENTS,
});
const sqlPath = path.join(repoRoot, "supabase", "seed.sql");
fs.writeFileSync(sqlPath, sql, "utf8");
// eslint-disable-next-line no-console
console.log(
  `[cvibe/db] wrote ${sqlPath} (${sql.length} chars, ${ASSIGNMENTS.length} assignments)`,
);

// 2. seed-private — hidden.json 과 ref.c 를 assignments 로부터 재생성
const privateDir = path.join(repoRoot, "supabase", "seed-private");
if (!fs.existsSync(privateDir)) fs.mkdirSync(privateDir, { recursive: true });

let hiddenCount = 0;
let refCount = 0;
for (const asg of ASSIGNMENTS) {
  const prefix = filePrefixForCode(asg.code);
  if (asg.hiddenTests && asg.hiddenTests.length > 0) {
    const json = `${JSON.stringify(asg.hiddenTests, null, 2)}\n`;
    const hiddenPath = path.join(privateDir, `${prefix}_hidden.json`);
    fs.writeFileSync(hiddenPath, json, "utf8");
    hiddenCount += 1;
  }
  if (asg.referenceSolution) {
    const refPath = path.join(privateDir, `${prefix}_ref.c`);
    fs.writeFileSync(refPath, asg.referenceSolution, "utf8");
    refCount += 1;
  }
}
// eslint-disable-next-line no-console
console.log(
  `[cvibe/db] wrote seed-private/ (${hiddenCount} hidden tests, ${refCount} ref solutions)`,
);
