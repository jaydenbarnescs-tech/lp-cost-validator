import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LP Cost Validator",
  description: "LP制作ビジネスのコスト・利益検証ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
