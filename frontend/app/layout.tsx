import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "代理商合规管理系统",
  description: "誉衡药业代理商合规管理系统",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="light" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
