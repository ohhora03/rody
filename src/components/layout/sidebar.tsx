"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutDashboard, Zap, List, Settings, LogOut, Play, Menu, X, Smartphone, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  projectId: string;
  familyId: string;
  familyName?: string;
  isMaster?: boolean;
  activeSprint?: { id: string; name: string } | null;
  user: { name?: string | null; email?: string | null; color?: string };
};

export default function Sidebar({ projectId, familyId, familyName, isMaster, activeSprint, user }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState(false);
  const [familyNameInput, setFamilyNameInput] = useState(familyName ?? "");
  const [savingFamilyName, setSavingFamilyName] = useState(false);
  const [displayFamilyName, setDisplayFamilyName] = useState(familyName ?? "");

  async function saveFamilyName() {
    const trimmed = familyNameInput.trim();
    if (!trimmed) { toast.error("가족 이름을 입력해주세요"); return; }
    if (trimmed.length > 30) { toast.error("30자 이내로 입력해주세요"); return; }
    if (trimmed === displayFamilyName) { setEditingFamily(false); return; }
    setSavingFamilyName(true);
    try {
      const res = await fetch(`/api/families/${familyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "이름 변경 실패"); return; }
      setDisplayFamilyName(trimmed);
      setEditingFamily(false);
      toast.success("가족 이름을 변경했어요");
    } finally {
      setSavingFamilyName(false);
    }
  }

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

  const SidebarContent = () => (
    <>
      {/* 로고 */}
      <div className="px-5 py-5 border-b border-indigo-50 flex items-center justify-between">
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
        {/* 모바일에서 닫기 버튼 */}
        <button className="md:hidden p-1 text-gray-400" onClick={() => setOpen(false)}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 가족 이름 */}
      {displayFamilyName !== undefined && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
          {editingFamily ? (
            <div className="flex items-center gap-1.5">
              <input
                value={familyNameInput}
                onChange={(e) => setFamilyNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveFamilyName();
                  if (e.key === "Escape") { setEditingFamily(false); setFamilyNameInput(displayFamilyName); }
                }}
                maxLength={30}
                autoFocus
                disabled={savingFamilyName}
                className="flex-1 min-w-0 px-2 py-1 text-xs rounded-md border border-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
              <button
                onClick={saveFamilyName}
                disabled={savingFamilyName}
                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md flex-shrink-0"
                title="저장"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-gray-500 flex-shrink-0">가족</p>
              <p className="text-xs font-semibold text-gray-800 truncate flex-1">{displayFamilyName || "이름 없음"}</p>
              {isMaster && (
                <button
                  onClick={() => { setEditingFamily(true); setFamilyNameInput(displayFamilyName); }}
                  className="p-0.5 text-gray-400 hover:text-indigo-500 flex-shrink-0"
                  title="가족 이름 변경"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 모바일 앱으로 이동 배너 */}
      <Link
        href="/m/dashboard"
        className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors"
        onClick={() => setOpen(false)}
      >
        <Smartphone className="w-3.5 h-3.5" />
        모바일 앱으로 보기
      </Link>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, Icon, badge }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
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
    </>
  );

  return (
    <>
      {/* 모바일 햄버거 버튼 */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white rounded-xl shadow-md border border-indigo-50 flex items-center justify-center"
        onClick={() => setOpen(true)}
      >
        <Menu className="w-5 h-5 text-indigo-600" />
      </button>

      {/* 모바일 오버레이 */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 사이드바 - 모바일: 슬라이드 드로어, 데스크탑: 고정 */}
      <aside
        className={cn(
          "bg-white border-r border-indigo-50 flex flex-col flex-shrink-0 z-50 transition-transform duration-200",
          // 데스크탑: 항상 보임
          "md:relative md:translate-x-0 md:w-60 md:min-h-screen",
          // 모바일: 고정 드로어
          "fixed top-0 left-0 h-full w-72",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
