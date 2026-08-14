import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PushNavigationHandler } from "@/components/PushNavigationHandler";

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
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

/** Inline script injected into <head> to prevent flash-of-wrong-theme. */
const THEME_SCRIPT = `(function(){
  try {
    var t = localStorage.getItem('lt-theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var h = document.documentElement;
    if (t === 'dark') {
      h.classList.add('dark');
      h.classList.remove('light');
    } else {
      h.classList.add('light');
      h.classList.remove('dark');
    }
    var c = t === 'dark' ? '#222232' : '#F1EBDF';
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = c;
    var s = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!s) { s = document.createElement('meta'); s.name = 'apple-mobile-web-app-status-bar-style'; document.head.appendChild(s); }
    s.content = t === 'dark' ? 'black-translucent' : 'default';
  } catch(e){}
})();`;

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: set theme class before first paint. Must stay here — metadata API cannot inject inline scripts. */}
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />

        {/*
          iOS standalone mode (full-screen from Home Screen).
          Next.js appleWebApp.capable generates "mobile-web-app-capable" (Android/Chrome standard)
          but NOT "apple-mobile-web-app-capable" — the latter is required by iOS < 16.4.
          iOS 16.4+ can read display:"standalone" from manifest.json directly, so this
          tag is the compat shim for older devices. It is NOT a duplicate of mobile-web-app-capable.
        */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#F1EBDF" />
      </head>
      <body>
        <PushNavigationHandler />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
