"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Copy, Check, FolderPlus, Users, Crown, Shield, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FamilyMemberWithUser } from "@/types";

type Project = { id: string; name: string; key: string };

export default function SettingsPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const router = useRouter();

  const [family, setFamily] = useState<{ name: string; inviteCode: string } | null>(null);
  const [members, setMembers] = useState<FamilyMemberWithUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [copied, setCopied] = useState(false);

  // 새 프로젝트 폼
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      const [famRes, prjRes] = await Promise.all([
        fetch(`/api/families/${familyId}`),
        fetch(`/api/projects?familyId=${familyId}`),
      ]);
      const [famJson, prjJson] = await Promise.all([famRes.json(), prjRes.json()]);
      if (famJson.data) {
        setFamily({ name: famJson.data.name, inviteCode: famJson.data.inviteCode });
        setMembers(famJson.data.members ?? []);
      }
      setProjects(prjJson.data ?? []);
    }
    load();
  }, [familyId]);

  async function copyCode() {
    if (!family?.inviteCode) return;
    await navigator.clipboard.writeText(family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("초대 코드가 복사되었습니다");
  }

  async function createProject() {
    if (!projectName.trim() || !projectKey.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName, key: projectKey, familyId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("프로젝트가 생성되었습니다!");
      setShowProjectForm(false);
      setProjectName("");
      setProjectKey("");
      router.push(`/projects/${json.data.id}/backlog`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "오류가 발생했습니다");
    } finally {
      setCreating(false);
    }
  }

  const ROLE_LABEL: Record<string, string> = { MASTER: "마스터", MEMBER: "멤버" };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">설정</h1>

      {/* 가족 정보 */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-500" />가족 정보
        </h2>
        {family && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">가족 이름</label>
              <p className="text-sm text-gray-800 font-semibold">{family.name}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">초대 코드</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-indigo-50 text-indigo-700 rounded-xl px-4 py-2.5 font-mono text-sm tracking-wider truncate">
                  {family.inviteCode}
                </code>
                <button onClick={copyCode} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 flex-shrink-0 transition-colors">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">이 코드를 공유하면 가족이 합류할 수 있어요</p>
            </div>
          </>
        )}
      </section>

      {/* 구성원 */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />구성원 ({members.length}/6)
        </h2>
        <div className="space-y-2">
          {members.length === 0 && <p className="text-sm text-gray-400 text-center py-4">구성원이 없습니다</p>}
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-gray-50">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: m.user.color || "#6366f1" }}
              >
                {(m.nickname || m.user.name).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{m.nickname || m.user.name}</p>
                <p className="text-xs text-gray-400 truncate">{m.user.email}</p>
              </div>
              <span className={cn(
                "flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0",
                m.role === "MASTER" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
              )}>
                {m.role === "MASTER" && <Crown className="w-3 h-3" />}
                {ROLE_LABEL[m.role] ?? m.role}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 프로젝트 */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-indigo-500" />프로젝트
          </h2>
          <button
            onClick={() => setShowProjectForm(true)}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />새 프로젝트
          </button>
        </div>

        <div className="space-y-2">
          {projects.length === 0 && !showProjectForm && (
            <p className="text-sm text-gray-400 text-center py-4">아직 프로젝트가 없습니다</p>
          )}
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}/backlog`)}
              className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-indigo-50 cursor-pointer transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-indigo-600">{p.key}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700">{p.name}</p>
                <p className="text-xs text-gray-400">{p.key}</p>
              </div>
            </div>
          ))}
        </div>

        {showProjectForm && (
          <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/30 space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">새 프로젝트 만들기</p>
              <button onClick={() => { setShowProjectForm(false); setProjectName(""); setProjectKey(""); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">프로젝트 이름</label>
              <input
                autoFocus
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="예: 우리 가족 목표"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">프로젝트 키 (2–4자 영문)</label>
              <input
                type="text"
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="예: FAM"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowProjectForm(false); setProjectName(""); setProjectKey(""); }}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >취소</button>
              <button
                onClick={createProject}
                disabled={!projectName.trim() || !projectKey.trim() || creating}
                className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >{creating ? "생성 중..." : "만들기"}</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
