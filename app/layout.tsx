import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "로또 명당 - WinSam Toolbox",
  description: "전국 1등 배출 로또 명당 찾기",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        {children}
        <Script
          src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=981d390cacfd3876b062ea5bbed6216a&autoload=false&libraries=services`}
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
