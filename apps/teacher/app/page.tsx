import { TeacherDashboard } from "@/components/TeacherDashboard";
import { getSessionUser } from "@/lib/session";

/**
 * 교사 앱 엔트리 — Server Component.
 * Supabase Auth env가 없으면 DEMO_TEACHER_USER fallback.
 */
export default async function TeacherHome() {
  const user = await getSessionUser();
  return <TeacherDashboard user={user} />;
}
