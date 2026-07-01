import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { isBoardKind } from "@/lib/board";
import {
  BOARD_COLLECTIONS,
  hashPostPassword,
  isAdminRequest,
  serializeBoardEntry,
  validateBoardFields,
} from "@/lib/board-server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getAdminDb();
    const [noticeSnapshot, postSnapshot] = await Promise.all([
      db
        .collection(BOARD_COLLECTIONS.notice)
        .orderBy("createdAt", "desc")
        .limit(20)
        .get(),
      db
        .collection(BOARD_COLLECTIONS.post)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get(),
    ]);

    return NextResponse.json({
      notices: noticeSnapshot.docs.map((document) =>
        serializeBoardEntry(document, "notice"),
      ),
      posts: postSnapshot.docs.map((document) =>
        serializeBoardEntry(document, "post"),
      ),
    });
  } catch (error) {
    console.error("Board list error:", error);
    return NextResponse.json(
      { error: "게시글을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kindValue = String(body.kind ?? "");
    if (!isBoardKind(kindValue)) {
      return NextResponse.json({ error: "잘못된 게시글 유형입니다." }, { status: 400 });
    }

    const validated = validateBoardFields(body);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    if (kindValue === "notice" && !isAdminRequest(request)) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 });
    }

    const password = String(body.password ?? "");
    if (kindValue === "post" && (password.length < 4 || password.length > 50)) {
      return NextResponse.json(
        { error: "글 비밀번호는 4~50자로 입력해 주세요." },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const document = db.collection(BOARD_COLLECTIONS[kindValue]).doc();
    await document.set({
      title: validated.title,
      content: validated.content,
      author: kindValue === "notice" ? "관리자" : validated.author,
      ...(kindValue === "post"
        ? { passwordHash: hashPostPassword(password) }
        : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { id: document.id, kind: kindValue },
      { status: 201 },
    );
  } catch (error) {
    console.error("Board create error:", error);
    return NextResponse.json(
      { error: "게시글을 작성하지 못했습니다." },
      { status: 500 },
    );
  }
}
