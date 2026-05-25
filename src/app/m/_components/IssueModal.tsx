"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Trash2, Send, ArrowRight, ChevronDown } from "lucide-react";
import { mApi } from "../_lib/api";

type IssueStatus = "READY" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REJECTED" | "HOLD" | "FAILED";
type Priority = "HIGH" | "MEDIUM" | "LOW";

interface User { id: string; name: string; color: string; email?: string }
interface ActivityEntry {
  id: string; type: string; content: string | null;
  fromStatus: string | null; toStatus: string | null;
  createdAt: string; author: User;
}
interface IssueDetail {
  id: string; title: string; description: string | null;
  status: IssueStatus; priority: Priority; points: number | null;
  assigneeId: string | null; reviewerId: string | null;
  dueDate: string | null; createdAt: string;
  assignee: User | null; reviewer: User | null; creator: User | null;
  comments: ActivityEntry[];
}

interface Member { id: string; name: string; color: string }

interface InitialIssue {
  title: string;
  status: IssueStatus;
  priority: Priority;
  points?: number | null;
  assigneeId?: string | null;
  reviewerId?: string | null;
  dueDate?: string | null;
  assignee?: User | null;
  reviewer?: User | null;
  description?: string | null;
}

interface Props {
  issueId?: string | null;       // null/undefined = 생성 모드
  projectId: string;
  sprintId?: string | null;
  members?: Member[];
  initialIssue?: InitialIssue;   // 목록에서 이미 아는 데이터 (즉시 표시용)
  onClose: () => void;
  onSave: () => void;
}

const STATUS_CONFIG: Record<IssueStatus, { label: string; color: string; bg: string }> = {
  READY:       { label: "준비",    color: "#3b82f6", bg: "#eff6ff" },
  IN_PROGRESS: { label: "진행 중", color: "#8b5cf6", bg: "#f5f3ff" },
  RESOLVED:    { label: "해결됨",  color: "#f59e0b", bg: "#fffbeb" },
  CLOSED:      { label: "종료",    color: "#10b981", bg: "#f0fdf4" },
  REJECTED:    { label: "반려",    color: "#ef4444", bg: "#fef2f2" },
  HOLD:        { label: "보류",    color: "#9ca3af", bg: "#f9fafb" },
  FAILED:      { label: "실패",    color: "#dc2626", bg: "#fef2f2" },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  HIGH:   { label: "높음", color: "#f97316" },
  MEDIUM: { label: "보통", color: "#eab308" },
  LOW:    { label: "낮음", color: "#6b7280" },
};


function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Avatar({ name, color, size = 24 }: { name: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      backgroundColor: color, display: "flex", alignItems: "center",
      justifyContent: "center", color: "#fff",
      fontSize: size * 0.4, fontWeight: 700, flexShrink: 0,
    }}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function IssueModal({ issueId, projectId, sprintId, members = [], initialIssue, onClose, onSave }: Props) {
  const isEdit = !!issueId;
  const queryClient = useQueryClient();
  const activityEndRef = useRef<HTMLDivElement>(null);

  // 편집 모드: 이슈 상세 fetch (댓글/description 전용)
  const { data: detail, isLoading } = useQuery<IssueDetail>({
    queryKey: ["m-issue-detail", issueId],
    queryFn: () => mApi.issueDetail(issueId!),
    enabled: isEdit,
    staleTime: 0,
  });

  // initialIssue 또는 detail에서 초기값 결정 (initialIssue 있으면 즉시 표시 가능)
  const seed = detail ?? initialIssue;

  // 로컬 상태 - initialIssue 있으면 즉시 초기화
  const [title, setTitle] = useState(initialIssue?.title ?? "");
  const [desc, setDesc] = useState(initialIssue?.description ?? "");
  const [status, setStatus] = useState<IssueStatus>(initialIssue?.status ?? "READY");
  const [priority, setPriority] = useState<Priority>(initialIssue?.priority ?? "MEDIUM");
  const [pointsStr, setPointsStr] = useState<string>(String(initialIssue?.points ?? 1));
  const [assigneeId, setAssigneeId] = useState(initialIssue?.assigneeId ?? "");
  const [reviewerId, setReviewerId] = useState(initialIssue?.reviewerId ?? "");
  const [dueDate, setDueDate] = useState(
    initialIssue?.dueDate ? new Date(initialIssue.dueDate).toISOString().split("T")[0] : ""
  );
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // detail 로딩 완료 시 나머지 필드 보완 (description, dueDate 등 목록에 없는 값)
  useEffect(() => {
    if (detail) {
      setTitle(detail.title);
      setDesc(detail.description ?? "");
      setStatus(detail.status);
      setPriority(detail.priority);
      setPointsStr(String(detail.points ?? 1));
      setAssigneeId(detail.assigneeId ?? "");
      setReviewerId(detail.reviewerId ?? "");
      setDueDate(detail.dueDate ? new Date(detail.dueDate).toISOString().split("T")[0] : "");
    }
  }, [detail]);

  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.comments?.length]);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await mApi.patchIssue(issueId!, {
          title, description: desc, status, priority, points: Math.round(parseFloat(pointsStr) || 1),
          assigneeId: assigneeId || null, reviewerId: reviewerId || null,
          dueDate: dueDate || null,
        });
      } else {
        await mApi.createIssue({
          title, description: desc, projectId,
          sprintId: sprintId || null, priority, points: Math.round(parseFloat(pointsStr) || 1),
          assigneeId: assigneeId || null, reviewerId: reviewerId || null,
          dueDate: dueDate || null,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["m-home"] });
      queryClient.invalidateQueries({ queryKey: ["m-issues"] });
      queryClient.invalidateQueries({ queryKey: ["m-backlog"] });
      queryClient.invalidateQueries({ queryKey: ["m-sprint-detail"] });
      onSave();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: IssueStatus) {
    setStatus(newStatus);
    if (!isEdit) return;
    await mApi.patchIssue(issueId!, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ["m-issue-detail", issueId] });
    queryClient.invalidateQueries({ queryKey: ["m-home"] });
    queryClient.invalidateQueries({ queryKey: ["m-sprint-detail"] });
    onSave();
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await mApi.deleteIssue(issueId!);
      queryClient.invalidateQueries({ queryKey: ["m-home"] });
      queryClient.invalidateQueries({ queryKey: ["m-issues"] });
      queryClient.invalidateQueries({ queryKey: ["m-backlog"] });
      queryClient.invalidateQueries({ queryKey: ["m-sprint-detail"] });
      onSave();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || !isEdit) return;
    setSubmittingComment(true);
    try {
      await mApi.addComment(issueId!, comment);
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["m-issue-detail", issueId] });
    } finally {
      setSubmittingComment(false);
    }
  }

  const statusCfg = STATUS_CONFIG[status];

  return (
    <>
      {/* 딤 배경 */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 300,
        }}
      />

      {/* 바텀 시트 */}
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 301,
        backgroundColor: "#fff",
        borderRadius: "20px 20px 0 0",
        maxHeight: "92dvh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
      }}>
        {/* 드래그 핸들 */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#e5e7eb" }} />
        </div>

        {/* 헤더 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 16px 12px", borderBottom: "1px solid #f3f4f6",
          flexShrink: 0,
        }}>
          <div style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: PRIORITY_CONFIG[priority].color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="과제 제목을 입력하세요"
              style={{
                width: "100%", border: "none", outline: "none",
                fontSize: 16, fontWeight: 700, color: "#111827",
                background: "transparent",
              }}
            />
          </div>
          {isEdit && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "#9ca3af" }}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "#9ca3af" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 스크롤 본문 - initialIssue 있으면 즉시 표시, 없으면 로딩 대기 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
          {isLoading && !seed ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <div style={{
                width: 28, height: 28, border: "3px solid #e0e7ff",
                borderTopColor: "#6366f1", borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <>
              {/* 상태 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>상태</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(Object.keys(STATUS_CONFIG) as IssueStatus[]).map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const active = status === s;
                    return (
                      <button key={s} onClick={() => handleStatusChange(s)} style={{
                        padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${active ? cfg.color : "#e5e7eb"}`,
                        backgroundColor: active ? cfg.bg : "#fff",
                        color: active ? cfg.color : "#6b7280",
                        fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                      }}>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 설명 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>설명</div>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={3}
                  placeholder="과제 상세 설명을 입력하세요..."
                  style={{
                    width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb",
                    borderRadius: 10, fontSize: 14, outline: "none", resize: "none",
                    fontFamily: "inherit", color: "#374151", boxSizing: "border-box",
                    lineHeight: 1.5,
                  }}
                />
              </div>

              {/* 우선순위 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>우선순위</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => {
                    const cfg = PRIORITY_CONFIG[p];
                    const active = priority === p;
                    return (
                      <button key={p} onClick={() => setPriority(p)} style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "9px 0", borderRadius: 10,
                        border: `1.5px solid ${active ? cfg.color : "#e5e7eb"}`,
                        backgroundColor: active ? cfg.color + "15" : "#fff",
                        cursor: "pointer", transition: "all 0.15s",
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: cfg.color }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: active ? cfg.color : "#6b7280" }}>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 스토리 포인트 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>스토리 포인트</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={pointsStr}
                    onChange={(e) => setPointsStr(e.target.value)}
                    onBlur={() => {
                      const v = Math.round(parseFloat(pointsStr));
                      if (isNaN(v) || v <= 0) setPointsStr("1");
                      else setPointsStr(String(v));
                    }}
                    style={{
                      width: 90, padding: "10px 12px", border: "1.5px solid #e5e7eb",
                      borderRadius: 10, fontSize: 16, fontWeight: 700, textAlign: "center",
                      outline: "none", boxSizing: "border-box", color: "#111827",
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af" }}>pt</span>
                </div>
              </div>

              {/* 담당자 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>담당자</div>
                <div style={{ position: "relative" }}>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 36px 10px 12px",
                      border: "1.5px solid #e5e7eb", borderRadius: 10,
                      fontSize: 14, color: assigneeId ? "#111827" : "#9ca3af",
                      backgroundColor: "#fff", appearance: "none", outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">미배정</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <ChevronDown size={16} color="#9ca3af" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
              </div>

              {/* 검수자 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>검수자</div>
                <div style={{ position: "relative" }}>
                  <select
                    value={reviewerId}
                    onChange={(e) => setReviewerId(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 36px 10px 12px",
                      border: "1.5px solid #e5e7eb", borderRadius: 10,
                      fontSize: 14, color: reviewerId ? "#111827" : "#9ca3af",
                      backgroundColor: "#fff", appearance: "none", outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">미지정</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <ChevronDown size={16} color="#9ca3af" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
              </div>

              {/* 마감일 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>마감일</div>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px",
                    border: "1.5px solid #e5e7eb", borderRadius: 10,
                    fontSize: 14, color: dueDate ? "#111827" : "#9ca3af",
                    backgroundColor: "#fff", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* 등록자 정보 (편집 모드) */}
              {isEdit && detail?.creator && (
                <div style={{
                  padding: "12px 0", borderTop: "1px solid #f3f4f6", marginBottom: 16,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <Avatar name={detail.creator.name} color={detail.creator.color || "#6366f1"} size={22} />
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {detail.creator.name} · {formatDateTime(detail.createdAt)}
                  </span>
                </div>
              )}

              {/* 활동 내역 (편집 모드) */}
              {isEdit && (
                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>활동 내역</div>

                  {isLoading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
                      <div style={{
                        width: 20, height: 20, border: "2px solid #e0e7ff",
                        borderTopColor: "#6366f1", borderRadius: "50%",
                        animation: "spin 0.7s linear infinite",
                      }} />
                    </div>
                  ) : (!detail?.comments || detail.comments.length === 0) ? (
                    <div style={{ textAlign: "center", padding: "16px 0", color: "#9ca3af", fontSize: 13 }}>
                      아직 활동이 없습니다
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                      {detail.comments.map((entry) => {
                        if (entry.type === "STATUS_CHANGE") {
                          const from = STATUS_CONFIG[entry.fromStatus as IssueStatus];
                          const to = STATUS_CONFIG[entry.toStatus as IssueStatus];
                          return (
                            <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0" }}>
                              <Avatar name={entry.author.name} color={entry.author.color || "#6366f1"} size={22} />
                              <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>{entry.author.name}</span>
                              <span style={{
                                fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: 600,
                                backgroundColor: from?.bg, color: from?.color,
                              }}>{from?.label ?? entry.fromStatus}</span>
                              <ArrowRight size={10} color="#9ca3af" />
                              <span style={{
                                fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: 600,
                                backgroundColor: to?.bg, color: to?.color,
                              }}>{to?.label ?? entry.toStatus}</span>
                              <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af", flexShrink: 0 }}>{formatDateTime(entry.createdAt)}</span>
                            </div>
                          );
                        }
                        return (
                          <div key={entry.id} style={{ display: "flex", gap: 8 }}>
                            <Avatar name={entry.author.name} color={entry.author.color || "#6366f1"} size={28} />
                            <div style={{ flex: 1, backgroundColor: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{entry.author.name}</span>
                                <span style={{ fontSize: 10, color: "#9ca3af" }}>{formatDateTime(entry.createdAt)}</span>
                              </div>
                              <p style={{ fontSize: 13, color: "#374151", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{entry.content}</p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={activityEndRef} />
                    </div>
                  )}

                  {/* 댓글 입력 */}
                  <form onSubmit={handleAddComment} style={{ display: "flex", gap: 8 }}>
                    <input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="진행 상황을 공유해주세요..."
                      style={{
                        flex: 1, padding: "10px 12px", border: "1.5px solid #e5e7eb",
                        borderRadius: 10, fontSize: 13, outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!comment.trim() || submittingComment}
                      style={{
                        padding: "10px 14px", backgroundColor: "#6366f1",
                        color: "#fff", border: "none", borderRadius: 10,
                        cursor: "pointer", opacity: (!comment.trim() || submittingComment) ? 0.4 : 1,
                        display: "flex", alignItems: "center",
                      }}
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

        {/* 하단 저장 버튼 */}
        <div style={{
          padding: "12px 16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          borderTop: "1px solid #f3f4f6",
          display: "flex", gap: 8, flexShrink: 0,
          backgroundColor: "#fff",
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "13px 0", borderRadius: 12,
            border: "1.5px solid #e5e7eb", backgroundColor: "#fff",
            color: "#6b7280", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            style={{
              flex: 2, padding: "13px 0", borderRadius: 12,
              backgroundColor: title.trim() ? "#6366f1" : "#e0e7ff",
              color: title.trim() ? "#fff" : "#9ca3af",
              border: "none", fontSize: 14, fontWeight: 700, cursor: title.trim() ? "pointer" : "not-allowed",
              transition: "all 0.15s",
            }}
          >
            {saving ? "저장 중..." : isEdit ? "저장" : "과제 등록"}
          </button>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {showDeleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{
            backgroundColor: "#fff", borderRadius: 16, padding: 24,
            width: "100%", maxWidth: 320, textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>과제를 삭제할까요?</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>삭제한 과제는 복구할 수 없습니다.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  border: "1.5px solid #e5e7eb", backgroundColor: "#fff",
                  color: "#6b7280", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  backgroundColor: "#ef4444", border: "none",
                  color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
