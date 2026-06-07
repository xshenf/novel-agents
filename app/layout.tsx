import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";

Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "小说智能体写作台 · Novel Writing Agent",
  description: "基于长上下文记忆系统与 AI 协作的小说创作工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Suspense fallback={
          <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0b0f19', color: '#94a3b8' }}>
            加载中...
          </div>
        }>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
