import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  themeColor: "#EDE9DF",
};

export const metadata: Metadata = {
  title: "Life Timer",
  description: "生活倒计时管理",
};

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
