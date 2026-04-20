/**
 * clang-tidy (WASM) 정적 분석 — Code Reviewer 에이전트의 보조 도구.
 *
 * Week 3에 실제 clang-tidy wasm 번들로 교체.
 * 현재는 빈 결과를 반환하는 스텁 — 정적 분석 실패 시 LLM-only 모드로 폴백한다.
 */

export interface LintWarning {
  rule: string;
  line: number;
  column: number;
  message: string;
  severity: "warning" | "error";
}

export interface LintResult {
  executed: boolean;
  warnings: LintWarning[];
}

export async function lintC(_code: string): Promise<LintResult> {
  return { executed: false, warnings: [] };
}
