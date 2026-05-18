import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F1EBDF" },
    { media: "(prefers-color-scheme: dark)",  color: "#222232" },
  ],
};

export const metadata: Metadata = {
  title: "Life Timer",
  description: "生活倒计时管理 — 追踪到期与消耗",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Life Timer",
  },
};

/** Inline script injected into <head> to prevent flash-of-wrong-theme. */
const THEME_SCRIPT = `(function(){
  try {
    var t = localStorage.getItem('lt-theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch(e){}
})();`;

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: set theme class before first paint */}
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />

        {/* PWA — Apple */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Life Timer" />

        {/* PWA — General */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
