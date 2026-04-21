import { createHash } from "node:crypto";
import { z } from "zod";

import { ASSIGNMENT_BASE, CODE_BASE, KC_BASE, Verbs, type VerbId } from "./verbs";

export * from "./verbs";
export * from "./store";
export * from "./conversation-store";
export * from "./analytics";

// =============================================================================
// xAPI 스테이트먼트 스키마 (research.md §4.4)
// =============================================================================

export const XApiStatement = z.object({
  id: z.string().uuid().optional(),
  actor: z.object({
    account: z.object({
      name: z.string(),
      homePage: z.url().optional(),
    }),
  }),
  verb: z.object({
    id: z.url(),
    display: z.record(z.string(), z.string()).optional(),
  }),
  object: z.object({
    id: z.url(),
    definition: z
      .object({
        type: z.url().optional(),
        name: z.record(z.string(), z.string()).optional(),
      })
      .optional(),
  }),
  result: z
    .object({
      extensions: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  context: z
    .object({
      extensions: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  timestamp: z.iso.datetime(),
});

export type XApiStatementT = z.infer<typeof XApiStatement>;

// =============================================================================
// learner ID 해시 (PII 최소화)
// =============================================================================

export function hashLearnerId(studentId: string): string {
  const hash = createHash("sha256").update(studentId).digest("hex");
  return `learner_${hash.slice(0, 12)}`;
}

export function hashTeacherId(teacherId: string): string {
  const hash = createHash("sha256").update(teacherId).digest("hex");
  return `teacher_${hash.slice(0, 12)}`;
}

// =============================================================================
// 스테이트먼트 빌더
// =============================================================================

export interface BuildStatementInput {
  actor: { type: "student" | "teacher" | "agent"; id: string };
  verb: VerbId;
  object:
    | { type: "kc"; slug: string }
    | { type: "assignment"; id: string }
    | { type: "code"; submissionId: string };
  result?: Record<string, unknown>;
  context?: {
    assignmentId?: string;
    mode?: string;
    sessionId?: string;
    [key: string]: unknown;
  };
  timestamp?: Date;
}

export function buildStatement(input: BuildStatementInput): XApiStatementT {
  const actorName =
    input.actor.type === "student"
      ? hashLearnerId(input.actor.id)
      : input.actor.type === "teacher"
        ? hashTeacherId(input.actor.id)
        : `agent:${input.actor.id}`;

  const objectId =
    input.object.type === "kc"
      ? `${KC_BASE}/${input.object.slug}`
      : input.object.type === "assignment"
        ? `${ASSIGNMENT_BASE}/${input.object.id}`
        : `${CODE_BASE}/${input.object.submissionId}`;

  const statement: XApiStatementT = {
    actor: {
      account:
        input.actor.type === "agent"
          ? { name: actorName }
          : { name: actorName, homePage: "https://cvibe.app" },
    },
    verb: { id: input.verb },
    object: { id: objectId },
    timestamp: (input.timestamp ?? new Date()).toISOString(),
  };

  if (input.result) {
    statement.result = {
      extensions: Object.fromEntries(
        Object.entries(input.result).map(([k, v]) => [`${KC_BASE.replace("/kc", "/ext")}/${k}`, v]),
      ),
    };
  }

  if (input.context) {
    statement.context = {
      extensions: Object.fromEntries(
        Object.entries(input.context).map(([k, v]) => [`${KC_BASE.replace("/kc", "/ext")}/${k}`, v]),
      ),
    };
  }

  return XApiStatement.parse(statement);
}

// 빠른 생성 헬퍼
export const xapi = { build: buildStatement, verbs: Verbs };
