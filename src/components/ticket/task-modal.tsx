"use client";

import { useState, useEffect, useRef } from "react";
import { X, Trash2, Send, ChevronDown, Calendar, User, GitBranch, ArrowRight } from "lucide-react";
import { PRIORITY_CONFIG, STATUS_CONFIG, formatDateTime, cn } from "@/lib/utils";
import type { IssueWithRelations, IssueStatus, Priority, Member } from "@/types";
import { toast } from "sonner";

type Props = {
  task?: IssueWithRelations | null;
  projectId: string;
  sprintId?: string | null;
  members: Member[];
  onClose: () => void;
  onSave: () => void;
};

const POINT_OPTIONS = [1, 2, 3, 5, 8, 13];

const ALL_STATUSES = Object.entries(STATUS_CONFIG) as [keyof typeof STATUS_CONFIG, (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG]][];

export function TaskModal({ task, projectId, sprintId, members, onClose, onSave }: Props) {
  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [desc, setDesc] = useState(task?.description ?? "");
  const [status, setStatus] = useState<IssueStatus>(task?.status ?? "READY");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "MEDIUM");
  const [points, setPoints] = useState(task?.points ?? 1);
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [reviewerId, setReviewerId] = useState(task?.reviewerId ?? "");
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""
  );
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const activityEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [task?.comments]);

  async function handleSave() {
    if (!title.trim()) { toast.error("제목을 입력해주세요"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        const res = await fetch(`/api/issues/${task!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description: desc, status, priority, points, assigneeId: assigneeId || null, reviewerId: reviewerId || null, dueDate: dueDate || null }),
        });
        if (!res.ok) throw new Error();
        toast.success("과제가 저장되었습니다");
      } else {
        const res = await fetch("/api/issues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description: desc, projectId, sprintId: sprintId || null, priority, points, assigneeId: assigneeId || null, reviewerId: reviewerId || null, dueDate: dueDate || null }),
        });
        if (!res.ok) throw new Error();
        toast.success("과제가 등록되었습니다");
      }
      onSave();
    } catch {
      toast.error("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("과제를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/issues/${task!.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("삭제되었습니다"); onSave(); }
    else toast.error("삭제 실패");
  }

  async function handleStatusChange(newStatus: IssueStatus) {
    if (!isEdit) { setStatus(newStatus); return; }
    const res = await fetch(`/api/issues/${task!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) { setStatus(newStatus); onSave(); toast.success("상태가 변경되었습니다"); }
    else toast.error("변경 실패");
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || !isEdit) return;
    setSubmittingComment(true);
    const res = await fetch(`/api/issues/${task!.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment }),
    });
    if (res.ok) { toast.success("댓글이 등록되었습니다"); setComment(""); onSave(); }
    else toast.error("댓글 등록 실패");
    setSubmittingComment(false);
  }

  const priorityCfg = PRIORITY_CONFIG[priority];
  const statusCfg = STATUS_CONFIG[status];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: priorityCfg.color }} />
          <div className="flex-1 min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="과제 제목을 입력하세요"
              className="w-full text-lg font-semibold text-gray-900 focus:outline-none placeholder:text-gray-300"
            />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isEdit && (
              <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-0 min-h-0">

            {/* 좌측: 상세 내용 */}
            <div className="flex-1 p-6 space-y-5 min-w-0 border-r border-gray-100">

              {/* 상태 버튼 */}
              <div className="flex items-center gap-2 flex-wrap">
                {ALL_STATUSES.map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => handleStatusChange(key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                      status === key
                        ? `${cfg.bg} ${cfg.text} border-current`
                        : "bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"
                    )}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>

              {/* 설명 */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">설명</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={5}
                  placeholder="과제에 대한 상세 설명을 입력하세요..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none text-gray-700"
                />
              </div>

              {/* 활동 내역 */}
              {isEdit && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">활동 내역</label>
                  <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-1">
                    {task!.comments.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">아직 활동이 없습니다</p>
                    )}
                    {task!.comments.map((entry) => {
                      if (entry.type === "STATUS_CHANGE") {
                        const from = STATUS_CONFIG[entry.fromStatus as keyof typeof STATUS_CONFIG];
                        const to = STATUS_CONFIG[entry.toStatus as keyof typeof STATUS_CONFIG];
                        return (
                          <div key={entry.id} className="flex items-center gap-2 py-1">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: entry.author.color || "#6366f1" }}>
                              {entry.author.name.slice(0, 1)}
                            </div>
                            <span className="text-xs text-gray-500">{entry.author.name}</span>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", from?.bg, from?.text)}>
                              {from?.label ?? entry.fromStatus}
                            </span>
                            <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", to?.bg, to?.text)}>
                              {to?.label ?? entry.toStatus}
                            </span>
                            <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">{formatDateTime(entry.createdAt)}</span>
                          </div>
                        );
                      }
                      return (
                        <div key={entry.id} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: entry.author.color || "#6366f1" }}>
                            {entry.author.name.slice(0, 1)}
                          </div>
                          <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-700">{entry.author.name}</span>
                              <span className="text-[10px] text-gray-400">{formatDateTime(entry.createdAt)}</span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.content}</p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={activityEndRef} />
                  </div>

                  <form onSubmit={addComment} className="flex gap-2">
                    <input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="진행 상황을 공유해주세요..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    <button
                      type="submit"
                      disabled={!comment.trim() || submittingComment}
                      className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* 우측: 메타 정보 패널 */}
            <div className="w-56 flex-shrink-0 p-5 space-y-5">

              {/* 우선순위 */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">우선순위</label>
                <div className="space-y-1">
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setPriority(k as Priority)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                        priority === k ? "bg-gray-100" : "hover:bg-gray-50"
                      )}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.color }} />
                      <span className={cn("font-medium", priority === k ? "text-gray-800" : "text-gray-500")}>{v.label}</span>
                      {priority === k && <ChevronDown className="w-3 h-3 ml-auto text-gray-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* 스토리 포인트 */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">스토리 포인트</label>
                <div className="flex flex-wrap gap-1.5">
                  {POINT_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPoints(p)}
                      className={cn(
                        "w-9 h-9 rounded-lg text-sm font-semibold transition-colors",
                        points === p ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* 담당자 */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                  <User className="w-3 h-3" />담당자
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 text-gray-700"
                >
                  <option value="">미배정</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              {/* 검수자 */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />검수자
                </label>
                <select
                  value={reviewerId}
                  onChange={(e) => setReviewerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 text-gray-700"
                >
                  <option value="">미지정</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              {/* 마감일 */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="w-3 h-3" />마감일
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 text-gray-700"
                />
              </div>

              {/* 등록자 / 등록일 */}
              {isEdit && task?.creator && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-wide">등록자</p>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: task.creator.color || "#6366f1" }}>
                      {task.creator.name.slice(0, 1)}
                    </div>
                    <span className="text-xs text-gray-600">{task.creator.name}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">{formatDateTime(task.createdAt)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? "저장 중..." : isEdit ? "저장" : "과제 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
