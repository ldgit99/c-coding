import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Drizzle에는 timestamptz가 따로 없으므로 timestamp({ withTimezone: true })로 모사.
const timestamptzCol = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

// =============================================================================
// 열거 타입 (SQL 마이그레이션의 public.* enum과 일치)
// =============================================================================

export const userRoleEnum = pgEnum("user_role", ["student", "teacher", "admin"]);
export const interactionModeEnum = pgEnum("interaction_mode", [
  "silent",
  "observer",
  "pair",
  "tutor",
]);
export const interventionLevelEnum = pgEnum("intervention_level", [
  "weak",
  "medium",
  "strong",
]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "draft",
  "submitted",
  "evaluating",
  "passed",
  "failed",
  "needs_review",
]);

// =============================================================================
// cohorts
// =============================================================================

export const cohorts = pgTable("cohorts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  term: text("term").notNull(),
  teacherId: uuid("teacher_id").notNull(),
  createdAt: timestamptzCol("created_at").notNull().defaultNow(),
});

// =============================================================================
// profiles
// =============================================================================

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull(),
  displayName: text("display_name"),
  cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
  createdAt: timestamptzCol("created_at").notNull().defaultNow(),
  lastActiveAt: timestamptzCol("last_active_at"),
});

// =============================================================================
// assignments
// =============================================================================

export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  version: integer("version").notNull().default(1),
  title: text("title").notNull(),
  template: text("template").notNull(),
  kcTags: jsonb("kc_tags").notNull().default(sql`'[]'::jsonb`),
  difficulty: integer("difficulty").notNull(),
  rubric: jsonb("rubric").notNull(),
  constraints: jsonb("constraints").notNull().default(sql`'{}'::jsonb`),
  starterCode: text("starter_code"),
  visibleTests: jsonb("visible_tests").notNull().default(sql`'[]'::jsonb`),
  reflectionPrompts: jsonb("reflection_prompts").notNull().default(sql`'[]'::jsonb`),
  cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  createdAt: timestamptzCol("created_at").notNull().defaultNow(),
  updatedAt: timestamptzCol("updated_at").notNull().defaultNow(),
});

export const assignmentVariants = pgTable("assignment_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: uuid("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  variantCode: text("variant_code").notNull(),
  params: jsonb("params").notNull(),
  hiddenTests: jsonb("hidden_tests").notNull(),
  referenceSolutionPath: text("reference_solution_path"),
  createdAt: timestamptzCol("created_at").notNull().defaultNow(),
});

// =============================================================================
// submissions
// =============================================================================

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  assignmentId: uuid("assignment_id").notNull().references(() => assignments.id),
  variantId: uuid("variant_id").references(() => assignmentVariants.id),
  code: text("code").notNull(),
  reflection: jsonb("reflection").notNull().default(sql`'{}'::jsonb`),
  status: submissionStatusEnum("status").notNull().default("draft"),
  rubricScores: jsonb("rubric_scores"),
  finalScore: numeric("final_score", { precision: 5, scale: 4 }),
  evidence: jsonb("evidence"),
  kcDelta: jsonb("kc_delta"),
  dependencyFactor: numeric("dependency_factor", { precision: 5, scale: 4 }),
  teacherOnlyNotes: text("teacher_only_notes"),
  submittedAt: timestamptzCol("submitted_at"),
  evaluatedAt: timestamptzCol("evaluated_at"),
  createdAt: timestamptzCol("created_at").notNull().defaultNow(),
  updatedAt: timestamptzCol("updated_at").notNull().defaultNow(),
});

// =============================================================================
// conversations
// =============================================================================

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  assignmentId: uuid("assignment_id").references(() => assignments.id),
  messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
  mode: interactionModeEnum("mode").notNull().default("pair"),
  supportLevel: smallint("support_level").notNull().default(0),
  sessionState: jsonb("session_state"),
  startedAt: timestamptzCol("started_at").notNull().defaultNow(),
  lastMessageAt: timestamptzCol("last_message_at").notNull().defaultNow(),
});

// =============================================================================
// mastery (복합 PK)
// =============================================================================

export const mastery = pgTable(
  "mastery",
  {
    studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    kc: text("kc").notNull(),
    value: numeric("value", { precision: 5, scale: 4 }).notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull().default("0"),
    observations: integer("observations").notNull().default(0),
    updatedAt: timestamptzCol("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.kc] }),
  }),
);

// =============================================================================
// misconceptions
// =============================================================================

export const misconceptions = pgTable("misconceptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  kc: text("kc").notNull(),
  pattern: text("pattern").notNull(),
  occurrences: integer("occurrences").notNull().default(1),
  firstSeen: timestamptzCol("first_seen").notNull().defaultNow(),
  lastSeen: timestamptzCol("last_seen").notNull().defaultNow(),
});

// =============================================================================
// events (xAPI)
// =============================================================================

export const events = pgTable("events", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  actor: jsonb("actor").notNull(),
  verb: jsonb("verb").notNull(),
  object: jsonb("object").notNull(),
  result: jsonb("result"),
  context: jsonb("context"),
  studentId: uuid("student_id").references(() => profiles.id, { onDelete: "cascade" }),
  assignmentId: uuid("assignment_id").references(() => assignments.id),
  timestamp: timestamptzCol("timestamp").notNull().defaultNow(),
});

// =============================================================================
// interventions
// =============================================================================

export const interventions = pgTable("interventions", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").notNull().references(() => profiles.id),
  type: text("type").notNull(),
  level: interventionLevelEnum("level"),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  reasons: jsonb("reasons"),
  applied: boolean("applied").notNull().default(false),
  createdAt: timestamptzCol("created_at").notNull().defaultNow(),
});

// =============================================================================
// 타입 추론 export
// =============================================================================

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Assignment = typeof assignments.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Mastery = typeof mastery.$inferSelect;
export type XApiEvent = typeof events.$inferSelect;
export type Intervention = typeof interventions.$inferSelect;
