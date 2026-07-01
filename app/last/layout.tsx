import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이번 회차 로또 1등·2등 당첨 판매점",
  description:
    "최신 로또 회차의 1등·2등 당첨 판매점과 판매점별 당첨 배출 횟수를 확인하세요.",
  keywords: ["이번주 로또 당첨 판매점", "로또 1등 판매점", "최신 로또 명당"],
  alternates: { canonical: "/last" },
  openGraph: {
    title: "이번 회차 로또 당첨 판매점",
    description: "최신 회차 1등·2등 당첨 판매점 정보",
    url: "/last",
  },
};

export default function LastLayout({ children }: { children: React.ReactNode }) {
  return children;
}
