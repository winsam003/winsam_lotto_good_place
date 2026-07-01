"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { BoardKind } from "@/lib/board";

interface CreateResponse {
  id?: string;
  kind?: BoardKind;
  error?: string;
}

export default function BoardWritePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitEntry = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/board/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "post",
          title,
          content,
          author,
          password,
        }),
      });
      const result = (await response.json()) as CreateResponse;
      if (!response.ok || !result.id || !result.kind) {
        throw new Error(result.error ?? "글을 작성하지 못했습니다.");
      }
      router.push(`/board/${result.kind}/${result.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "작성 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-canvas soft-grid px-4 py-7 md:px-6 md:py-12">
      <div className="mx-auto max-w-2xl animate-enter">
        <Link href="/board" className="mb-7 inline-flex items-center gap-2 text-xs font-extrabold text-[#68738a] transition hover:text-[#4f46e5]"><ArrowLeft size={15} /> 게시판으로</Link>
        <div className="surface-card rounded-[1.75rem] p-5 md:p-8">
          <div className="mb-7"><p className="eyebrow">New post</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#172033]">자유글 쓰기</h1><p className="mt-2 text-xs font-medium text-[#858d9f]">작성한 글은 글 비밀번호로 수정·삭제할 수 있습니다.</p></div>

          <form onSubmit={submitEntry} className="space-y-5">
            <label className="block"><span className="mb-2 ml-1 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8f97a8]">제목</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required className="focus-field w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] px-4 py-3.5 text-sm font-semibold outline-none" placeholder="제목을 입력해 주세요" /></label>
            <label className="block"><span className="mb-2 ml-1 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8f97a8]">내용</span><textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={5000} required rows={12} className="focus-field w-full resize-y rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] px-4 py-3.5 text-sm font-medium leading-6 outline-none" placeholder="내용을 입력해 주세요" /></label>

            <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 ml-1 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8f97a8]">작성자</span><input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={20} required className="focus-field w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] px-4 py-3.5 text-sm font-semibold outline-none" /></label><label className="block"><span className="mb-2 ml-1 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8f97a8]">글 비밀번호</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={4} maxLength={50} required className="focus-field w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] px-4 py-3.5 text-sm font-semibold outline-none" placeholder="수정·삭제에 필요합니다" /></label></div>

            {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-500">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-[#4f46e5] py-4 text-sm font-extrabold text-white shadow-lg transition hover:bg-[#4338ca] disabled:bg-[#b7bbc8]">{isSubmitting ? "저장 중..." : "글 등록"}</button>
          </form>
        </div>
      </div>
    </main>
  );
}
