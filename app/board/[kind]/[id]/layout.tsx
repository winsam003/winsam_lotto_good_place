import type { Metadata } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { BOARD_COLLECTIONS } from "@/lib/board-server";
import { isBoardKind } from "@/lib/board";

export const revalidate = 3600;

interface BoardEntryLayoutProps {
  children: React.ReactNode;
  params: Promise<{ kind: string; id: string }>;
}

export async function generateMetadata({
  params,
}: Omit<BoardEntryLayoutProps, "children">): Promise<Metadata> {
  try {
    const { kind, id } = await params;
    if (!isBoardKind(kind)) return { robots: { index: false, follow: false } };

    const snapshot = await getAdminDb()
      .collection(BOARD_COLLECTIONS[kind])
      .doc(id)
      .get();
    if (!snapshot.exists) {
      return {
        title: "게시글을 찾을 수 없습니다",
        robots: { index: false, follow: false },
      };
    }

    const data = snapshot.data();
    const title = String(data?.title ?? "로또 게시글");
    const description = String(data?.content ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 155);
    const canonical = `/board/${kind}/${id}`;

    return {
      title,
      description: description || "로또 자유게시판 게시글입니다.",
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        type: "article",
        publishedTime: data?.createdAt?.toDate?.().toISOString(),
        modifiedTime: data?.updatedAt?.toDate?.().toISOString(),
      },
    };
  } catch (error) {
    console.error("Board metadata error:", error);
    return { title: "로또 게시판 게시글" };
  }
}

export default function BoardEntryLayout({ children }: BoardEntryLayoutProps) {
  return children;
}
