"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Play, CheckSquare, Zap, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import Link from "next/link";
import { getDDayLabel, cn, STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import type { Sprint, IssueStatus, Priority } from "@/types";
import { toast } from "sonner";

interface IssueItem {
  id: string;
  title: string;
  status: IssueStatus;
  priority: Priority;
  points: number;
  assignee: { id: string; name: string; color: string } | null;
}

interface SprintWithIssues extends Sprint {
  issues?: IssueItem[];
}

export default function SprintsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sprints, setSprints] = useState<SprintWithIssues[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", goal: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/sprints`);
    const json = await res.json();
    setSprints(json.data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function toggleExpand(sprint: SprintWithIssues) {
    if (expandedId === sprint.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sprint.id);
    // 이슈가 아직 로드되지 않은 경우에만 fetch
    if (!sprint.issues) {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/sprints/${sprint.id}`);
        const json = await res.json();
        setSprints((prev) =>
          prev.map((s) => s.id === sprint.id ? { ...s, issues: json.data?.issues ?? [] } : s)
        );
      } finally {
        setLoadingDetail(false);
      }
    }
  }

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
    if (res.ok) {
      toast.success("스프린트가 생성되었습니다");
      setShowForm(false);
      setForm({ name: "", goal: "", startDate: "", endDate: "" });
      load();
    } else {
      const j = await res.json();
      toast.error(j.error);
    }
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
  const statusBadge: Record<string, string> = {
    PLANNING: "bg-gray-100 text-gray-600",
    ACTIVE: "bg-indigo-100 text-indigo-700",
    COMPLETED: "bg-green-100 text-green-700",
  };

  // 완료된 이슈 통계 계산
  function calcStats(issues: IssueItem[]) {
    const total = issues.length;
    const done = issues.filter((i) => i.status === "CLOSED" || i.status === "RESOLVED").length;
    const totalPts = issues.reduce((s, i) => s + (i.points ?? 0), 0);
    const donePts = issues
      .filter((i) => i.status === "CLOSED" || i.status === "RESOLVED")
      .reduce((s, i) => s + (i.points ?? 0), 0);
    return { total, done, totalPts, donePts, rate: total > 0 ? Math.round((done / total) * 100) : 0 };
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold text-gray-900">스프린트 관리</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />스프린트 생성
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {sprints.map((sprint) => {
        const isExpanded = expandedId === sprint.id;
        const stats = sprint.issues ? calcStats(sprint.issues) : null;

        return (
          <div
            key={sprint.id}
            className={cn(
              "bg-white rounded-2xl shadow-sm border overflow-hidden",
              sprint.status === "ACTIVE" ? "border-indigo-200" : "border-gray-100"
            )}
          >
            {/* 헤더 - 클릭 시 확장 */}
            <button
              onClick={() => toggleExpand(sprint)}
              className="w-full text-left p-5 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Zap className={cn("w-5 h-5 flex-shrink-0", sprint.status === "ACTIVE" ? "text-indigo-500" : "text-gray-400")} />
                  <div>
                    <h3 className="font-semibold text-gray-900">{sprint.name}</h3>
                    {sprint.goal && <p className="text-sm text-gray-500 mt-0.5">{sprint.goal}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge[sprint.status]}`}>
                    {statusLabel[sprint.status]}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-400">
                {sprint.startDate && <span>시작: {new Date(sprint.startDate).toLocaleDateString("ko")}</span>}
                {sprint.endDate && <span>종료: {new Date(sprint.endDate).toLocaleDateString("ko")}</span>}
                {sprint.endDate && sprint.status === "ACTIVE" && (
                  <span className="font-semibold text-indigo-600">{getDDayLabel(sprint.endDate)}</span>
                )}
                {/* 완료 스프린트: 미리 요약 표시 */}
                {sprint.status === "COMPLETED" && stats && (
                  <span className="ml-auto text-gray-500 font-medium">
                    {stats.done}/{stats.total}개 완료 · {stats.donePts}/{stats.totalPts}pt
                  </span>
                )}
              </div>
            </button>

            {/* 확장 영역 */}
            {isExpanded && (
              <div className="border-t border-gray-100">
                {/* 액션 버튼 */}
                <div className="flex gap-2 px-5 py-3 bg-gray-50/50">
                  {sprint.status === "PLANNING" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); startSprint(sprint.id); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
                    >
                      <Play className="w-3.5 h-3.5" />스프린트 시작
                    </button>
                  )}
                  {sprint.status === "ACTIVE" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); completeSprint(sprint.id); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />스프린트 완료
                    </button>
                  )}
                  <Link
                    href={`/projects/${projectId}/sprint/${sprint.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />칸반 보기
                  </Link>
                </div>

                {/* 이슈 목록 */}
                {loadingDetail && !sprint.issues ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  </div>
                ) : sprint.issues && sprint.issues.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">이슈가 없습니다</div>
                ) : sprint.issues ? (
                  <>
                    {/* 완료 스프린트: 통계 카드 */}
                    {sprint.status === "COMPLETED" && stats && (
                      <div className="grid grid-cols-4 gap-3 px-5 py-4 border-b border-gray-100">
                        {[
                          { label: "전체 과제", value: stats.total, color: "text-gray-700", bg: "bg-gray-50" },
                          { label: "완료", value: stats.done, color: "text-green-700", bg: "bg-green-50" },
                          { label: "달성률", value: `${stats.rate}%`, color: "text-indigo-700", bg: "bg-indigo-50" },
                          { label: "획득 포인트", value: `${stats.donePts}pt`, color: "text-purple-700", bg: "bg-purple-50" },
                        ].map(({ label, value, color, bg }) => (
                          <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                            <div className={`text-lg font-bold ${color}`}>{value}</div>
                            <div className={`text-xs ${color} opacity-70 mt-0.5`}>{label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 이슈 목록 */}
                    <div className="px-5 py-3 space-y-1.5 max-h-80 overflow-y-auto">
                      {sprint.issues.map((issue) => {
                        const stCfg = STATUS_CONFIG[issue.status];
                        const prCfg = PRIORITY_CONFIG[issue.priority];
                        return (
                          <div
                            key={issue.id}
                            className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors"
                          >
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: prCfg?.color }} />
                            <span className="flex-1 text-sm text-gray-800 truncate">{issue.title}</span>
                            <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap", stCfg?.bg, stCfg?.text)}>
                              {stCfg?.label}
                            </span>
                            <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                              {issue.points}pt
                            </span>
                            {issue.assignee && (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                style={{ background: issue.assignee.color || "#6366f1" }}
                                title={issue.assignee.name}
                              >
                                {issue.assignee.name.slice(0, 1)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>
        );
      })}

      {!loading && sprints.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Zap className="w-12 h-12 mx-auto mb-4 text-gray-200" />
          <p className="font-medium">스프린트가 없습니다</p>
          <p className="text-sm mt-1">첫 번째 스프린트를 만들어보세요</p>
        </div>
      )}

      {/* 스프린트 생성 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
          <form onSubmit={createSprint} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-gray-900">새 스프린트 만들기</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">스프린트 이름 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 5월 1주차 스프린트"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">스프린트 목표</label>
              <input
                type="text"
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                placeholder="이번 스프린트에서 달성할 목표"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">시작일</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">종료일</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!form.name.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? "생성 중..." : "만들기"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
