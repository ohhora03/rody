"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, PenLine, X } from "lucide-react";
import { mApi } from "../_lib/api";
import StatusBadge from "../_components/StatusBadge";
import PriorityDot from "../_components/PriorityDot";
import Avatar from "../_components/Avatar";
import IssueModal from "../_components/IssueModal";
import CreateIssueFAB from "../_components/CreateIssueFAB";

type SprintStatus = "PLANNING" | "ACTIVE" | "COMPLETED";
type IssueStatus = "READY" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REJECTED" | "HOLD";
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
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const { data: homeData, isLoading: loadingHome } = useQuery<{
    families: Family[];
    project: (Project & { sprints: Sprint[] }) | null;
    activeSprint: Sprint | null;
  }>({
    queryKey: ["m-home"],
    queryFn: mApi.home,
    enabled: !!session?.user,
    staleTime: 5 * 60 * 1000,
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
  });

  const startMutation = useMutation({
    mutationFn: (sprintId: string) => mApi.startSprint(projectId!, sprintId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["m-home"] }),
  });

  const completeMutation = useMutation({
    mutationFn: (sprintId: string) => mApi.completeSprint(projectId!, sprintId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["m-home"] }),
  });

  const createMutation = useMutation({
    mutationFn: () => mApi.createSprint(projectId!, { name: newSprintName, goal: newSprintGoal || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["m-home"] });
      setShowCreateModal(false);
      setNewSprintName("");
      setNewSprintGoal("");
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
                          <button
                            key={issue.id}
                            onClick={() => setSelectedIssueId(issue.id)}
                            style={{
                              width: "100%", background: "none", border: "none", cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "10px 4px", borderBottom: "1px solid #f8fafc",
                              textAlign: "left",
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
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    {isMaster && (
                      <div style={{ padding: "10px 16px 14px", display: "flex", gap: 8 }}>
                        {sprint.status === "PLANNING" && (
                          <button
                            onClick={() => startMutation.mutate(sprint.id)}
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
                            onClick={() => completeMutation.mutate(sprint.id)}
                            disabled={completeMutation.isPending}
                            style={{
                              flex: 1, padding: "10px", backgroundColor: "#fff", color: "#ef4444",
                              border: "1.5px solid #ef4444", borderRadius: 10, fontSize: 13, fontWeight: 600,
                              cursor: "pointer", opacity: completeMutation.isPending ? 0.7 : 1,
                            }}
                          >
                            {completeMutation.isPending ? "완료 중..." : "스프린트 완료"}
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

            <label style={{ display: "block", marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>스프린트 목표</div>
              <textarea
                value={newSprintGoal}
                onChange={(e) => setNewSprintGoal(e.target.value)}
                placeholder="이번 스프린트의 목표를 입력하세요"
                rows={3}
                style={{
                  width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb",
                  borderRadius: 10, fontSize: 14, outline: "none", resize: "none",
                  boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
            </label>

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
