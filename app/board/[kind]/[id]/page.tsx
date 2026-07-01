"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  LockKeyhole,
  Megaphone,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import type { BoardEntry, BoardKind } from "@/lib/board";
import { isBoardKind } from "@/lib/board";

interface DetailResponse {
  entry?: BoardEntry;
  error?: string;
}

const formatDetailDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export default function BoardDetailPage() {
  const params = useParams<{ kind: string; id: string }>();
  const router = useRouter();
  const kind = isBoardKind(params.kind) ? params.kind : null;
  const [entry, setEntry] = useState<BoardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [credential, setCredential] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!kind) {
      setError("잘못된 게시글 주소입니다.");
      setIsLoading(false);
      return;
    }

    const fetchEntry = async () => {
      try {
        const response = await fetch(
          `/api/board/entries/${kind}/${params.id}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as DetailResponse;
        if (!response.ok || !result.entry) {
          throw new Error(result.error ?? "게시글을 찾을 수 없습니다.");
        }
        setEntry(result.entry);
        setTitle(result.entry.title);
        setContent(result.entry.content);
        setAuthor(result.entry.author);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "게시글을 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchEntry();
  }, [kind, params.id]);

  const requestHeaders = (entryKind: BoardKind) => ({
    "Content-Type": "application/json",
    ...(entryKind === "notice"
      ? { Authorization: `Bearer ${credential}` }
      : {}),
  });

  const updateEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!entry) return;
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/board/entries/${entry.kind}/${entry.id}`,
        {
          method: "PATCH",
          headers: requestHeaders(entry.kind),
          body: JSON.stringify({
            title,
            content,
            author,
            password: entry.kind === "post" ? credential : undefined,
          }),
        },
      );
      const result = (await response.json()) as DetailResponse;
      if (!response.ok) throw new Error(result.error ?? "수정하지 못했습니다.");
      setEntry({
        ...entry,
        title,
        content,
        author: entry.kind === "notice" ? "관리자" : author,
        updatedAt: new Date().toISOString(),
      });
      setCredential("");
      setIsEditing(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "수정 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditor = async () => {
    if (!entry || !credential) return;
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/board/entries/${entry.kind}/${entry.id}`,
        {
          method: "POST",
          headers: requestHeaders(entry.kind),
          body: JSON.stringify({ password: credential }),
        },
      );
      const result = (await response.json()) as DetailResponse;
      if (!response.ok) {
        throw new Error(result.error ?? "비밀번호가 일치하지 않습니다.");
      }
      setIsEditing(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "비밀번호 확인 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteEntry = async () => {
    if (!entry || !credential) {
      setError(entry?.kind === "notice" ? "관리자 비밀번호를 입력해 주세요." : "글 비밀번호를 입력해 주세요.");
      return;
    }
    if (!window.confirm("이 게시글을 삭제할까요?")) return;
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/board/entries/${entry.kind}/${entry.id}`,
        {
          method: "DELETE",
          headers: requestHeaders(entry.kind),
          body:
            entry.kind === "post"
              ? JSON.stringify({ password: credential })
              : undefined,
        },
      );
      const result = (await response.json()) as DetailResponse;
      if (!response.ok) throw new Error(result.error ?? "삭제하지 못했습니다.");
      router.push("/board");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "삭제 중 오류가 발생했습니다.");
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-canvas soft-grid px-4 py-7 md:px-6 md:py-12">
      <div className="mx-auto max-w-3xl animate-enter">
        <Link href="/board" className="mb-7 inline-flex items-center gap-2 text-xs font-extrabold text-[#68738a] transition hover:text-[#4f46e5]"><ArrowLeft size={15} /> 게시판으로</Link>

        {isLoading ? (
          <div className="surface-card h-96 animate-pulse rounded-[1.75rem] bg-white" />
        ) : !entry ? (
          <div className="surface-card rounded-[1.75rem] p-10 text-center text-sm font-bold text-red-500">{error}</div>
        ) : (
          <article className="surface-card overflow-hidden rounded-[1.75rem]">
            {!isEditing ? (
              <>
                <header className="border-b border-[#eceef4] p-5 md:p-8">
                  {entry.kind === "notice" && <span className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-[#fff0d5] px-2.5 py-1.5 text-[10px] font-black text-[#a66c18]"><Megaphone size={12} /> 공지사항</span>}
                  <h1 className="text-2xl font-black leading-tight tracking-[-0.04em] text-[#202942] md:text-3xl">{entry.title}</h1>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-semibold text-[#9299aa]"><span className="inline-flex items-center gap-1"><UserRound size={12} /> {entry.author}</span><span className="inline-flex items-center gap-1"><CalendarClock size={12} /> {formatDetailDate(entry.createdAt)}</span></div>
                </header>
                <div className="min-h-64 whitespace-pre-wrap p-5 text-sm font-medium leading-7 text-[#414b61] md:p-8">{entry.content}</div>
                {entry.kind === "post" && <footer className="border-t border-[#eceef4] bg-[#fafbfc] p-4 md:px-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} placeholder="글 비밀번호" className="focus-field rounded-xl border border-[#e0e2eb] bg-white px-3.5 py-2.5 text-xs font-semibold outline-none" /><div className="flex gap-2"><button onClick={() => void openEditor()} disabled={isSubmitting || !credential} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#dfe1ea] bg-white px-4 py-2.5 text-xs font-extrabold text-[#525c72] hover:text-[#4f46e5] disabled:cursor-not-allowed disabled:bg-[#f1f2f5] disabled:text-[#b0b5c0]"><Pencil size={13} /> {isSubmitting ? "확인 중" : "수정"}</button><button onClick={() => void deleteEntry()} disabled={isSubmitting || !credential} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#fff0ed] px-4 py-2.5 text-xs font-extrabold text-[#df5e4a] disabled:cursor-not-allowed disabled:bg-[#f1f2f5] disabled:text-[#b0b5c0]"><Trash2 size={13} /> 삭제</button></div></div>
                  {error && <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-500">{error}</p>}
                </footer>}
              </>
            ) : (
              <form onSubmit={updateEntry} className="space-y-5 p-5 md:p-8">
                <div><p className="eyebrow">Edit entry</p><h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#202942]">게시글 수정</h1></div>
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required className="focus-field w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] px-4 py-3.5 text-sm font-semibold outline-none" />
                <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={5000} required rows={12} className="focus-field w-full resize-y rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] px-4 py-3.5 text-sm font-medium leading-6 outline-none" />
                {entry.kind === "post" && <input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={20} required className="focus-field w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] px-4 py-3.5 text-sm font-semibold outline-none" placeholder="작성자" />}
                <label className="block"><span className="mb-2 ml-1 flex items-center gap-1.5 text-[10px] font-extrabold text-[#8f97a8]"><LockKeyhole size={12} /> {entry.kind === "notice" ? "관리자 비밀번호" : "글 비밀번호"}</span><input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} required className="focus-field w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] px-4 py-3.5 text-sm font-semibold outline-none" /></label>
                {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-500">{error}</p>}
                <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setIsEditing(false); setError(""); }} className="rounded-xl border border-[#dfe1ea] bg-white py-3 text-xs font-extrabold text-[#68738a]">취소</button><button type="submit" disabled={isSubmitting} className="rounded-xl bg-[#4f46e5] py-3 text-xs font-extrabold text-white disabled:bg-[#b7bbc8]">{isSubmitting ? "저장 중..." : "수정 완료"}</button></div>
              </form>
            )}
          </article>
        )}
      </div>
    </main>
  );
}
