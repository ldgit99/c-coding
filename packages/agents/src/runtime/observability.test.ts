import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  _resetObservabilityForTests,
  flushTrace,
  recordGeneration,
  startTrace,
} from "./observability";

describe("observability (env 미설정 — no-op 경로)", () => {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  beforeEach(() => {
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    _resetObservabilityForTests();
  });

  afterEach(() => {
    if (publicKey) process.env.LANGFUSE_PUBLIC_KEY = publicKey;
    if (secretKey) process.env.LANGFUSE_SECRET_KEY = secretKey;
    _resetObservabilityForTests();
  });

  it("startTrace는 env 없으면 trace=null인 handle 반환", () => {
    const handle = startTrace({ name: "pedagogy-coach", userId: "stu-1" });
    expect(handle.trace).toBeNull();
    expect(handle.name).toBe("pedagogy-coach");
    expect(handle.userId).toBe("stu-1");
  });

  it("recordGeneration은 trace=null에서 throw하지 않음", () => {
    const handle = startTrace({ name: "x" });
    expect(() =>
      recordGeneration(handle, {
        name: "gen",
        model: "claude-sonnet-4-6",
        input: "hi",
        output: "hello",
      }),
    ).not.toThrow();
  });

  it("flushTrace는 trace=null에서 throw하지 않음", async () => {
    const handle = startTrace({ name: "x" });
    await expect(flushTrace(handle)).resolves.toBeUndefined();
  });
});

describe("observability (env 설정 — 클라이언트 초기화 경로)", () => {
  const originalPk = process.env.LANGFUSE_PUBLIC_KEY;
  const originalSk = process.env.LANGFUSE_SECRET_KEY;

  beforeEach(() => {
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";
    _resetObservabilityForTests();
  });

  afterEach(() => {
    if (originalPk) process.env.LANGFUSE_PUBLIC_KEY = originalPk;
    else delete process.env.LANGFUSE_PUBLIC_KEY;
    if (originalSk) process.env.LANGFUSE_SECRET_KEY = originalSk;
    else delete process.env.LANGFUSE_SECRET_KEY;
    _resetObservabilityForTests();
  });

  it("env 있으면 startTrace는 실제 trace 객체 생성", () => {
    const handle = startTrace({ name: "pedagogy-coach", userId: "stu-1" });
    expect(handle.trace).not.toBeNull();
  });

  it("recordGeneration이 실제 trace에서도 throw하지 않음 (네트워크는 비동기 flush)", () => {
    const handle = startTrace({ name: "x" });
    expect(() =>
      recordGeneration(handle, {
        name: "gen",
        model: "claude-sonnet-4-6",
        input: "hi",
        output: "hello",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      }),
    ).not.toThrow();
  });
});
