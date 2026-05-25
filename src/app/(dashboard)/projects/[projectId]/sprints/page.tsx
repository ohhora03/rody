"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Play, CheckSquare, Zap, ChevronDown, ChevronUp, ExternalLink, Trash2 } from "lucide-react";
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

interface FailedIssueInfo {
  id: string;
  title: string;
  status: IssueStatus;
  points: number;
  assigneeId: string | null;
}

type FailedAction = "next-sprint" | "backlog" | null;

export default function SprintsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sprints, setSprints] = useState<SprintWithIssues[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", goal: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [failedModal, setFailedModal] = useState<{
    sprintId: string;
    failedIssues: FailedIssueInfo[];
    action: FailedAction;
    targetSprintId: string;
  } | null>(null);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [deleteModalSprintId, setDeleteModalSprintId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    if (!confirm("스프린트를 완료하시겠습니까?")) return;
    setProcessingComplete(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints/${sprintId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error); return; }
      const failedIssues: FailedIssueInfo[] = json.failedIssues ?? [];
      if (failedIssues.length > 0) {
        setFailedModal({ sprintId, failedIssues, action: null, targetSprintId: "" });
      } else {
        toast.success("스프린트가 완료되었습니다");
        load();
      }
    } finally {
      setProcessingComplete(false);
    }
  }

  async function applyFailedAction() {
    if (!failedModal) return;
    const { sprintId, action, targetSprintId } = failedModal;
    if (action === null) {
      // 그대로 두기 -> 모달만 닫고 새로고침 (이미 1차 호출에서 COMPLETED 처리됨)
      toast.success("스프린트가 완료되었습니다");
      setFailedModal(null);
      load();
      return;
    }
    if (action === "next-sprint" && !targetSprintId) {
      toast.error("이관할 스프린트를 선택해주세요");
      return;
    }
    setProcessingComplete(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints/${sprintId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ failedAction: action, targetSprintId: targetSprintId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error); return; }
      toast.success(action === "next-sprint" ? "다음 스프린트로 이관했어요" : "백로그로 이동했어요");
      setFailedModal(null);
      load();
    } finally {
      setProcessingComplete(false);
    }
  }

  async function deleteSprint(sprintId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints/${sprintId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("스프린트를 삭제했어요");
        setDeleteModalSprintId(null);
        load();
      } else {
        const j = await res.json();
        toast.error(j.error || "삭제에 실패했습니다");
      }
    } finally {
      setDeleting(false);
    }
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
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); startSprint(sprint.id); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
                      >
                        <Play className="w-3.5 h-3.5" />스프린트 시작
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteModalSprintId(sprint.id); }}
                        className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                        title="스프린트 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />삭제
                      </button>
                    </>
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

      {/* 미완료 이슈 처리 모달 */}
      {failedModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">미완료 과제 처리</h3>
              <p className="text-xs text-gray-500 mt-1">
                완료되지 않은 과제가 <span className="font-semibold text-red-600">{failedModal.failedIssues.length}건</span> 있습니다. 처리 방식을 선택해주세요.
              </p>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 bg-gray-50 rounded-xl p-3">
              {failedModal.failedIssues.map((iss) => {
                const st = STATUS_CONFIG[iss.status];
                return (
                  <div key={iss.id} className="flex items-center gap-2 text-xs">
                    <span className={cn("px-1.5 py-0.5 rounded font-semibold", st?.bg, st?.text)}>
                      {st?.label ?? iss.status}
                    </span>
                    <span className="flex-1 truncate text-gray-700">{iss.title}</span>
                    <span className="text-indigo-600 font-medium">{iss.points}pt</span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="failedAction"
                  checked={failedModal.action === "next-sprint"}
                  onChange={() => setFailedModal({ ...failedModal, action: "next-sprint" })}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">다음 스프린트로 이관</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">PLANNING 상태의 스프린트로 이동합니다 (상태는 READY로 초기화)</p>
                  {failedModal.action === "next-sprint" && (
                    <select
                      value={failedModal.targetSprintId}
                      onChange={(e) => setFailedModal({ ...failedModal, targetSprintId: e.target.value })}
                      className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-xs"
                    >
                      <option value="">스프린트 선택</option>
                      {sprints.filter((s) => s.status === "PLANNING").map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </label>

              <label className="flex items-start gap-2 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="failedAction"
                  checked={failedModal.action === "backlog"}
                  onChange={() => setFailedModal({ ...failedModal, action: "backlog", targetSprintId: "" })}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">백로그로 이동</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">스프린트에서 빼서 백로그로 옮깁니다</p>
                </div>
              </label>

              <label className="flex items-start gap-2 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="failedAction"
                  checked={failedModal.action === null}
                  onChange={() => setFailedModal({ ...failedModal, action: null, targetSprintId: "" })}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">그대로 두기</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">미완료 과제를 현재 스프린트에 남겨둡니다 (실패로 마감)</p>
                </div>
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFailedModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
                disabled={processingComplete}
              >
                나중에
              </button>
              <button
                type="button"
                onClick={applyFailedAction}
                disabled={processingComplete}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {processingComplete ? "처리 중..." : "적용"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스프린트 삭제 확인 모달 */}
      {deleteModalSprintId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">스프린트 삭제</h3>
              <p className="text-sm text-gray-600 mt-2">
                정말 이 스프린트를 삭제하시겠습니까?<br />
                <span className="text-xs text-gray-500">스프린트에 속한 과제는 백로그로 이동합니다.</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModalSprintId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
                disabled={deleting}
              >
                취소
              </button>
              <button
                onClick={() => deleteSprint(deleteModalSprintId)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
