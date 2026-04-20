import * as fs from "node:fs";
import * as path from "node:path";

import { ASSIGNMENTS } from "../src/seeds/assignments";
import { DEMO_COHORT_ID } from "../src/seeds/demo-cohort";
import { renderSeedSQL } from "../src/seeds/sql";

/**
 * Regenerate supabase/seed.sql from TS constants.
 * 실행: pnpm --filter @cvibe/db seed:export
 */

const sql = renderSeedSQL({
  cohortId: DEMO_COHORT_ID,
  cohortName: "2026 Spring CS1",
  cohortTerm: "2026-Spring",
  assignments: ASSIGNMENTS,
});

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const outPath = path.join(repoRoot, "supabase", "seed.sql");
fs.writeFileSync(outPath, sql, "utf8");

// eslint-disable-next-line no-console
console.log(`[cvibe/db] wrote ${outPath} (${sql.length} chars, ${ASSIGNMENTS.length} assignments)`);
