import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/board-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { error: "관리자 비밀번호가 일치하지 않습니다." },
      { status: 401 },
    );
  }

  return NextResponse.json({ success: true });
}
