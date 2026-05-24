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
import IssueModal from "../_components/IssueModal";

type IssueStatus = "READY" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REJECTED" | "HOLD";
type Priority = "HIGH" | "MEDIUM" | "LOW";
type TaskStatus = "PENDING" | "DONE";
type RepeatType = "NONE" | "DAILY" | "WEEKLY";

interface MyTask {
  id: string; title: string; priority: Priority; status: TaskStatus;
  dueDate: string | null; repeat: RepeatType;
}

function calcDDay(dueDate: string): { label: string; color: string } {
  const due = new Date(dueDate);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return { label: "D-Day", color: "#f59e0b" };
  if (diff > 0) return { label: `D-${diff}`, color: diff <= 3 ? "#ef4444" : "#6b7280" };
  return { label: `D+${Math.abs(diff)}`, color: "#ef4444" };
}

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

function SkeletonBlock({ w, h, radius = 8 }: { w: string | number; h: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }} />
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100%" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>
      {/* 헤더 */}
      <div style={{ padding: "24px 20px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonBlock w={180} h={24} />
        <SkeletonBlock w={100} h={16} />
      </div>
      {/* 스프린트 카드 */}
      <div style={{ margin: "0 16px 16px", backgroundColor: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <SkeletonBlock w={60} h={22} radius={20} />
          <SkeletonBlock w={120} h={22} />
        </div>
        <SkeletonBlock w="100%" h={14} />
        <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
          {[0,1,2,3].map(i => <SkeletonBlock key={i} w="25%" h={52} radius={10} />)}
        </div>
        <SkeletonBlock w="100%" h={6} radius={3} />
      </div>
      {/* 과제 목록 */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ backgroundColor: "#fff", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <SkeletonBlock w={10} h={10} radius={5} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <SkeletonBlock w={`${60 + i * 10}%`} h={14} />
              <SkeletonBlock w={50} h={18} radius={20} />
            </div>
            <SkeletonBlock w={32} h={32} radius={16} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskItem({ issue, onTap }: { issue: Issue; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      style={{
        width: "100%", backgroundColor: "#fff", borderRadius: 12, textAlign: "left",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "12px 14px",
        marginBottom: 8, display: "flex", alignItems: "center", gap: 10,
        border: "none", cursor: "pointer",
      }}
    >
      <PriorityDot priority={issue.priority} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: "#111827",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4,
        }}>{issue.title}</div>
        <StatusBadge status={issue.status} />
      </div>
      {issue.assignee && <Avatar name={issue.assignee.name ?? "?"} color={issue.assignee.color ?? "#6366f1"} size={28} />}
    </button>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [viewMode, setViewMode] = useState<"overview" | "assignee">("overview");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<HomeData>({
    queryKey: ["m-home"],
    queryFn: mApi.home,
    enabled: !!session?.user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: myTasks = [] } = useQuery<MyTask[]>({
    queryKey: ["my-tasks"],
    queryFn: () => fetch("/api/my-tasks").then(r => r.json()).then(r => r.data ?? []),
    enabled: !!session?.user,
    staleTime: 60_000,
  });

  const pendingTasks = myTasks
    .filter(t => t.status === "PENDING")
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 5);

  const family = data?.families?.[0] ?? null;
  const project = data?.project ?? null;
  const activeSprint = data?.activeSprint ?? null;
  const issues = data?.issues ?? [];

  const userId = session?.user?.id;
  const userName = session?.user?.name ?? "사용자";

  const members = (family?.members ?? []).map((m) => ({
    id: m.user.id, name: m.user.name, color: m.user.color,
  }));

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

  if (isLoading) return <DashboardSkeleton />;

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

      {/* 내 할 일 섹션 */}
      {pendingTasks.length > 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{
            backgroundColor: "#fff", borderRadius: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden",
          }}>
            {/* 헤더 */}
            <div style={{
              padding: "14px 16px 10px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>내 할 일</span>
                <span style={{
                  backgroundColor: "#6366f1", color: "#fff",
                  fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                }}>{pendingTasks.length}</span>
              </div>
              <Link href="/m/my-tasks" style={{
                fontSize: 12, color: "#6366f1", fontWeight: 600, textDecoration: "none",
              }}>전체 보기 →</Link>
            </div>

            {/* 할 일 목록 */}
            <div style={{ padding: "0 12px 12px" }}>
              {pendingTasks.map((task) => {
                const today = new Date().toDateString();
                const isToday = task.dueDate && new Date(task.dueDate).toDateString() === today;
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isToday;
                const priorityColor: Record<Priority, string> = { HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#10b981" };
                return (
                  <Link
                    key={task.id}
                    href="/m/my-tasks"
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 4px", borderBottom: "1px solid #f8fafc",
                      textDecoration: "none",
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      backgroundColor: priorityColor[task.priority],
                    }} />
                    <span style={{
                      flex: 1, fontSize: 14, color: "#111827", fontWeight: 500,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{task.title}</span>
                    {task.repeat !== "NONE" && (
                      <span style={{ fontSize: 12, flexShrink: 0 }}>🔄</span>
                    )}
                    {task.dueDate && (
                      <>
                        <span style={{
                          fontSize: 11, fontWeight: 600, flexShrink: 0,
                          color: isOverdue ? "#ef4444" : isToday ? "#f59e0b" : "#9ca3af",
                        }}>
                          {isToday ? "오늘" : isOverdue ? "기한 초과" : new Date(task.dueDate).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        </span>
                        {(() => {
                          const dd = calcDDay(task.dueDate);
                          return (
                            <span style={{
                              fontSize: 11, fontWeight: 700, flexShrink: 0, color: dd.color,
                            }}>
                              {dd.label}
                            </span>
                          );
                        })()}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
                    {myIssues.map((i) => (
                      <TaskItem key={i.id} issue={i} onTap={() => setSelectedIssueId(i.id)} />
                    ))}
                  </div>
                </>
              )}
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#9ca3af",
                textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 20px",
              }}>전체 과제</div>
              <div style={{ padding: "0 16px" }}>
                {issues.map((i) => (
                  <TaskItem key={i.id} issue={i} onTap={() => setSelectedIssueId(i.id)} />
                ))}
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
                      {ui.map((i) => (
                        <TaskItem key={i.id} issue={i} onTap={() => setSelectedIssueId(i.id)} />
                      ))}
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

      {/* 과제 상세/편집 모달 */}
      {selectedIssueId && project && (
        <IssueModal
          issueId={selectedIssueId}
          projectId={project.id}
          sprintId={activeSprint?.id}
          members={members}
          initialIssue={issues.find(i => i.id === selectedIssueId)}
          onClose={() => setSelectedIssueId(null)}
          onSave={() => refetch()}
        />
      )}
    </div>
  );
}
