/**
 * 데모 코호트 — Week 9 대시보드 개발용 mock 데이터.
 * Week 10에 Supabase 쿼리로 교체.
 */

export interface DemoStudent {
  id: string;
  displayName: string;
  cohortId: string;
  /** KC → mastery value 0~1 */
  mastery: Record<string, number>;
  /** 최근 의존도 이력 (최신이 마지막) */
  dependencyFactorHistory: number[];
  misconceptions: Array<{ kc: string; pattern: string; occurrences: number }>;
  recentSubmissions: Array<{
    assignmentId: string;
    finalScore: number | null;
    passed: boolean;
    submittedAt: string;
    errorTypes: string[];
    stagnationSec: number;
    hintRequestsL3L4: number;
  }>;
}

export const DEMO_COHORT_ID = "00000000-0000-4000-8000-000000000010";

export const DEMO_STUDENTS: DemoStudent[] = [
  {
    id: "s-001",
    displayName: "김학생",
    cohortId: DEMO_COHORT_ID,
    mastery: {
      "variables-types": 0.82,
      "control-flow-if": 0.78,
      "control-flow-loop": 0.65,
      "arrays-indexing": 0.55,
      "pointer-basics": 0.3,
      "pointer-arithmetic": 0.15,
      "memory-allocation": 0.1,
      "functions-params": 0.7,
      recursion: 0.25,
      "io-formatting": 0.85,
    },
    dependencyFactorHistory: [0.25, 0.3, 0.28],
    misconceptions: [],
    recentSubmissions: [
      {
        assignmentId: "A03_arrays_basic",
        finalScore: 0.85,
        passed: true,
        submittedAt: "2026-04-19T10:00:00Z",
        errorTypes: ["off-by-one"],
        stagnationSec: 120,
        hintRequestsL3L4: 1,
      },
      {
        assignmentId: "A05_pointer_swap",
        finalScore: 0.7,
        passed: true,
        submittedAt: "2026-04-20T09:00:00Z",
        errorTypes: [],
        stagnationSec: 60,
        hintRequestsL3L4: 0,
      },
    ],
  },
  {
    id: "s-002",
    displayName: "이학생",
    cohortId: DEMO_COHORT_ID,
    mastery: {
      "variables-types": 0.9,
      "control-flow-if": 0.85,
      "control-flow-loop": 0.82,
      "arrays-indexing": 0.35,
      "pointer-basics": 0.22,
      "pointer-arithmetic": 0.12,
      "memory-allocation": 0.08,
      "functions-params": 0.6,
      recursion: 0.15,
      "io-formatting": 0.9,
    },
    dependencyFactorHistory: [0.35, 0.48, 0.65], // 의존도 상승 — 개입 후보
    misconceptions: [
      { kc: "pointer-basics", pattern: "NULL 체크 누락 반복", occurrences: 4 },
    ],
    recentSubmissions: [
      {
        assignmentId: "A05_pointer_swap",
        finalScore: 0.35,
        passed: false,
        submittedAt: "2026-04-19T11:00:00Z",
        errorTypes: ["segfault", "null-dereference"],
        stagnationSec: 600,
        hintRequestsL3L4: 4,
      },
      {
        assignmentId: "A05_pointer_swap",
        finalScore: 0.45,
        passed: false,
        submittedAt: "2026-04-20T08:30:00Z",
        errorTypes: ["segfault"],
        stagnationSec: 420,
        hintRequestsL3L4: 3,
      },
    ],
  },
  {
    id: "s-003",
    displayName: "박학생",
    cohortId: DEMO_COHORT_ID,
    mastery: {
      "variables-types": 0.95,
      "control-flow-if": 0.92,
      "control-flow-loop": 0.9,
      "arrays-indexing": 0.88,
      "pointer-basics": 0.78,
      "pointer-arithmetic": 0.72,
      "memory-allocation": 0.65,
      "functions-params": 0.85,
      recursion: 0.68,
      "io-formatting": 0.95,
    },
    dependencyFactorHistory: [0.12, 0.15, 0.13],
    misconceptions: [],
    recentSubmissions: [
      {
        assignmentId: "A07_malloc_resize",
        finalScore: 0.92,
        passed: true,
        submittedAt: "2026-04-19T14:00:00Z",
        errorTypes: [],
        stagnationSec: 180,
        hintRequestsL3L4: 0,
      },
      {
        assignmentId: "A09_factorial_rec",
        finalScore: 0.88,
        passed: true,
        submittedAt: "2026-04-20T10:00:00Z",
        errorTypes: [],
        stagnationSec: 90,
        hintRequestsL3L4: 0,
      },
    ],
  },
];
