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
  description: "내 주변 로또 명당 찾기",
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
