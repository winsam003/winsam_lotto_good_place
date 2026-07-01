"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import type { BoardEntry } from "@/lib/board";

interface ApiResponse {
  notices?: BoardEntry[];
  error?: string;
}

export default function NoticeConsolePage() {
  const [adminPassword, setAdminPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [notices, setNotices] = useState<BoardEntry[]>([]);
  const [editingNotice, setEditingNotice] = useState<BoardEntry | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const adminHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminPassword}`,
  };

  const loadNotices = async () => {
    const response = await fetch("/api/board/entries", { cache: "no-store" });
    const result = (await response.json()) as ApiResponse;
    if (!response.ok) throw new Error(result.error ?? "공지를 불러오지 못했습니다.");
    setNotices(result.notices ?? []);
  };

  const authenticate = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/board/admin/verify", {
        method: "POST",
        headers: adminHeaders,
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(result.error ?? "인증하지 못했습니다.");
      await loadNotices();
      setIsAuthenticated(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "인증 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetEditor = () => {
    setEditingNotice(null);
    setTitle("");
    setContent("");
    setError("");
  };

  const selectNotice = (notice: BoardEntry) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setError("");
  };

  const saveNotice = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(
        editingNotice ? `/api/board/entries/notice/${editingNotice.id}` : "/api/board/entries",
        {
          method: editingNotice ? "PATCH" : "POST",
          headers: adminHeaders,
          body: JSON.stringify({
            kind: "notice",
            title,
            content,
            author: "관리자",
          }),
        },
      );
      const result = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(result.error ?? "공지를 저장하지 못했습니다.");
      await loadNotices();
      resetEditor();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteNotice = async (notice: BoardEntry) => {
    if (!window.confirm(`\"${notice.title}\" 공지를 삭제할까요?`)) return;
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/board/entries/notice/${notice.id}`, {
        method: "DELETE",
        headers: adminHeaders,
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(result.error ?? "공지를 삭제하지 못했습니다.");
      await loadNotices();
      if (editingNotice?.id === notice.id) resetEditor();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-canvas soft-grid min-h-screen px-4 py-7 md:px-6 md:py-12">
      <div className="mx-auto max-w-4xl animate-enter">
        <Link
          href="/board"
          className="mb-7 inline-flex items-center gap-2 text-xs font-extrabold text-[#68738a] transition hover:text-[#4f46e5]"
        >
          <ArrowLeft size={15} /> 게시판으로
        </Link>

        {!isAuthenticated ? (
          <form onSubmit={authenticate} className="surface-card mx-auto max-w-md rounded-[1.75rem] p-7 md:p-9">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#fff0d5] text-[#a66c18]">
              <LockKeyhole size={20} />
            </span>
            <p className="eyebrow mt-6">Private console</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#202942]">공지 관리</h1>
            <p className="mt-2 text-xs font-medium leading-5 text-[#858d9f]">
              공개 게시판에서는 접근할 수 없는 관리자 전용 화면입니다.
            </p>
            <input
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              required
              placeholder="관리자 비밀번호"
              className="focus-field mt-6 w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] px-4 py-3.5 text-sm font-semibold outline-none"
            />
            {error && (
              <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-500">
                {error}
              </p>
            )}
            <button
              disabled={isSubmitting}
              className="mt-4 w-full rounded-2xl bg-[#202942] py-3.5 text-sm font-extrabold text-white disabled:bg-[#b7bbc8]"
            >
              {isSubmitting ? "확인 중..." : "관리 콘솔 열기"}
            </button>
          </form>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="surface-card overflow-hidden rounded-[1.5rem]">
                <div className="border-b border-[#eceef4] bg-[#fafbfc] px-5 py-4 text-xs font-extrabold text-[#4d576c]">
                  등록된 공지
                </div>
                <div className="divide-y divide-[#f0f1f5]">
                  {notices.length > 0 ? (
                    notices.map((notice) => (
                      <div
                        key={notice.id}
                        className={`p-4 ${editingNotice?.id === notice.id ? "bg-[#fffaf0]" : "bg-white"}`}
                      >
                        <p className="truncate text-sm font-extrabold text-[#30394e]">{notice.title}</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => selectNotice(notice)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#f1f2f6] px-2.5 py-1.5 text-[10px] font-bold text-[#626c80]"
                          >
                            <Pencil size={11} /> 수정
                          </button>
                          <button
                            onClick={() => void deleteNotice(notice)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#fff0ed] px-2.5 py-1.5 text-[10px] font-bold text-[#df5e4a]"
                          >
                            <Trash2 size={11} /> 삭제
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-10 text-center text-xs font-semibold text-[#969daf]">등록된 공지가 없습니다.</div>
                  )}
                </div>
              </section>

              <form onSubmit={saveNotice} className="surface-card space-y-5 rounded-[1.5rem] p-5 md:p-6">
                <div>
                  <p className="eyebrow">{editingNotice ? "Edit notice" : "New notice"}</p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#202942]">
                    {editingNotice ? "공지 수정" : "새 공지 작성"}
                  </h2>
                </div>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={100}
                  required
                  placeholder="제목"
                  className="focus-field w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] px-4 py-3.5 text-sm font-semibold outline-none"
                />
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  maxLength={5000}
                  required
                  rows={12}
                  placeholder="내용"
                  className="focus-field w-full resize-y rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] px-4 py-3.5 text-sm font-medium leading-6 outline-none"
                />
                {error && (
                  <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-500">
                    {error}
                  </p>
                )}
                <button
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-[#4f46e5] py-3.5 text-xs font-extrabold text-white disabled:bg-[#b7bbc8]"
                >
                  {isSubmitting ? "저장 중..." : editingNotice ? "수정 완료" : "공지 등록"}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
