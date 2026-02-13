import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "내주변 로또 명당 - WinSam Lotto Good Place",
  description: "현재 내 위치 기반 전국 로또 명당 정보를 지도에서 바로 확인하세요. 1등 당첨 빈도순 정렬, 최근 당첨 판매점 정보 등 가장 정확한 로또 명당 데이터를 제공합니다.",
  keywords: ["로또 명당", "내주변 로또", "로또 1등 판매점", "로또 명당 지도", "전국 로또 명당", "로또 당첨 번호 확인"],
  openGraph: {
    title: "내 주변 로또 명당 - WinSam Lotto Good Place",
    description: "지도 기반 실시간 로또 명당 찾기 서비스",
    url: "https://lotto-good-place.winsam.xyz",
    siteName: "WinSam Lotto Good Place",
    locale: "ko_KR",
    type: "website",
  },
  verification: {
    google: "RNkeSZzWbR8T4Pp_OTNspdHciimBargpK1SBOpatEyY",
  },
  other: {
    "naver-site-verification": "65a5af9b122c01021f27ce178ec32e29944d47ca",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_MAP_CLIENT_ID;

  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        {children}
        {/* 키값이 존재할 때만 스크립트를 로드하도록 명시 */}
        {kakaoKey && (
          <Script
            src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false&libraries=services`}
            strategy="beforeInteractive"
          />
        )}
        <Analytics />
      </body>
    </html>
  );
}
