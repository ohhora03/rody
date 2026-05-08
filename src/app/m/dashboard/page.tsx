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

interface User { id: string; name: string; email: string; color: string }
interface Issue {
  id: string; title: string; status: IssueStatus; priority: Priority;
  points: number | null; sprintId: string | null; assignee: User | null;
}
interface Sprint {
  id: string; name: string; goal: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED";
}
interface FamilyMember { id: string; role: "MASTER" | "MEMBER"; user: User }
interface Family { id: string; name: string; members: FamilyMember[] }
interface Project { id: string; name: string }

interface HomeData {
  families: Family[];
  project: Project | null;
  activeSprint: Sprint | null;
  issues: Issue[];
}

const DONE: IssueStatus[] = ["RESOLVED", "CLOSED"];
const IN_PROG: IssueStatus[] = ["IN_PROGRESS"];

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, minHeight: 300 }}>
      <div style={{
        width: 32, height: 32, border: "3px solid #e0e7ff",
        borderTopColor: "#6366f1", borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function TaskItem({ issue }: { issue: Issue }) {
  return (
    <div style={{
      backgroundColor: "#fff", borderRadius: 12,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "12px 14px",
      marginBottom: 8, display: "flex", alignItems: "center", gap: 10,
    }}>
      <PriorityDot priority={issue.priority} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: "#111827",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4,
        }}>{issue.title}</div>
        <StatusBadge status={issue.status} />
      </div>
      {issue.assignee && <Avatar name={issue.assignee.name ?? "?"} color={issue.assignee.color ?? "#6366f1"} size={28} />}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [viewMode, setViewMode] = useState<"overview" | "assignee">("overview");

  // 단일 API 호출로 모든 데이터 가져오기
  const { data, isLoading } = useQuery<HomeData>({
    queryKey: ["m-home"],
    queryFn: mApi.home,
    enabled: !!session?.user,
    staleTime: 30_000,
  });

  const family = data?.families?.[0] ?? null;
  const project = data?.project ?? null;
  const activeSprint = data?.activeSprint ?? null;
  const issues = data?.issues ?? [];

  const userId = session?.user?.id;
  const userName = session?.user?.name ?? "사용자";

  const total = issues.length;
  const done = issues.filter((i) => DONE.includes(i.status)).length;
  const inProg = issues.filter((i) => IN_PROG.includes(i.status)).length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
  const myIssues = issues.filter((i) => i.assignee?.id === userId);

  // 담당자별 그룹핑
  const memberMap = new Map<string, { user: User; issues: Issue[] }>();
  issues.forEach((issue) => {
    if (!issue.assignee) return;
    const k = issue.assignee.id;
    if (!memberMap.has(k)) memberMap.set(k, { user: issue.assignee, issues: [] });
    memberMap.get(k)!.issues.push(issue);
  });

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

      {/* Active Sprint Card */}
      {activeSprint ? (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{
            backgroundColor: "#fff", borderRadius: 16, padding: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{
                backgroundColor: "#dcfce7", color: "#16a34a",
                fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
              }}>진행 중</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{activeSprint.name}</span>
            </div>
            {activeSprint.goal && (
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>{activeSprint.goal}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[
                { label: "전체", value: total, bg: "#eef2ff", color: "#6366f1" },
                { label: "진행중", value: inProg, bg: "#fffbeb", color: "#d97706" },
                { label: "완료", value: done, bg: "#f0fdf4", color: "#16a34a" },
                { label: "달성률", value: `${rate}%`, bg: "#f5f3ff", color: "#7c3aed" },
              ].map(({ label, value, bg, color }) => (
                <div key={label} style={{
                  flex: 1, backgroundColor: bg, borderRadius: 10,
                  padding: "8px 4px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 10, color, fontWeight: 500, marginTop: 1 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 6, backgroundColor: "#e0e7ff", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${rate}%`,
                backgroundColor: "#6366f1", borderRadius: 3, transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          margin: "0 16px 16px", backgroundColor: "#fff", borderRadius: 16,
          padding: "32px 20px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 6 }}>
            진행 중인 스프린트가 없어요
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
            스프린트를 시작해 목표를 달성해보세요
          </div>
          <Link href="/m/sprint" style={{
            display: "inline-block", padding: "10px 24px", backgroundColor: "#6366f1",
            color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none",
          }}>스프린트 탭으로 이동</Link>
        </div>
      )}

      {/* View toggle */}
      {activeSprint && issues.length > 0 && (
        <>
          <div style={{ padding: "0 16px 12px", display: "flex", gap: 6 }}>
            {(["overview", "assignee"] as const).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                backgroundColor: viewMode === mode ? "#6366f1" : "#e0e7ff",
                color: viewMode === mode ? "#fff" : "#6366f1",
              }}>
                {mode === "overview" ? "전체" : "담당자별"}
              </button>
            ))}
          </div>

          {viewMode === "overview" ? (
            <>
              {myIssues.length > 0 && (
                <>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "#9ca3af",
                    textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 20px",
                  }}>내 과제</div>
                  <div style={{ padding: "0 16px" }}>
                    {myIssues.map((i) => <TaskItem key={i.id} issue={i} />)}
                  </div>
                </>
              )}
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#9ca3af",
                textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 20px",
              }}>전체 과제</div>
              <div style={{ padding: "0 16px" }}>
                {issues.map((i) => <TaskItem key={i.id} issue={i} />)}
              </div>
            </>
          ) : (
            <div style={{ padding: "0 16px" }}>
              {Array.from(memberMap.values()).map(({ user, issues: ui }) => {
                const d = ui.filter((i) => DONE.includes(i.status)).length;
                const r = ui.length > 0 ? Math.round((d / ui.length) * 100) : 0;
                return (
                  <div key={user.id} style={{
                    backgroundColor: "#fff", borderRadius: 16, padding: 16,
                    marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <Avatar name={user.name ?? "?"} color={user.color ?? "#6366f1"} size={36} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{user.name}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{d}/{ui.length} 완료</div>
                      </div>
                      <div style={{ marginLeft: "auto", fontSize: 16, fontWeight: 800, color: "#6366f1" }}>{r}%</div>
                    </div>
                    <div style={{ height: 4, backgroundColor: "#e0e7ff", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${r}%`, backgroundColor: "#6366f1", borderRadius: 2 }} />
                    </div>
                    <div style={{ marginTop: 12 }}>
                      {ui.map((i) => <TaskItem key={i.id} issue={i} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div style={{ height: 16 }} />

      {project && (
        <CreateIssueFAB
          projectId={project.id}
          sprintId={activeSprint?.id}
          members={family?.members ?? []}
        />
      )}
    </div>
  );
}
