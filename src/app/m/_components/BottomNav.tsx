"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Zap, Settings } from "lucide-react";

const TABS = [
  { href: "/m/dashboard", label: "홈", Icon: Home },
  { href: "/m/backlog", label: "백로그", Icon: ClipboardList },
  { href: "/m/sprint", label: "스프린트", Icon: Zap },
  { href: "/m/settings", label: "설정", Icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 430,
        backgroundColor: "#ffffff",
        borderTop: "1px solid #f1f5f9",
        display: "flex",
        alignItems: "stretch",
        height: 64,
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 100,
      }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        const color = isActive ? "#6366f1" : "#9ca3af";
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              color,
              textDecoration: "none",
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
              transition: "color 0.15s",
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
