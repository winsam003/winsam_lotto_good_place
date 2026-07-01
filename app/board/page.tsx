"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Megaphone,
  MessageSquareText,
  PenLine,
} from "lucide-react";
import type { BoardEntry } from "@/lib/board";

interface BoardListResponse {
  notices: BoardEntry[];
  posts: BoardEntry[];
  error?: string;
}

const formatBoardDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export default function BoardPage() {
  const [notices, setNotices] = useState<BoardEntry[]>([]);
  const [posts, setPosts] = useState<BoardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const response = await fetch("/api/board/entries", { cache: "no-store" });
        const result = (await response.json()) as BoardListResponse;
        if (!response.ok) throw new Error(result.error);
        setNotices(result.notices);
        setPosts(result.posts);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "게시글을 불러오지 못했습니다.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchEntries();
  }, []);

  return (
    <main className="page-canvas soft-grid px-4 py-7 md:px-6 md:py-12">
      <div className="mx-auto max-w-4xl animate-enter">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-extrabold text-[#68738a] transition hover:text-[#4f46e5]"><ArrowLeft size={15} /> 지도로 돌아가기</Link>

        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="mb-3 flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4f46e5]"><MessageSquareText size={16} /></span><p className="eyebrow">Community</p></div><h1 className="text-3xl font-black tracking-[-0.05em] text-[#172033] md:text-5xl">자유게시판</h1><p className="mt-3 text-sm font-medium text-[#737d91]">로또 이야기와 명당 정보를 편하게 나눠보세요.</p></div>
          <Link href="/board/write" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4f46e5] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5 hover:bg-[#4338ca]"><PenLine size={16} /> 글쓰기</Link>
        </header>

        {error ? (
          <div className="surface-card rounded-2xl border-red-100 bg-red-50 p-8 text-center text-sm font-bold text-red-500">{error}</div>
        ) : isLoading ? (
          <div className="surface-card space-y-3 rounded-[1.5rem] p-4">{[...Array(6)].map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-[#f1f2f6]" />)}</div>
        ) : (
          <div className="space-y-5">
            <section className="surface-card overflow-hidden rounded-[1.5rem]">
              <div className="flex items-center justify-between border-b border-[#eceef4] bg-[#fffbf2] px-5 py-3.5"><span className="flex items-center gap-2 text-xs font-extrabold text-[#a66c18]"><Megaphone size={14} /> 공지사항</span><span className="text-[10px] font-bold text-[#b69a70]">{notices.length}개</span></div>
              {notices.length > 0 ? <div className="divide-y divide-[#f0f1f5]">{notices.map((entry) => <Link key={entry.id} href={`/board/notice/${entry.id}`} className="group flex items-center gap-3 px-5 py-4 transition hover:bg-[#fffdf8]"><span className="rounded-lg bg-[#fff0d5] px-2 py-1 text-[9px] font-black text-[#b76a13]">공지</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-[#30394e] group-hover:text-[#4f46e5]">{entry.title}</p><p className="mt-1 text-[10px] font-medium text-[#9aa1b1]">{formatBoardDate(entry.createdAt)}</p></div><ChevronRight size={16} className="text-[#b4b9c5]" /></Link>)}</div> : <div className="px-5 py-8 text-center text-xs font-semibold text-[#a19a8e]">등록된 공지사항이 없습니다.</div>}
            </section>

            <section className="surface-card overflow-hidden rounded-[1.5rem]">
              <div className="flex items-center justify-between border-b border-[#eceef4] bg-[#fafbfc] px-5 py-4"><span className="text-xs font-extrabold text-[#4d576c]">자유글</span><span className="text-[10px] font-bold text-[#9aa1b1]">{posts.length}개</span></div>
              {posts.length > 0 ? <div className="divide-y divide-[#f0f1f5]">{posts.map((entry) => <Link key={entry.id} href={`/board/post/${entry.id}`} className="group flex items-center gap-3 px-5 py-4 transition hover:bg-[#f8f8ff]"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f0f1f7] text-[#737d91]"><MessageSquareText size={15} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-[#30394e] group-hover:text-[#4f46e5]">{entry.title}</p><p className="mt-1 text-[10px] font-medium text-[#9aa1b1]">{entry.author} · {formatBoardDate(entry.createdAt)}</p></div><ChevronRight size={16} className="text-[#b4b9c5]" /></Link>)}</div> : <div className="px-5 py-20 text-center text-sm font-semibold text-[#959cad]">첫 번째 글을 작성해 보세요.</div>}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
