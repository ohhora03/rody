"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { mApi } from "../_lib/api";
import Avatar from "../_components/Avatar";
import StatusBadge from "../_components/StatusBadge";
import PriorityDot from "../_components/PriorityDot";
import CreateIssueFAB from "../_components/CreateIssueFAB";

type IssueStatus = "READY" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REJECTED" | "HOLD";
type Priority = "HIGH" | "MEDIUM" | "LOW";

interface User {
  id: string;
  name: string;
  email: string;
  color: string;
}

interface Issue {
  id: string;
  title: string;
  status: IssueStatus;
  priority: Priority;
  points: number | null;
  sprintId: string | null;
  assignee: User | null;
}

interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED";
  startDate: string | null;
  endDate: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface FamilyMember {
  id: string;
  role: "MASTER" | "MEMBER";
  user: User;
}

interface Family {
  id: string;
  name: string;
  members: FamilyMember[];
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid #e0e7ff",
          borderTopColor: "#6366f1",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function TaskItem({ issue }: { issue: Issue }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        padding: "12px 14px",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <PriorityDot priority={issue.priority} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#111827",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: 4,
          }}
        >
          {issue.title}
        </div>
        <StatusBadge status={issue.status} />
      </div>
      {issue.assignee && (
        <Avatar
          name={issue.assignee.name ?? "?"}
          color={issue.assignee.color ?? "#6366f1"}
          size={28}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"overview" | "assignee">("overview");

  const { data: families, isLoading: loadingFamilies } = useQuery<Family[]>({
    queryKey: ["m-families"],
    queryFn: mApi.families,
    enabled: !!session?.user,
  });

  const family = families?.[0];

  const { data: projects, isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ["m-projects", family?.id],
    queryFn: () => mApi.projects(family!.id),
    enabled: !!family?.id,
  });

  const activeProjectId = selectedProjectId ?? projects?.[0]?.id ?? null;

  const { data: sprints, isLoading: loadingSprints } = useQuery<Sprint[]>({
    queryKey: ["m-sprints", activeProjectId],
    queryFn: () => mApi.sprints(activeProjectId!),
    enabled: !!activeProjectId,
  });

  const activeSprint = sprints?.find((s) => s.status === "ACTIVE") ?? null;

  const { data: issues, isLoading: loadingIssues } = useQuery<Issue[]>({
    queryKey: ["m-issues", activeProjectId, activeSprint?.id],
    queryFn: () => mApi.issues(activeProjectId!, activeSprint!.id),
    enabled: !!activeProjectId && !!activeSprint?.id,
  });

  const isLoading = loadingFamilies || loadingProjects || loadingSprints;

  const userName = session?.user?.name ?? "사용자";
  const userId = session?.user?.id;

  const doneStatuses: IssueStatus[] = ["RESOLVED", "CLOSED"];
  const inProgressStatuses: IssueStatus[] = ["IN_PROGRESS"];

  const totalCount = issues?.length ?? 0;
  const inProgressCount = issues?.filter((i) => inProgressStatuses.includes(i.status)).length ?? 0;
  const doneCount = issues?.filter((i) => doneStatuses.includes(i.status)).length ?? 0;
  const achieveRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const myIssues = issues?.filter((i) => i.assignee?.id === userId) ?? [];

  // Group issues by assignee
  const memberMap = new Map<string, { user: User; issues: Issue[] }>();
  issues?.forEach((issue) => {
    if (!issue.assignee) return;
    const key = issue.assignee.id;
    if (!memberMap.has(key)) {
      memberMap.set(key, { user: issue.assignee, issues: [] });
    }
    memberMap.get(key)!.issues.push(issue);
  });

  const activeProject = projects?.find((p) => p.id === activeProjectId);

  if (isLoading) return <Spinner />;

  return (
    <div style={{ background: "#f8fafc", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ padding: "24px 20px 12px" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>
          안녕하세요, {userName}님 👋
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
          {family?.name ?? "가족 그룹"}
        </div>
      </div>

      {/* Project picker */}
      {projects && projects.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "0 20px 12px",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
                backgroundColor: activeProjectId === p.id ? "#6366f1" : "#e0e7ff",
                color: activeProjectId === p.id ? "#fff" : "#6366f1",
                transition: "all 0.15s",
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Active Sprint Card */}
      {activeSprint ? (
        <div style={{ padding: "0 16px 16px" }}>
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            {/* Top row */}
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}
            >
              <span
                style={{
                  backgroundColor: "#dcfce7",
                  color: "#16a34a",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 20,
                }}
              >
                진행 중
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                {activeSprint.name}
              </span>
            </div>

            {/* Goal */}
            {activeSprint.goal && (
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
                {activeSprint.goal}
              </div>
            )}

            {/* Metrics */}
            {loadingIssues ? (
              <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Spinner />
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[
                    { label: "전체", value: totalCount, bg: "#eef2ff", color: "#6366f1" },
                    { label: "진행중", value: inProgressCount, bg: "#fffbeb", color: "#d97706" },
                    { label: "완료", value: doneCount, bg: "#f0fdf4", color: "#16a34a" },
                    { label: "달성률", value: `${achieveRate}%`, bg: "#f5f3ff", color: "#7c3aed" },
                  ].map(({ label, value, bg, color }) => (
                    <div
                      key={label}
                      style={{
                        flex: 1,
                        backgroundColor: bg,
                        borderRadius: 10,
                        padding: "8px 4px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 18, fontWeight: 800, color }}>
                        {value}
                      </div>
                      <div style={{ fontSize: 10, color, fontWeight: 500, marginTop: 1 }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: 6,
                    backgroundColor: "#e0e7ff",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${achieveRate}%`,
                      backgroundColor: "#6366f1",
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* No active sprint */
        <div
          style={{
            margin: "0 16px 16px",
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: "32px 20px",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 6 }}>
            진행 중인 스프린트가 없어요
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
            스프린트를 시작해 목표를 달성해보세요
          </div>
          <Link
            href="/m/sprint"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              backgroundColor: "#6366f1",
              color: "#fff",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            스프린트 탭으로 이동
          </Link>
        </div>
      )}

      {/* View toggle */}
      {activeSprint && issues && issues.length > 0 && (
        <>
          <div style={{ padding: "0 16px 12px", display: "flex", gap: 6 }}>
            {(["overview", "assignee"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 20,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: viewMode === mode ? "#6366f1" : "#e0e7ff",
                  color: viewMode === mode ? "#fff" : "#6366f1",
                  transition: "all 0.15s",
                }}
              >
                {mode === "overview" ? "전체" : "담당자별"}
              </button>
            ))}
          </div>

          {viewMode === "overview" ? (
            <>
              {/* My tasks */}
              {myIssues.length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "8px 20px 8px",
                    }}
                  >
                    내 과제
                  </div>
                  <div style={{ padding: "0 16px" }}>
                    {myIssues.map((issue) => (
                      <TaskItem key={issue.id} issue={issue} />
                    ))}
                  </div>
                </>
              )}

              {/* All tasks */}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "8px 20px 8px",
                }}
              >
                전체 과제
              </div>
              <div style={{ padding: "0 16px" }}>
                {issues.slice(0, 5).map((issue) => (
                  <TaskItem key={issue.id} issue={issue} />
                ))}
              </div>
            </>
          ) : (
            /* Assignee view */
            <div style={{ padding: "0 16px" }}>
              {Array.from(memberMap.values()).map(({ user, issues: userIssues }) => {
                const done = userIssues.filter((i) => doneStatuses.includes(i.status)).length;
                const rate = userIssues.length > 0 ? Math.round((done / userIssues.length) * 100) : 0;
                return (
                  <div
                    key={user.id}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 10,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 12,
                      }}
                    >
                      <Avatar name={user.name ?? "?"} color={user.color ?? "#6366f1"} size={36} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                          {user.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          {done}/{userIssues.length} 완료
                        </div>
                      </div>
                      <div
                        style={{
                          marginLeft: "auto",
                          fontSize: 16,
                          fontWeight: 800,
                          color: "#6366f1",
                        }}
                      >
                        {rate}%
                      </div>
                    </div>
                    <div
                      style={{
                        height: 4,
                        backgroundColor: "#e0e7ff",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${rate}%`,
                          backgroundColor: "#6366f1",
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div style={{ height: 16 }} />

      {/* 이슈 생성 FAB */}
      {activeProjectId && (
        <CreateIssueFAB
          projectId={activeProjectId}
          sprintId={activeSprint?.id}
          members={family?.members ?? []}
        />
      )}
    </div>
  );
}
