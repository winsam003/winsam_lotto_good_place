import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로또 자유게시판과 공지사항",
  description:
    "로또 명당, 당첨 판매점, 로또 이야기를 나누는 자유게시판과 서비스 공지사항을 확인하세요.",
  alternates: { canonical: "/board" },
  openGraph: {
    title: "로또 자유게시판",
    description: "로또 명당과 당첨 정보를 함께 나누는 공간",
    url: "/board",
  },
};

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
