import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEMO_STUDENT_USER,
  DEMO_TEACHER_USER,
  resolveUserFromRequest,
} from "./auth";

describe("resolveUserFromRequest", () => {
  const originalEnv = process.env.CVIBE_DEMO_USER;

  beforeEach(() => {
    delete process.env.CVIBE_DEMO_USER;
  });

  afterEach(() => {
    if (originalEnv) process.env.CVIBE_DEMO_USER = originalEnv;
  });

  it("기본 fallback은 student role의 DEMO_STUDENT_USER", () => {
    const req = new Request("http://localhost:3000/api/foo");
    const user = resolveUserFromRequest(req);
    expect(user.id).toBe(DEMO_STUDENT_USER.id);
    expect(user.role).toBe("student");
    expect(user.mocked).toBe(true);
  });

  it("preferredRole=teacher이면 DEMO_TEACHER_USER", () => {
    const req = new Request("http://localhost:3001/api/foo");
    const user = resolveUserFromRequest(req, { preferredRole: "teacher" });
    expect(user.id).toBe(DEMO_TEACHER_USER.id);
    expect(user.role).toBe("teacher");
  });

  it("x-cvibe-role + x-cvibe-user-id 헤더로 override", () => {
    const req = new Request("http://localhost:3000/api/foo", {
      headers: {
        "x-cvibe-role": "student",
        "x-cvibe-user-id": "stu-xyz",
      },
    });
    const user = resolveUserFromRequest(req);
    expect(user.id).toBe("stu-xyz");
    expect(user.role).toBe("student");
    expect(user.mocked).toBe(true);
  });

  it("CVIBE_DEMO_USER env JSON을 merge", () => {
    process.env.CVIBE_DEMO_USER = JSON.stringify({
      id: "stu-env",
      displayName: "env학생",
    });
    const req = new Request("http://localhost:3000/api/foo");
    const user = resolveUserFromRequest(req);
    expect(user.id).toBe("stu-env");
    expect(user.displayName).toBe("env학생");
  });

  it("잘못된 env JSON은 무시하고 fallback", () => {
    process.env.CVIBE_DEMO_USER = "not-json{";
    const req = new Request("http://localhost:3000/api/foo");
    const user = resolveUserFromRequest(req);
    expect(user.id).toBe(DEMO_STUDENT_USER.id);
  });
});
