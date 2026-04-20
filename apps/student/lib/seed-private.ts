import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * `supabase/seed-private/` 로더 — 서버 전용(Node runtime).
 *
 * 파일럿 단계: repo 내 `supabase/seed-private/`에서 직접 읽는다.
 * 프로덕션: 환경변수 `CVIBE_SEED_PRIVATE_DIR`로 경로 override 또는 Vercel
 * Blob에서 fetch하도록 이 모듈을 교체.
 *
 * Next.js API route의 process.cwd()는 일반적으로 apps/student/ 이므로
 * 기본 경로는 repo root 기준 `../../supabase/seed-private`.
 * next.config.ts의 outputFileTracingIncludes로 빌드 시 포함 필수.
 */

function seedPrivateDir(): string {
  if (process.env.CVIBE_SEED_PRIVATE_DIR) return process.env.CVIBE_SEED_PRIVATE_DIR;
  return path.resolve(process.cwd(), "..", "..", "supabase", "seed-private");
}

export interface HiddenTestSpec {
  id: number;
  input: string;
  expected: string;
}

/**
 * `A01_hello_variables` → `A01` 등 파일명 prefix 추출. 모든 과제 code가
 * `A\d+_<slug>` 패턴을 따른다는 전제.
 */
function codePrefix(assignmentCode: string): string {
  const first = assignmentCode.split("_")[0];
  return first ?? assignmentCode;
}

/**
 * `{prefix}_hidden.json` 로드. 파일 없거나 파싱 실패 시 null.
 */
export async function loadHiddenTests(assignmentCode: string): Promise<HiddenTestSpec[] | null> {
  try {
    const filePath = path.join(seedPrivateDir(), `${codePrefix(assignmentCode)}_hidden.json`);
    const text = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(text) as HiddenTestSpec[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * `{prefix}_ref.c` 로드. Safety Guard가 outbound 유사도 검사에 사용.
 * 호출자는 반환값을 학생 경로 응답 본문에 포함해선 안 된다.
 */
export async function loadReferenceSolution(assignmentCode: string): Promise<string | null> {
  try {
    const filePath = path.join(seedPrivateDir(), `${codePrefix(assignmentCode)}_ref.c`);
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}
