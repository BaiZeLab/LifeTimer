import React from "react";
import type { Metadata, Viewport } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import { AntdRegistry } from '@ant-design/nextjs-registry';
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  themeColor: 'black',
}

export const metadata: Metadata = {
  title: "Life Timer",
  description: "all thing in Life Timer",
};

const RootLayout = ({ children }: React.PropsWithChildren) => {

  return (
    <html lang="en">
      <body>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  )
};

export default RootLayout;