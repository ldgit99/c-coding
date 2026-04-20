import { DEMO_STUDENT_USER, DEMO_TEACHER_USER } from "../auth";

/**
 * Auth 스텁이 실제 DB로 전환될 때 insert할 demo 레코드.
 * 현재는 참조용 상수 — Week 10+ auth 활성화 시 supabase seed에 투입.
 */
export const DEMO_USERS = [DEMO_STUDENT_USER, DEMO_TEACHER_USER];
