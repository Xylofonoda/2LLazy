import { NextResponse } from "next/server";
export async function POST() {
  return new NextResponse("Feature removed", { status: 410 });
}
