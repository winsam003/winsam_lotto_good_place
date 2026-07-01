import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { BoardEntry, BoardKind } from "@/lib/board";

export const BOARD_COLLECTIONS: Record<BoardKind, string> = {
  post: "board_posts",
  notice: "board_notices",
};

const safeEqual = (first: string, second: string) => {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
};

export const hashPostPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

export const verifyPostPassword = (password: string, storedValue: string) => {
  const [salt, storedHash] = storedValue.split(":");
  if (!salt || !storedHash) return false;
  const providedHash = scryptSync(password, salt, 64).toString("hex");
  return safeEqual(providedHash, storedHash);
};

export const isAdminRequest = (request: Request) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const authorization = request.headers.get("authorization");
  if (!adminPassword || !authorization?.startsWith("Bearer ")) return false;
  return safeEqual(authorization.slice(7), adminPassword);
};

export const serializeBoardEntry = (
  snapshot: DocumentSnapshot,
  kind: BoardKind,
): BoardEntry => {
  const data = snapshot.data();
  const createdAt = data?.createdAt?.toDate?.() ?? new Date();
  const updatedAt = data?.updatedAt?.toDate?.() ?? createdAt;

  return {
    id: snapshot.id,
    kind,
    title: String(data?.title ?? ""),
    content: String(data?.content ?? ""),
    author: String(data?.author ?? (kind === "notice" ? "관리자" : "익명")),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
};

export const validateBoardFields = (body: Record<string, unknown>) => {
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const author = String(body.author ?? "").trim();

  if (title.length < 2 || title.length > 100) {
    return { error: "제목은 2~100자로 입력해 주세요." } as const;
  }
  if (content.length < 2 || content.length > 5000) {
    return { error: "내용은 2~5000자로 입력해 주세요." } as const;
  }
  if (author.length < 1 || author.length > 20) {
    return { error: "작성자는 1~20자로 입력해 주세요." } as const;
  }

  return { title, content, author } as const;
};
