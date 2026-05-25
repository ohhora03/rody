"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, PenLine, X, MoveRight, Trash2 } from "lucide-react";
import { mApi } from "../_lib/api";
import StatusBadge from "../_components/StatusBadge";
import PriorityDot from "../_components/PriorityDot";
import Avatar from "../_components/Avatar";
import IssueModal from "../_components/IssueModal";
import CreateIssueFAB from "../_components/CreateIssueFAB";

type SprintStatus = "PLANNING" | "ACTIVE" | "COMPLETED";
type IssueStatus = "READY" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REJECTED" | "HOLD" | "FAILED";
type Priority = "HIGH" | "MEDIUM" | "LOW";

interface User { id: string; name: string; color: string }
interface Issue {
  id: string; title: string; status: IssueStatus; priority: Priority; assignee: User | null;
}
interface Sprint {
  id: string; name: string; goal: string | null;
  status: SprintStatus; startDate: string | null; endDate: string | null; issues?: Issue[];
}
interface Project { id: string; name: string }
interface FamilyMember { id: string; role: "MASTER" | "MEMBER"; user: User }
interface Family { id: string; name: string; members: FamilyMember[] }

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
      <div style={{
        width: 32, height: 32, border: "3px solid #e0e7ff",
        borderTopColor: "#6366f1", borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const SPRINT_STATUS_CONFIG: Record<SprintStatus, { label: string; bg: string; color: string }> = {
  PLANNING:  { label: "계획 중", bg: "#eff6ff", color: "#3b82f6" },
  ACTIVE:    { label: "진행 중", bg: "#dcfce7", color: "#16a34a" },
  COMPLETED: { label: "완료됨", bg: "#f1f5f9", color: "#64748b" },
};

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function SprintPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [expandedSprintId, setExpandedSprintId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSprintName, setNewSprintName] = useState("");
  const [newSprintGoal, setNewSprintGoal] = useState("");
  const [newSprintStartDate, setNewSprintStartDate] = useState("");
  const [newSprintEndDate, setNewSprintEndDate] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  // 스프린트 이동
  const [movingIssue, setMovingIssue] = useState<{ id: string; title: string; currentSprintId: string } | null>(null);
  // 이관/복사 모드 선택 (대상 스프린트 선택 후 표시)
  const [transferTarget, setTransferTarget] = useState<{ sprintId: string; sprintName: string } | null>(null);
  // 스프린트 완료 시 FAILED 처리 모달
  const [completingSprint, setCompletingSprint] = useState<{
    id: string;
    name: string;
    failedIssues: Array<{ id: string; title: string; status: string; points: number | null }>;
  } | null>(null);
  // 스프린트 삭제 확인
  const [deletingSprintId, setDeletingSprintId] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const { data: homeData, isLoading: loadingHome } = useQuery<{
    families: Family[];
    project: (Project & { sprints: Sprint[] }) | null;
    activeSprint: Sprint | null;
  }>({
    queryKey: ["m-home"],
    queryFn: mApi.home,
    enabled: !!session?.user,
    staleTime: 10 * 60 * 1000,
  });

  const family = homeData?.families?.[0] ?? null;
  const project = homeData?.project ?? null;
  const projectId = project?.id ?? null;
  const sprints = project?.sprints ?? [];

  const currentMember = family?.members.find((m) => m.user.id === session?.user?.id);
  const isMaster = currentMember?.role === "MASTER";

  const members = (family?.members ?? []).map((m) => ({
    id: m.user.id, name: m.user.name, color: m.user.color,
  }));

  const { data: sprintDetail, isLoading: loadingDetail, refetch: refetchDetail } = useQuery<Sprint>({
    queryKey: ["m-sprint-detail", projectId, expandedSprintId],
    queryFn: () => mApi.sprintDetail(projectId!, expandedSprintId!),
    enabled: !!projectId && !!expandedSprintId,
    staleTime: 30_000,
  });

  const startMutation = useMutation({
    mutationFn: (sprintId: string) => mApi.startSprint(projectId!, sprintId),
    onSuccess: (data) => {
      if (data?.error) {
        setStartError(data.error);
        return;
      }
      setStartError(null);
      queryClient.invalidateQueries({ queryKey: ["m-home"] });
    },
  });

  // 1단계: 완료 호출 → failedIssues 받아서 모달 표시
  const completeProbeMutation = useMutation({
    mutationFn: (sprintId: string) => mApi.completeSprint(projectId!, sprintId),
    onSuccess: (data, sprintId) => {
      const failedIssues = data?.failedIssues ?? [];
      const sprint = sortedSprints.find((s) => s.id === sprintId);
      if (failedIssues.length > 0 && sprint) {
        setCompletingSprint({ id: sprintId, name: sprint.name, failedIssues });
      } else {
        queryClient.invalidateQueries({ queryKey: ["m-home"] });
      }
    },
  });

  // 2단계: failedAction 지정해서 재호출
  const completeFinalMutation = useMutation({
    mutationFn: ({
      sprintId,
      failedAction,
      targetSprintId,
    }: {
      sprintId: string;
      failedAction: "next-sprint" | "backlog" | null;
      targetSprintId?: string;
    }) =>
      mApi.completeSprint(projectId!, sprintId, {
        failedAction,
        targetSprintId,
      }),
    onSuccess: (data) => {
      if (data?.error) {
        setCompleteError(data.error);
        return;
      }
      setCompleteError(null);
      setCompletingSprint(null);
      queryClient.invalidateQueries({ queryKey: ["m-home"] });
    },
  });

  const deleteSprintMutation = useMutation({
    mutationFn: (sprintId: string) => mApi.deleteSprint(projectId!, sprintId),
    onSuccess: () => {
      setDeletingSprintId(null);
      setExpandedSprintId(null);
      queryClient.invalidateQueries({ queryKey: ["m-home"] });
    },
  });

  const transferMutation = useMutation({
    mutationFn: ({
      issueId,
      currentSprintId,
      targetSprintId,
      mode,
    }: {
      issueId: string;
      currentSprintId: string;
      targetSprintId: string;
      mode: "transfer" | "copy";
    }) =>
      mApi.transferIssue(projectId!, currentSprintId, {
        issueId,
        mode,
        targetSprintId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["m-home"] });
      queryClient.invalidateQueries({ queryKey: ["m-sprint-detail"] });
      setTransferTarget(null);
      setMovingIssue(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => mApi.createSprint(projectId!, {
      name: newSprintName,
      goal: newSprintGoal || undefined,
      startDate: newSprintStartDate || undefined,
      endDate: newSprintEndDate || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["m-home"] });
      setShowCreateModal(false);
      setNewSprintName("");
      setNewSprintGoal("");
      setNewSprintStartDate("");
      setNewSprintEndDate("");
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ issueId, sprintId }: { issueId: string; sprintId: string | null }) =>
      mApi.patchIssue(issueId, { sprintId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["m-home"] });
      queryClient.invalidateQueries({ queryKey: ["m-sprint-detail"] });
      setMovingIssue(null);
    },
  });

  const isLoading = loadingHome;

  const sortedSprints = sprints
    ? [...sprints].sort((a, b) => {
        const order: Record<SprintStatus, number> = { ACTIVE: 0, PLANNING: 1, COMPLETED: 2 };
        return order[a.status] - order[b.status];
      })
    : [];

  // 현재 확장된 스프린트 (FAB용)
  const expandedSprint = sortedSprints.find((s) => s.id === expandedSprintId);

  if (isLoading) return <Spinner />;

  return (
    <div style={{ background: "#f8fafc", minHeight: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "24px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>스프린트</span>
        {isMaster && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", backgroundColor: "#6366f1", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <PenLine size={15} />새 스프린트
          </button>
        )}
      </div>

      {/* Sprint list */}
      {sortedSprints.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>스프린트가 없어요</div>
        </div>
      ) : (
        <div style={{ padding: "0 16px" }}>
          {sortedSprints.map((sprint) => {
            const isExpanded = expandedSprintId === sprint.id;
            const statusCfg = SPRINT_STATUS_CONFIG[sprint.status];
            const startStr = formatDate(sprint.startDate);
            const endStr = formatDate(sprint.endDate);
            const detailIssues = isExpanded ? (sprintDetail?.issues ?? []) : [];

            return (
              <div
                key={sprint.id}
                style={{
                  backgroundColor: "#fff", borderRadius: 16, marginBottom: 10,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden",
                }}
              >
                {/* Sprint header row */}
                <button
                  onClick={() => setExpandedSprintId(isExpanded ? null : sprint.id)}
                  style={{
                    width: "100%", background: "none", border: "none", cursor: "pointer",
                    padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{sprint.name}</span>
                      <span style={{
                        backgroundColor: statusCfg.bg, color: statusCfg.color,
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                      }}>
                        {statusCfg.label}
                      </span>
                    </div>
                    {(startStr || endStr) && (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {startStr && endStr ? `${startStr} ~ ${endStr}` : startStr ?? endStr}
                      </div>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid #f8fafc" }}>
                    {loadingDetail ? (
                      <div style={{ padding: 20 }}><Spinner /></div>
                    ) : detailIssues.length === 0 ? (
                      <div style={{ padding: "16px", fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
                        이슈가 없어요
                      </div>
                    ) : (
                      <div style={{ padding: "8px 12px" }}>
                        {detailIssues.map((issue) => (
                          <div
                            key={issue.id}
                            style={{
                              display: "flex", alignItems: "center", gap: 6,
                              padding: "8px 4px", borderBottom: "1px solid #f8fafc",
                            }}
                          >
                            {/* 이슈 상세 버튼 */}
                            <button
                              onClick={() => setSelectedIssueId(issue.id)}
                              style={{
                                flex: 1, background: "none", border: "none", cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 8,
                                textAlign: "left", minWidth: 0,
                              }}
                            >
                              <PriorityDot priority={issue.priority} />
                              <span style={{
                                flex: 1, fontSize: 13, color: "#111827",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {issue.title}
                              </span>
                              <StatusBadge status={issue.status} />
                              {issue.assignee && (
                                <Avatar
                                  name={issue.assignee.name ?? "?"}
                                  color={issue.assignee.color ?? "#6366f1"}
                                  size={24}
                                />
                              )}
                            </button>
                            {/* 스프린트 이동 버튼 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMovingIssue({ id: issue.id, title: issue.title, currentSprintId: sprint.id });
                              }}
                              title="다른 스프린트로 이동"
                              style={{
                                flexShrink: 0, background: "#f1f5f9", border: "none",
                                borderRadius: 8, padding: "5px 7px", cursor: "pointer",
                                display: "flex", alignItems: "center", color: "#6b7280",
                              }}
                            >
                              <MoveRight size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    {isMaster && (
                      <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                        {startError && expandedSprintId === sprint.id && (
                          <div style={{
                            padding: "8px 12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca",
                            borderRadius: 8, fontSize: 12, color: "#ef4444",
                          }}>
                            {startError}
                          </div>
                        )}
                        {sprint.status === "PLANNING" && (
                          <button
                            onClick={() => { setStartError(null); startMutation.mutate(sprint.id); }}
                            disabled={startMutation.isPending}
                            style={{
                              flex: 1, padding: "10px", backgroundColor: "#6366f1", color: "#fff",
                              border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
                              cursor: "pointer", opacity: startMutation.isPending ? 0.7 : 1,
                            }}
                          >
                            {startMutation.isPending ? "시작 중..." : "스프린트 시작"}
                          </button>
                        )}
                        {sprint.status === "ACTIVE" && (
                          <button
                            onClick={() => {
                              setCompleteError(null);
                              completeProbeMutation.mutate(sprint.id);
                            }}
                            disabled={completeProbeMutation.isPending}
                            style={{
                              flex: 1, padding: "10px", backgroundColor: "#fff", color: "#ef4444",
                              border: "1.5px solid #ef4444", borderRadius: 10, fontSize: 13, fontWeight: 600,
                              cursor: "pointer", opacity: completeProbeMutation.isPending ? 0.7 : 1,
                            }}
                          >
                            {completeProbeMutation.isPending ? "완료 중..." : "스프린트 완료"}
                          </button>
                        )}
                        {sprint.status === "PLANNING" && (
                          <button
                            onClick={() => setDeletingSprintId(sprint.id)}
                            style={{
                              flex: 1, padding: "10px", backgroundColor: "#fff", color: "#ef4444",
                              border: "1.5px solid #fecaca", borderRadius: 10, fontSize: 13, fontWeight: 600,
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            }}
                          >
                            <Trash2 size={14} /> 스프린트 삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ height: 16 }} />

      {/* FAB - 과제 추가 */}
      {projectId && (
        <CreateIssueFAB
          projectId={projectId}
          sprintId={expandedSprint?.status === "ACTIVE" ? expandedSprint.id : null}
          members={members}
        />
      )}

      {/* 새 스프린트 모달 */}
      {showCreateModal && (
        <>
          <div
            onClick={() => setShowCreateModal(false)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200 }}
          />
          <div style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 201,
            backgroundColor: "#fff", borderRadius: "20px 20px 0 0",
            padding: "24px 20px",
            paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>새 스프린트</span>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
              >
                <X size={20} />
              </button>
            </div>

            <label style={{ display: "block", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>스프린트 이름 *</div>
              <input
                value={newSprintName}
                onChange={(e) => setNewSprintName(e.target.value)}
                placeholder="스프린트 이름을 입력하세요"
                style={{
                  width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb",
                  borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box",
                }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>스프린트 목표</div>
              <textarea
                value={newSprintGoal}
                onChange={(e) => setNewSprintGoal(e.target.value)}
                placeholder="이번 스프린트의 목표를 입력하세요"
                rows={2}
                style={{
                  width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb",
                  borderRadius: 10, fontSize: 14, outline: "none", resize: "none",
                  boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
            </label>

            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              <label style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>시작일</div>
                <input
                  type="date"
                  value={newSprintStartDate}
                  onChange={(e) => setNewSprintStartDate(e.target.value)}
                  style={{
                    width: "100%", padding: "11px 10px", border: "1.5px solid #e5e7eb",
                    borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box",
                    color: newSprintStartDate ? "#111827" : "#9ca3af",
                  }}
                />
              </label>
              <label style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>종료일</div>
                <input
                  type="date"
                  value={newSprintEndDate}
                  onChange={(e) => setNewSprintEndDate(e.target.value)}
                  style={{
                    width: "100%", padding: "11px 10px", border: "1.5px solid #e5e7eb",
                    borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box",
                    color: newSprintEndDate ? "#111827" : "#9ca3af",
                  }}
                />
              </label>
            </div>

            <button
              onClick={() => createMutation.mutate()}
              disabled={!newSprintName.trim() || createMutation.isPending}
              style={{
                width: "100%", padding: "13px", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
                backgroundColor: !newSprintName.trim() ? "#e0e7ff" : "#6366f1",
                color: !newSprintName.trim() ? "#9ca3af" : "#fff",
                cursor: newSprintName.trim() ? "pointer" : "not-allowed",
              }}
            >
              {createMutation.isPending ? "생성 중..." : "스프린트 생성"}
            </button>
          </div>
        </>
      )}

      {/* 스프린트 이동 바텀시트 */}
      {movingIssue && (
        <>
          <div
            onClick={() => setMovingIssue(null)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200 }}
          />
          <div style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 201,
            backgroundColor: "#fff", borderRadius: "20px 20px 0 0",
            padding: "20px 20px",
            paddingBottom: "max(20px, env(safe-area-inset-bottom))",
            maxHeight: "70dvh", display: "flex", flexDirection: "column",
          }}>
            {/* 핸들 */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#e5e7eb" }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>스프린트 이동</div>
            <div style={{
              fontSize: 13, color: "#6b7280", marginBottom: 16,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              "{movingIssue.title}"
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {/* 백로그로 이동 */}
              <button
                onClick={() => moveMutation.mutate({ issueId: movingIssue.id, sprintId: null })}
                disabled={moveMutation.isPending}
                style={{
                  width: "100%", textAlign: "left", padding: "14px 16px",
                  borderRadius: 12, border: "1.5px solid #e5e7eb",
                  backgroundColor: "#f8fafc", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 8, opacity: moveMutation.isPending ? 0.7 : 1,
                }}
              >
                <span style={{ fontSize: 18 }}>📦</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>백로그</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>스프린트에서 제외</div>
                </div>
              </button>

              {/* 다른 스프린트들 */}
              {sortedSprints
                .filter((s) => s.id !== movingIssue.currentSprintId)
                .map((s) => {
                  const cfg = SPRINT_STATUS_CONFIG[s.status];
                  return (
                    <button
                      key={s.id}
                      onClick={() => setTransferTarget({ sprintId: s.id, sprintName: s.name })}
                      disabled={moveMutation.isPending || transferMutation.isPending}
                      style={{
                        width: "100%", textAlign: "left", padding: "14px 16px",
                        borderRadius: 12, border: "1.5px solid #e5e7eb",
                        backgroundColor: "#fff", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 10,
                        marginBottom: 8, opacity: moveMutation.isPending ? 0.7 : 1,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>⚡</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.name}
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: cfg.color,
                          backgroundColor: cfg.bg, padding: "1px 7px", borderRadius: 20,
                        }}>
                          {cfg.label}
                        </span>
                      </div>
                    </button>
                  );
                })}

              {sortedSprints.filter((s) => s.id !== movingIssue.currentSprintId).length === 0 && (
                <div style={{ textAlign: "center", padding: "20px", color: "#9ca3af", fontSize: 13 }}>
                  이동할 다른 스프린트가 없어요
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 이관 vs 복사 선택 모달 */}
      {transferTarget && movingIssue && (
        <>
          <div
            onClick={() => setTransferTarget(null)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 210 }}
          />
          <div style={{
            position: "fixed", left: 16, right: 16, top: "50%", transform: "translateY(-50%)",
            zIndex: 211, backgroundColor: "#fff", borderRadius: 16, padding: 20,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
              {transferTarget.sprintName}(으)로
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
              이관할까요, 복사할까요?
            </div>
            <button
              onClick={() => transferMutation.mutate({
                issueId: movingIssue.id,
                currentSprintId: movingIssue.currentSprintId,
                targetSprintId: transferTarget.sprintId,
                mode: "transfer",
              })}
              disabled={transferMutation.isPending}
              style={{
                width: "100%", padding: "12px", marginBottom: 8,
                backgroundColor: "#6366f1", color: "#fff", border: "none",
                borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
                opacity: transferMutation.isPending ? 0.7 : 1,
              }}
            >
              이관 (원본 이동)
            </button>
            <button
              onClick={() => transferMutation.mutate({
                issueId: movingIssue.id,
                currentSprintId: movingIssue.currentSprintId,
                targetSprintId: transferTarget.sprintId,
                mode: "copy",
              })}
              disabled={transferMutation.isPending}
              style={{
                width: "100%", padding: "12px", marginBottom: 8,
                backgroundColor: "#fff", color: "#6366f1",
                border: "1.5px solid #6366f1", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: "pointer", opacity: transferMutation.isPending ? 0.7 : 1,
              }}
            >
              복사 (원본 유지)
            </button>
            <button
              onClick={() => setTransferTarget(null)}
              style={{
                width: "100%", padding: "10px", backgroundColor: "transparent",
                color: "#6b7280", border: "none", fontSize: 13, cursor: "pointer",
              }}
            >
              취소
            </button>
          </div>
        </>
      )}

      {/* 스프린트 완료 - FAILED 처리 모달 */}
      {completingSprint && (
        <>
          <div
            onClick={() => !completeFinalMutation.isPending && setCompletingSprint(null)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 210 }}
          />
          <div style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 211,
            backgroundColor: "#fff", borderRadius: "20px 20px 0 0",
            padding: "20px",
            paddingBottom: "max(20px, env(safe-area-inset-bottom))",
            maxHeight: "80dvh", display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#e5e7eb" }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
              {completingSprint.name} 완료
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
              미완료 과제 {completingSprint.failedIssues.length}건 처리 방식을 선택해주세요
            </div>

            <div style={{
              flex: 1, overflowY: "auto", marginBottom: 14,
              backgroundColor: "#f8fafc", borderRadius: 10, padding: "8px 10px",
            }}>
              {completingSprint.failedIssues.map((iss) => (
                <div key={iss.id} style={{
                  fontSize: 13, color: "#374151", padding: "6px 0",
                  borderBottom: "1px solid #eef2f7",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  • {iss.title}
                </div>
              ))}
            </div>

            {completeError && (
              <div style={{
                padding: "8px 12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 8, fontSize: 12, color: "#ef4444", marginBottom: 10,
              }}>
                {completeError}
              </div>
            )}

            {(() => {
              const nextPlanning = sortedSprints.find(
                (s) => s.id !== completingSprint.id && s.status === "PLANNING"
              );
              return (
                <>
                  <button
                    onClick={() => {
                      if (!nextPlanning) {
                        setCompleteError("이관할 PLANNING 스프린트가 없어요");
                        return;
                      }
                      completeFinalMutation.mutate({
                        sprintId: completingSprint.id,
                        failedAction: "next-sprint",
                        targetSprintId: nextPlanning.id,
                      });
                    }}
                    disabled={completeFinalMutation.isPending || !nextPlanning}
                    style={{
                      width: "100%", padding: "12px", marginBottom: 8,
                      backgroundColor: nextPlanning ? "#6366f1" : "#e0e7ff",
                      color: nextPlanning ? "#fff" : "#9ca3af",
                      border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                      cursor: nextPlanning ? "pointer" : "not-allowed",
                      opacity: completeFinalMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    다음 스프린트로 이관 {nextPlanning ? `(${nextPlanning.name})` : "(없음)"}
                  </button>
                  <button
                    onClick={() => completeFinalMutation.mutate({
                      sprintId: completingSprint.id,
                      failedAction: "backlog",
                    })}
                    disabled={completeFinalMutation.isPending}
                    style={{
                      width: "100%", padding: "12px", marginBottom: 8,
                      backgroundColor: "#fff", color: "#6366f1",
                      border: "1.5px solid #6366f1", borderRadius: 10, fontSize: 14, fontWeight: 700,
                      cursor: "pointer", opacity: completeFinalMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    백로그로 이동
                  </button>
                  <button
                    onClick={() => completeFinalMutation.mutate({
                      sprintId: completingSprint.id,
                      failedAction: null,
                    })}
                    disabled={completeFinalMutation.isPending}
                    style={{
                      width: "100%", padding: "12px", marginBottom: 8,
                      backgroundColor: "#f1f5f9", color: "#6b7280",
                      border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
                      cursor: "pointer", opacity: completeFinalMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    그대로 두기 (보류 처리)
                  </button>
                  <button
                    onClick={() => setCompletingSprint(null)}
                    disabled={completeFinalMutation.isPending}
                    style={{
                      width: "100%", padding: "10px", backgroundColor: "transparent",
                      color: "#9ca3af", border: "none", fontSize: 13, cursor: "pointer",
                    }}
                  >
                    취소
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* 스프린트 삭제 확인 */}
      {deletingSprintId && (
        <>
          <div
            onClick={() => !deleteSprintMutation.isPending && setDeletingSprintId(null)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 210 }}
          />
          <div style={{
            position: "fixed", left: 24, right: 24, top: "50%", transform: "translateY(-50%)",
            zIndex: 211, backgroundColor: "#fff", borderRadius: 16, padding: 20,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
              스프린트를 삭제할까요?
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 18 }}>
              스프린트에 속한 과제는 백로그로 이동돼요. 이 작업은 되돌릴 수 없어요.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setDeletingSprintId(null)}
                disabled={deleteSprintMutation.isPending}
                style={{
                  flex: 1, padding: "11px", backgroundColor: "#f1f5f9", color: "#374151",
                  border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={() => deleteSprintMutation.mutate(deletingSprintId)}
                disabled={deleteSprintMutation.isPending}
                style={{
                  flex: 1, padding: "11px", backgroundColor: "#ef4444", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
                  opacity: deleteSprintMutation.isPending ? 0.7 : 1,
                }}
              >
                {deleteSprintMutation.isPending ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 과제 상세/편집 모달 */}
      {selectedIssueId && projectId && (
        <IssueModal
          issueId={selectedIssueId}
          projectId={projectId}
          members={members}
          initialIssue={sprintDetail?.issues?.find((i: {id: string}) => i.id === selectedIssueId)}
          onClose={() => setSelectedIssueId(null)}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ["m-home"] });
            queryClient.invalidateQueries({ queryKey: ["m-sprint-detail"] });
          }}
        />
      )}
    </div>
  );
}
