import type { Metadata } from "next";
import { Toaster } from "sonner";
import Providers from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "FamilySync",
  description: "가족과 함께하는 스프린트 목표 관리",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
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
