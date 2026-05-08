"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutDashboard, Zap, List, Settings, LogOut, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  familyId: string;
  activeSprint?: { id: string; name: string } | null;
  user: { name?: string | null; email?: string | null; color?: string };
};

export default function Sidebar({ projectId, familyId, activeSprint, user }: Props) {
  const pathname = usePathname();

  const nav = [
    { href: `/projects/${projectId}/dashboard`, label: "대시보드", Icon: LayoutDashboard },
    {
      href: activeSprint ? `/projects/${projectId}/sprint/${activeSprint.id}` : `/projects/${projectId}/sprints`,
      label: "활성 스프린트",
      Icon: Zap,
      badge: !!activeSprint,
    },
    { href: `/projects/${projectId}/sprints`, label: "스프린트 관리", Icon: Play },
    { href: `/projects/${projectId}/backlog`, label: "백로그", Icon: List },
    { href: `/family/${familyId}/setup`, label: "설정", Icon: Settings },
  ];

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-indigo-50 flex flex-col flex-shrink-0">
      {/* 로고 */}
      <div className="px-5 py-5 border-b border-indigo-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
            <Image src="/icon-192.png" alt="ARC" width={32} height={32} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="font-bold text-sm text-indigo-900">ARC</p>
            {activeSprint && (
              <p className="text-[11px] text-indigo-400 truncate max-w-[130px]">{activeSprint.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, Icon, badge }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              )}
            >
              <Icon className={cn("w-4 h-4", active ? "text-indigo-600" : "text-gray-400")} />
              {label}
              {badge && <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400" />}
            </Link>
          );
        })}
      </nav>

      {/* 사용자 */}
      <div className="px-3 py-4 border-t border-indigo-50">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 group">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: user.color || "#6366f1" }}
          >
            {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{user.name || "사용자"}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            title="로그아웃"
          >
            <LogOut className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div>
    </aside>
  );
}
