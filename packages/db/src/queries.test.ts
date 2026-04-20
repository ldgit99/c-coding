import { describe, expect, it } from "vitest";

import { DEMO_COHORT_ID } from "./seeds/demo-cohort";
import { fetchClassroomData } from "./queries";

describe("fetchClassroomData — fallback", () => {
  it("client=null이면 DEMO_STUDENTS 반환 + source='demo'", async () => {
    const result = await fetchClassroomData(null, DEMO_COHORT_ID);
    expect(result.source).toBe("demo");
    expect(result.students.length).toBeGreaterThan(0);
    for (const s of result.students) {
      expect(s.cohortId).toBe(DEMO_COHORT_ID);
    }
  });

  it("존재하지 않는 cohortId는 빈 배열 (demo fallback)", async () => {
    const result = await fetchClassroomData(null, "nonexistent-cohort");
    expect(result.source).toBe("demo");
    expect(result.students).toEqual([]);
  });
});
