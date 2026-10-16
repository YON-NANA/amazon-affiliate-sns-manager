import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '暮らし & ペット用品 AmazonアフィリエイトSNS投稿マネージャー',
  description: 'AI生成 ✕ トラッキング自動付与 ✕ ワンクリック承認・予約（半自動）で誤爆を防ぎ高CVを実現するSNS投稿管理Webアプリ',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50/60 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans">
        {children}
      </body>
    </html>
  );
}
