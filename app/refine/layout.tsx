import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "데이터 정제 관리",
  robots: { index: false, follow: false, noarchive: true },
};

export default function RefineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
