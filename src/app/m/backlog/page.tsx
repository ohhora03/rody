"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { mApi } from "../_lib/api";
import Avatar from "../_components/Avatar";
import StatusBadge from "../_components/StatusBadge";
import PriorityDot from "../_components/PriorityDot";
import CreateIssueFAB from "../_components/CreateIssueFAB";
import IssueModal from "../_components/IssueModal";

type IssueStatus = "READY" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REJECTED" | "HOLD";
type Priority = "HIGH" | "MEDIUM" | "LOW";

interface User { id: string; name: string; color: string }
interface Issue {
  id: string; title: string; status: IssueStatus; priority: Priority;
  points: number | null; assignee: User | null;
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

const ALL_STATUSES: IssueStatus[] = ["READY", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED", "HOLD"];
const STATUS_LABELS: Record<IssueStatus, string> = {
  READY: "준비", IN_PROGRESS: "진행 중", RESOLVED: "해결됨",
  CLOSED: "종료", REJECTED: "반려", HOLD: "보류",
};

export default function BacklogPage() {
  const { data: session } = useSession();
  const [filterStatus, setFilterStatus] = useState<IssueStatus | "ALL">("ALL");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const { data: homeData, isLoading: loadingHome } = useQuery<{
    families: Family[];
    project: Project | null;
  }>({
    queryKey: ["m-home"],
    queryFn: mApi.home,
    enabled: !!session?.user,
    staleTime: 5 * 60 * 1000,
  });

  const family = homeData?.families?.[0] ?? null;
  const projectId = homeData?.project?.id ?? null;

  const members = (family?.members ?? []).map((m) => ({
    id: m.user.id, name: m.user.name, color: m.user.color,
  }));

  const {
    data: issues,
    isLoading: loadingIssues,
    refetch,
  } = useQuery<Issue[]>({
    queryKey: ["m-backlog", projectId],
    queryFn: () => mApi.backlog(projectId!),
    enabled: !!projectId,
  });

  const isLoading = loadingHome || loadingIssues;

  const presentStatuses = ALL_STATUSES.filter((s) => issues?.some((i) => i.status === s));

  const filtered =
    filterStatus === "ALL" ? (issues ?? []) : (issues ?? []).filter((i) => i.status === filterStatus);

  if (isLoading) return <Spinner />;

  return (
    <div style={{ background: "#f8fafc", minHeight: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "24px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>백로그</span>
          <span style={{
            backgroundColor: "#e0e7ff", color: "#6366f1",
            fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
          }}>
            {issues?.length ?? 0}
          </span>
        </div>
        <button
          onClick={() => refetch()}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "#6b7280", display: "flex", alignItems: "center" }}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Status filter chips */}
      {presentStatuses.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: "0 16px 14px", overflowX: "auto", scrollbarWidth: "none" }}>
          <button
            onClick={() => setFilterStatus("ALL")}
            style={{
              padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
              backgroundColor: filterStatus === "ALL" ? "#6366f1" : "#e0e7ff",
              color: filterStatus === "ALL" ? "#fff" : "#6366f1",
              transition: "all 0.15s",
            }}
          >전체</button>
          {presentStatuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                backgroundColor: filterStatus === s ? "#6366f1" : "#e0e7ff",
                color: filterStatus === s ? "#fff" : "#6366f1",
                transition: "all 0.15s",
              }}
            >{STATUS_LABELS[s]}</button>
          ))}
        </div>
      )}

      {/* Issue list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#6b7280" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 4 }}>백로그가 비어있어요</div>
          <div style={{ fontSize: 13 }}>이슈가 없거나 모두 스프린트에 할당되었어요</div>
        </div>
      ) : (
        <div style={{ padding: "0 16px" }}>
          {filtered.map((issue) => (
            <button
              key={issue.id}
              onClick={() => setSelectedIssueId(issue.id)}
              style={{
                width: "100%", textAlign: "left", backgroundColor: "#fff", borderRadius: 12,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "12px 14px", marginBottom: 8,
                display: "flex", alignItems: "center", gap: 10, border: "none", cursor: "pointer",
              }}
            >
              <PriorityDot priority={issue.priority} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 500, color: "#111827",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5,
                }}>
                  {issue.title}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <StatusBadge status={issue.status} />
                  {issue.points != null && (
                    <span style={{
                      backgroundColor: "#f1f5f9", color: "#6b7280",
                      fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
                    }}>
                      {issue.points}pt
                    </span>
                  )}
                </div>
              </div>
              {issue.assignee && (
                <Avatar
                  name={issue.assignee.name ?? "?"}
                  color={issue.assignee.color ?? "#6366f1"}
                  size={28}
                />
              )}
            </button>
          ))}
        </div>
      )}

      <div style={{ height: 16 }} />

      {projectId && (
        <CreateIssueFAB projectId={projectId} sprintId={null} members={members} />
      )}

      {/* 과제 상세/편집 모달 */}
      {selectedIssueId && projectId && (
        <IssueModal
          issueId={selectedIssueId}
          projectId={projectId}
          members={members}
          onClose={() => setSelectedIssueId(null)}
          onSave={() => refetch()}
        />
      )}
    </div>
  );
}
