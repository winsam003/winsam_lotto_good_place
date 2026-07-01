import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "전국 로또 명당 순위 TOP 100",
  description:
    "전국 로또 판매점의 역대 1등·2등 배출 횟수를 비교하고 로또 명당 순위 TOP 100을 확인하세요.",
  keywords: ["로또 명당 순위", "로또 1등 많이 나온 곳", "전국 로또 명당"],
  alternates: { canonical: "/ranking" },
  openGraph: {
    title: "전국 로또 명당 순위 TOP 100",
    description: "1등·2등 당첨 배출 횟수로 보는 전국 로또 명당 순위",
    url: "/ranking",
  },
};

export default function RankingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
