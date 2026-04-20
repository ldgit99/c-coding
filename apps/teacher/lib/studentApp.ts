/**
 * 학생 앱 URL 해석. 개발은 :3000, 운영은 student.cvibe.app.
 */
export function studentAppUrl(): string {
  return process.env.NEXT_PUBLIC_STUDENT_APP_URL ?? "http://localhost:3000";
}
