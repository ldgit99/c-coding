import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ASSIGNMENTS, type AssignmentSeed } from "./assignments";

/**
 * seed-private 동기화 검증.
 *
 * assignments.ts 의 과제 스펙이 바뀌었을 때 supabase/seed-private/{code}_*
 * 파일이 업데이트되지 않으면 Judge0 hidden test 가 완전히 다른 과제를
 * 채점해 '정답인데 0%' 버그 발생. 이 테스트는 두 진실 소스의 drift 를
 * CI 에서 조기 감지한다.
 *
 * 검증 규칙 (엄격하지 않게 — regression 감지 목적):
 *   (A) {code}_hidden.json 이 존재한다면:
 *       · 첫 hidden test 의 input 이 visibleTests 중 하나의 input 과 일치
 *       · 첫 hidden test 의 expected 가 같은 visibleTest 의 expected 와 일치
 *     → 둘 다 맞으면 "hidden 이 visible 과 같은 과제 스펙을 채점한다" 보장
 *   (B) {code}_ref.c 가 존재한다면:
 *       · starterCode 에 선언된 주요 함수명(예: "void swap(", "double average(")
 *         이 ref.c 에도 있어야 함 → 다른 과제의 ref 가 남아있지 않음 확인
 */

// cwd 기반으로 repo root 를 찾는다 (turbo 가 packages/db 또는 root 에서
// 실행될 수 있으므로 supabase/seed-private 가 존재하는 조상 디렉토리를 탐색).
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

/**
 * seed-private 파일명은 `A00_hidden.json` 처럼 Axx prefix 만 사용한다
 * (카탈로그 code 는 `A00_pilot_average` 같은 full slug).
 * 파일명 prefix 추출 헬퍼.
 */
function filePrefix(code: string): string {
  const m = code.match(/^A\d{2}/);
  return m ? m[0] : code;
}

interface HiddenTest {
  id: number;
  input: string;
  expected: string;
}

describe("seed-private ↔ assignments.ts drift 감지", () => {
  for (const assignment of ASSIGNMENTS) {
    const { code } = assignment;
    const prefix = filePrefix(code);
    const hiddenPath = resolve(PRIVATE_DIR, `${prefix}_hidden.json`);
    const refPath = resolve(PRIVATE_DIR, `${prefix}_ref.c`);

    describe(code, () => {
      if (existsSync(hiddenPath)) {
        it("첫 hidden test 가 visibleTest 중 하나와 일치 (과제 정체성)", () => {
          const raw = readFileSync(hiddenPath, "utf-8");
          const hidden = JSON.parse(raw) as HiddenTest[];
          expect(hidden.length).toBeGreaterThan(0);
          const first = hidden[0]!;
          const match = assignment.visibleTests.find(
            (v) => v.input === first.input && v.expected === first.expected,
          );
          expect(
            match,
            `[${code}] hidden.json 의 첫 케이스(input=${JSON.stringify(first.input)}, expected=${JSON.stringify(first.expected)}) 가 assignments.ts 의 visibleTests 중 어느 것과도 일치하지 않음. 과제 스펙 바뀔 때 seed-private 도 함께 업데이트했는지 확인하라.`,
          ).toBeDefined();
        });
      } else {
        it.todo(`${code}_hidden.json 미존재 — seed-private 추가 대기`);
      }

      if (existsSync(refPath)) {
        it("ref.c 에 starterCode 의 주요 함수 시그니처가 포함", () => {
          const refSource = readFileSync(refPath, "utf-8");
          const signatures = extractSignatures(assignment);
          if (signatures.length === 0) return; // 시그니처 탐지 못하면 skip (main 만 있는 과제)
          for (const sig of signatures) {
            expect(
              refSource.includes(sig),
              `[${code}] ref.c 에 "${sig}" 가 없음. assignments.ts 의 starterCode 는 이 시그니처를 요구하지만 ref.c 는 다른 과제 코드 같다.`,
            ).toBe(true);
          }
        });
      } else {
        it.todo(`${code}_ref.c 미존재 — seed-private 추가 대기`);
      }
    });
  }
});

/**
 * starterCode 에서 main 제외한 함수 시그니처 추출.
 * 예: "void swap(int *a, int *b)" / "double average(int x[])"
 * 패턴: `<returnType> <name>(...params...)` 형식 중 name !== "main".
 * 완벽 파서가 아니라 휴리스틱 — 통과 기준을 substring 포함으로 느슨하게.
 */
function extractSignatures(assignment: AssignmentSeed): string[] {
  const starter = assignment.starterCode;
  const sigRe = /^[ \t]*(?:static\s+|inline\s+)*(void|int|long|double|char|float|size_t)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/gm;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of starter.matchAll(sigRe)) {
    const [_, retType, name] = m;
    if (!retType || !name) continue;
    if (name === "main") continue;
    // 두 번째 capture 그룹 params 는 스페이스 변형이 있을 수 있으니
    // "<retType> <name>(" 프리픽스만 검사하면 충분
    const prefix = `${retType} ${name}(`;
    if (!seen.has(prefix)) {
      seen.add(prefix);
      out.push(prefix);
    }
  }
  return out;
}
