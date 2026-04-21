/**
 * 학생-AI 대화 로그 저장소.
 *
 * 교사 전용 열람 경로를 위해 발화/응답 원문을 학생별 링 버퍼에 보관한다.
 * xapi store가 메타데이터(verb·level)만 저장하는 것과 역할이 명확히 갈린다.
 *
 * PII 원칙: 학생 ID는 그대로 키로 사용(해시 아님). 교사 앱 상세 페이지만
 * 이 값을 읽도록 /api/conversations를 뒤에서 프록시한다. Supabase 연결 후에는
 * `conversations` 테이블 + RLS로 교사 role만 SELECT 가능.
 *
 * Week 12 MVP: 서버리스 cold start 시 유실 가능. 실제 저장은 Supabase로 이관.
 */

const MAX_PER_STUDENT = 200;
const MAX_UTTERANCE = 4000;

export type Role = "student" | "ai";

export interface ConversationTurn {
  id: string;
  studentId: string;
  role: Role;
  text: string;
  timestamp: string;
  assignmentId?: string;
  meta?: {
    hintLevel?: 1 | 2 | 3 | 4;
    hintType?: string;
    mode?: string;
    usedModel?: string;
    blockedBySafety?: boolean;
  };
}

interface ConvState {
  byStudent: Map<string, ConversationTurn[]>;
}

const globalKey = "__cvibe_conversation_store__" as const;

function getStore(): ConvState {
  const g = globalThis as unknown as Record<string, ConvState>;
  if (!g[globalKey]) {
    g[globalKey] = { byStudent: new Map() };
  }
  return g[globalKey]!;
}

function clampText(text: string): string {
  if (text.length <= MAX_UTTERANCE) return text;
  return text.slice(0, MAX_UTTERANCE) + " …[truncated]";
}

export function recordTurn(turn: Omit<ConversationTurn, "id" | "timestamp"> & {
  timestamp?: string;
}): ConversationTurn {
  const s = getStore();
  const stored: ConversationTurn = {
    id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: turn.timestamp ?? new Date().toISOString(),
    studentId: turn.studentId,
    role: turn.role,
    text: clampText(turn.text),
    assignmentId: turn.assignmentId,
    meta: turn.meta,
  };
  const bucket = s.byStudent.get(turn.studentId) ?? [];
  bucket.push(stored);
  if (bucket.length > MAX_PER_STUDENT) bucket.splice(0, bucket.length - MAX_PER_STUDENT);
  s.byStudent.set(turn.studentId, bucket);
  return stored;
}

export interface GetConversationOpts {
  studentId: string;
  assignmentId?: string;
  limit?: number;
  since?: string;
}

export function getConversation(opts: GetConversationOpts): ConversationTurn[] {
  const s = getStore();
  const bucket = s.byStudent.get(opts.studentId) ?? [];
  let turns = bucket;
  if (opts.assignmentId) {
    turns = turns.filter((t) => t.assignmentId === opts.assignmentId);
  }
  if (opts.since) {
    turns = turns.filter((t) => t.timestamp > opts.since!);
  }
  if (opts.limit && opts.limit > 0) {
    turns = turns.slice(-opts.limit);
  }
  return turns;
}

export function clearConversation(studentId?: string): void {
  const s = getStore();
  if (studentId) s.byStudent.delete(studentId);
  else s.byStudent.clear();
}
