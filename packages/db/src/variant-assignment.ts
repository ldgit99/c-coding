/**
 * Assignment variant 결정적 배정 — research.md §6.1 표절 방지·재응시용 변형.
 *
 * 같은 (studentId, assignmentCode) 쌍은 항상 같은 variant index를 반환한다.
 * 이로써:
 *  - 같은 학생이 같은 과제에 들어오면 동일 variant (중간 새로고침·재접속 안전)
 *  - 교사가 학생 변경 없이 재평가해도 동일
 *  - `cohortSeed`로 전체 shift 가능 (다음 학기엔 variant 배분 로테이션)
 *
 * 순수 함수 + 범용 FNV-1a 해시 — 별도 의존성 없음.
 */

export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Math.imul은 32-bit 곱셈 유지 — V8에서 최적화됨.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface VariantPickInput {
  studentId: string;
  assignmentCode: string;
  variantCount: number;
  /** cohort/학기별 로테이션 — 같은 학생의 같은 과제를 다음 학기에 다른 variant로 */
  cohortSeed?: string;
}

export function pickVariantIndex(input: VariantPickInput): number {
  if (input.variantCount <= 1) return 0;
  const key = input.cohortSeed
    ? `${input.cohortSeed}::${input.studentId}::${input.assignmentCode}`
    : `${input.studentId}::${input.assignmentCode}`;
  return fnv1a32(key) % input.variantCount;
}

/**
 * 전체 학생×과제 매트릭스의 variant 분포를 미리 계산 — 교사가 배포 전에
 * 분포 검증(한쪽으로 치우쳤는지)에 사용.
 */
export function variantDistribution(
  studentIds: string[],
  assignmentCode: string,
  variantCount: number,
  cohortSeed?: string,
): number[] {
  const counts = new Array(variantCount).fill(0) as number[];
  for (const sid of studentIds) {
    const idx = pickVariantIndex({ studentId: sid, assignmentCode, variantCount, cohortSeed });
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  return counts;
}
