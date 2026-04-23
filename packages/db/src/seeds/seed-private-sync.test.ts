import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ASSIGNMENTS, filePrefixForCode, type HiddenTest } from "./assignments";

/**
 * seed-private 파일 ↔ assignments.ts 인라인 데이터 동기화 검증.
 *
 * 2026-04 이후 assignments.ts 의 `hiddenTests` · `referenceSolution` 이
 * single source of truth. `supabase/seed-private/*` 파일은
 * `pnpm --filter @cvibe/db seed:export` 로 자동 재생성되는 사본.
 *
 * 이 테스트는 파일이 인라인과 정확히 일치하는지 확인. 불일치면 CI red →
 * 개발자가 export 스크립트를 돌리거나 인라인을 고치도록 강제.
 *
 * (개발자가 assignments.ts 를 바꾼 뒤 export 를 잊은 경우를 잡기 위함)
 */

function findRepoRoot(): string {
  let cur = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(cur, "supabase/seed-private"))) return cur;
    const parent = resolve(cur, "..");
    if (parent === cur) break;
    cur = parent;
  }
  return process.cwd();
}

const REPO_ROOT = findRepoRoot();
const PRIVATE_DIR = resolve(REPO_ROOT, "supabase/seed-private");

describe("seed-private ↔ assignments.ts 동기화", () => {
  for (const asg of ASSIGNMENTS) {
    const prefix = filePrefixForCode(asg.code);
    const hiddenPath = resolve(PRIVATE_DIR, `${prefix}_hidden.json`);
    const refPath = resolve(PRIVATE_DIR, `${prefix}_ref.c`);

    describe(asg.code, () => {
      if (asg.hiddenTests && asg.hiddenTests.length > 0) {
        it(`${prefix}_hidden.json 이 inline hiddenTests 와 일치`, () => {
          expect(
            existsSync(hiddenPath),
            `${hiddenPath} 없음 — 'pnpm --filter @cvibe/db seed:export' 실행하세요.`,
          ).toBe(true);
          const onDisk = JSON.parse(readFileSync(hiddenPath, "utf-8")) as HiddenTest[];
          expect(onDisk).toEqual(asg.hiddenTests);
        });
      }

      if (asg.referenceSolution) {
        it(`${prefix}_ref.c 가 inline referenceSolution 과 일치`, () => {
          expect(
            existsSync(refPath),
            `${refPath} 없음 — 'pnpm --filter @cvibe/db seed:export' 실행하세요.`,
          ).toBe(true);
          const onDisk = readFileSync(refPath, "utf-8");
          expect(onDisk).toBe(asg.referenceSolution);
        });
      }
    });
  }
});
