import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "자유게시판 글쓰기",
  robots: { index: false, follow: false },
};

export default function BoardWriteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
