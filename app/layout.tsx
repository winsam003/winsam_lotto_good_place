import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "내 주변 로또 명당 지도",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ["로또 명당", "내주변 로또", "로또 1등 판매점", "로또 명당 지도", "전국 로또 명당", "로또 당첨 번호 확인"],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "내 주변 로또 명당 지도",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "내 주변 로또 명당 지도",
    description: SITE_DESCRIPTION,
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
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    inLanguage: "ko-KR",
  };

  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
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
