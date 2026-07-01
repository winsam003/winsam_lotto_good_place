import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { isBoardKind } from "@/lib/board";
import {
  BOARD_COLLECTIONS,
  isAdminRequest,
  serializeBoardEntry,
  validateBoardFields,
  verifyPostPassword,
} from "@/lib/board-server";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ kind: string; id: string }>;
}

const getEntryDocument = async (context: RouteContext) => {
  const { kind, id } = await context.params;
  if (!isBoardKind(kind) || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  return { kind, document: getAdminDb().collection(BOARD_COLLECTIONS[kind]).doc(id) };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const target = await getEntryDocument(context);
    if (!target) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const snapshot = await target.document.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ entry: serializeBoardEntry(snapshot, target.kind) });
  } catch (error) {
    console.error("Board detail error:", error);
    return NextResponse.json({ error: "게시글을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const target = await getEntryDocument(context);
    if (!target) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const snapshot = await target.document.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    if (target.kind === "notice") {
      if (!isAdminRequest(request)) {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 });
      }
    } else {
      const body = (await request.json()) as Record<string, unknown>;
      const password = String(body.password ?? "");
      const storedHash = String(snapshot.data()?.passwordHash ?? "");
      if (!verifyPostPassword(password, storedHash)) {
        return NextResponse.json({ error: "글 비밀번호가 일치하지 않습니다." }, { status: 401 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Board credential verification error:", error);
    return NextResponse.json({ error: "비밀번호를 확인하지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const target = await getEntryDocument(context);
    if (!target) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const validated = validateBoardFields(body);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const snapshot = await target.document.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    if (target.kind === "notice") {
      if (!isAdminRequest(request)) {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 });
      }
    } else {
      const password = String(body.password ?? "");
      const storedHash = String(snapshot.data()?.passwordHash ?? "");
      if (!verifyPostPassword(password, storedHash)) {
        return NextResponse.json({ error: "글 비밀번호가 일치하지 않습니다." }, { status: 401 });
      }
    }

    await target.document.update({
      title: validated.title,
      content: validated.content,
      author: target.kind === "notice" ? "관리자" : validated.author,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Board update error:", error);
    return NextResponse.json({ error: "게시글을 수정하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const target = await getEntryDocument(context);
    if (!target) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const snapshot = await target.document.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    if (target.kind === "notice") {
      if (!isAdminRequest(request)) {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 });
      }
    } else {
      const body = (await request.json()) as Record<string, unknown>;
      const password = String(body.password ?? "");
      const storedHash = String(snapshot.data()?.passwordHash ?? "");
      if (!verifyPostPassword(password, storedHash)) {
        return NextResponse.json({ error: "글 비밀번호가 일치하지 않습니다." }, { status: 401 });
      }
    }

    await target.document.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Board delete error:", error);
    return NextResponse.json({ error: "게시글을 삭제하지 못했습니다." }, { status: 500 });
  }
}
