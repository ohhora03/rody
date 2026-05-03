"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Play, CheckSquare, Zap } from "lucide-react";
import { getDDayLabel, cn } from "@/lib/utils";
import type { Sprint } from "@/types";
import { toast } from "sonner";

export default function SprintsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", goal: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/sprints`);
    const json = await res.json();
    setSprints(json.data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function createSprint(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/sprints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) { toast.success("스프린트가 생성되었습니다"); setShowForm(false); setForm({ name: "", goal: "", startDate: "", endDate: "" }); load(); }
    else { const j = await res.json(); toast.error(j.error); }
  }

  async function startSprint(sprintId: string) {
    const res = await fetch(`/api/projects/${projectId}/sprints/${sprintId}/start`, { method: "POST" });
    if (res.ok) { toast.success("스프린트를 시작합니다!"); load(); }
    else { const j = await res.json(); toast.error(j.error); }
  }

  async function completeSprint(sprintId: string) {
    if (!confirm("스프린트를 완료하시겠습니까? 미완료 이슈는 백로그로 이동합니다.")) return;
    const res = await fetch(`/api/projects/${projectId}/sprints/${sprintId}/complete`, { method: "POST" });
    if (res.ok) { toast.success("스프린트가 완료되었습니다"); load(); }
    else { const j = await res.json(); toast.error(j.error); }
  }

  const statusLabel: Record<string, string> = { PLANNING: "계획", ACTIVE: "진행 중", COMPLETED: "완료" };
  const statusColor: Record<string, string> = { PLANNING: "bg-gray-100 text-gray-600", ACTIVE: "bg-indigo-100 text-indigo-700", COMPLETED: "bg-green-100 text-green-700" };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold text-gray-900">스프린트 관리</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" />스프린트 생성
        </button>
      </div>

      {loading && <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" /></div>}

      {sprints.map((sprint) => (
        <div key={sprint.id} className={cn("bg-white rounded-2xl shadow-sm border p-5", sprint.status === "ACTIVE" ? "border-indigo-200" : "border-gray-100")}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <Zap className={cn("w-5 h-5", sprint.status === "ACTIVE" ? "text-indigo-500" : "text-gray-400")} />
              <div>
                <h3 className="font-semibold text-gray-900">{sprint.name}</h3>
                {sprint.goal && <p className="text-sm text-gray-500 mt-0.5">{sprint.goal}</p>}
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[sprint.status]}`}>{statusLabel[sprint.status]}</span>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
            {sprint.startDate && <span>시작: {new Date(sprint.startDate).toLocaleDateString("ko")}</span>}
            {sprint.endDate && <span>종료: {new Date(sprint.endDate).toLocaleDateString("ko")}</span>}
            {sprint.endDate && sprint.status === "ACTIVE" && <span className="font-semibold text-indigo-600">{getDDayLabel(sprint.endDate)}</span>}
          </div>

          <div className="flex gap-2">
            {sprint.status === "PLANNING" && (
              <button onClick={() => startSprint(sprint.id)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
                <Play className="w-3.5 h-3.5" />스프린트 시작
              </button>
            )}
            {sprint.status === "ACTIVE" && (
              <button onClick={() => completeSprint(sprint.id)} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700">
                <CheckSquare className="w-3.5 h-3.5" />스프린트 완료
              </button>
            )}
          </div>
        </div>
      ))}

      {!loading && sprints.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Zap className="w-12 h-12 mx-auto mb-4 text-gray-200" />
          <p className="font-medium">스프린트가 없습니다</p>
          <p className="text-sm mt-1">첫 번째 스프린트를 만들어보세요</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
          <form onSubmit={createSprint} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-gray-900">새 스프린트 만들기</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">스프린트 이름 *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 5월 1주차 스프린트" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">스프린트 목표</label>
              <input type="text" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="이번 스프린트에서 달성할 목표" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">시작일</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">종료일</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">취소</button>
              <button type="submit" disabled={!form.name.trim() || saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50">{saving ? "생성 중..." : "만들기"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
