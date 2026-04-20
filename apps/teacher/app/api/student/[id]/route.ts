import { NextResponse } from "next/server";

import { DEMO_STUDENTS } from "@cvibe/db";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const student = DEMO_STUDENTS.find((s) => s.id === id);
  if (!student) {
    return NextResponse.json({ error: "student not found" }, { status: 404 });
  }
  return NextResponse.json({ student });
}
