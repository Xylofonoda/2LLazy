import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Auto-apply not available" }, { status: 501 });
}
