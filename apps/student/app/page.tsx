import { StudentWorkspace } from "@/components/StudentWorkspace";
import { getSessionUser } from "@/lib/session";

/**
 * 학생 앱 엔트리 — Server Component.
 * 서버에서 user 해석 후 StudentWorkspace(Client)에 주입.
 * Supabase Auth env가 없으면 DEMO_STUDENT_USER fallback.
 */
export default async function StudentHome() {
  const user = await getSessionUser();
  return <StudentWorkspace user={user} />;
}
