import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import Providers from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "FamilySync",
  description: "가족과 함께하는 스프린트 목표 관리",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ARC",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#6366f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ARC" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{ style: { background: "white", border: "1px solid #e0e7ff", color: "#1e1b4b" } }}
          />
        </Providers>
      </body>
    </html>
  );
}
