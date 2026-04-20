import { Langfuse } from "langfuse";

/**
 * Langfuse 기반 LLM 관측성.
 *
 * 환경 변수:
 * - LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY — 없으면 전부 no-op.
 * - LANGFUSE_HOST (선택) — self-host 시 지정.
 *
 * 사용 패턴:
 *   const trace = startTrace({ name: "pedagogy-coach", userId: studentId });
 *   try {
 *     const response = await client.messages.create(...);
 *     recordGeneration(trace, { model, input, output, usage });
 *     return response;
 *   } finally {
 *     trace?.shutdown();
 *   }
 *
 * env 설정이 없을 때는 startTrace가 null을 반환하고, record/shutdown은
 * null-safe하게 처리되어 런타임 overhead 0.
 */

let singleton: Langfuse | null | undefined; // undefined = 초기화 전, null = 비활성

function getClient(): Langfuse | null {
  if (singleton !== undefined) return singleton;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) {
    singleton = null;
    return null;
  }
  singleton = new Langfuse({
    publicKey,
    secretKey,
    baseUrl: process.env.LANGFUSE_HOST,
  });
  return singleton;
}

export interface TraceHandle {
  /** 실제 Langfuse trace 객체. null이면 env 미설정 — 모든 메서드 no-op. */
  trace: ReturnType<Langfuse["trace"]> | null;
  userId?: string;
  name: string;
}

export interface StartTraceInput {
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export function startTrace(input: StartTraceInput): TraceHandle {
  const client = getClient();
  if (!client) return { trace: null, name: input.name, userId: input.userId };
  const trace = client.trace({
    name: input.name,
    userId: input.userId,
    sessionId: input.sessionId,
    metadata: input.metadata,
    tags: input.tags,
  });
  return { trace, name: input.name, userId: input.userId };
}

export interface GenerationRecord {
  name: string;
  model: string;
  input: unknown;
  output: unknown;
  startTime?: Date;
  endTime?: Date;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

export function recordGeneration(handle: TraceHandle, rec: GenerationRecord): void {
  if (!handle.trace) return;
  try {
    handle.trace.generation({
      name: rec.name,
      model: rec.model,
      input: rec.input,
      output: rec.output,
      startTime: rec.startTime,
      endTime: rec.endTime,
      usage: rec.usage
        ? {
            input: rec.usage.promptTokens,
            output: rec.usage.completionTokens,
            total: rec.usage.totalTokens,
          }
        : undefined,
      metadata: rec.metadata,
    });
  } catch {
    // 관측성은 업스트림 로직을 깨뜨려선 안 됨 — 실패 시 조용히 삼킨다.
  }
}

/**
 * 트레이스 종료 + flush. Serverless 환경에서는 매 요청 말미에 호출 권장.
 */
export async function flushTrace(handle: TraceHandle): Promise<void> {
  if (!handle.trace) return;
  try {
    await getClient()?.flushAsync();
  } catch {
    // ignore
  }
}

/**
 * 테스트·dev-loop에서 싱글톤 재초기화 (주로 테스트용).
 */
export function _resetObservabilityForTests(): void {
  singleton = undefined;
}
