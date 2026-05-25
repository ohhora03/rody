"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Target, CheckCircle2, Clock, Award, Users, TrendingUp, AlertCircle, PauseCircle, Filter } from "lucide-react";
import { BurndownChart } from "@/components/charts/burndown-chart";
import { PRIORITY_CONFIG, STATUS_CONFIG } from "@/lib/utils";
import type { IssueWithRelations, SprintWithIssues, Sprint } from "@/types";

export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [allIssues, setAllIssues] = useState<IssueWithRelations[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<SprintWithIssues | null>(null);
  // 필터: "active" | "all" | sprintId
  const [scope, setScope] = useState<string>("active");

  useEffect(() => {
    async function load() {
      const [issRes, spRes] = await Promise.all([
        fetch(`/api/issues?projectId=${projectId}`),
        fetch(`/api/projects/${projectId}/sprints`),
      ]);
      const [issJson, spJson] = await Promise.all([issRes.json(), spRes.json()]);
      setAllIssues(issJson.data ?? []);
      const sprintList: Sprint[] = spJson.data ?? [];
      setSprints(sprintList);
      const active = sprintList.find((s) => s.status === "ACTIVE");
      if (active) {
        const r = await fetch(`/api/projects/${projectId}/sprints/${active.id}`);
        const j = await r.json();
        setActiveSprint(j.data ?? null);
      }
    }
    load();
  }, [projectId]);

  // scope에 따라 이슈 필터링
  const issues = (() => {
    if (scope === "all") return allIssues;
    if (scope === "active") {
      if (!activeSprint) return [];
      return allIssues.filter((i) => i.sprintId === activeSprint.id);
    }
    // 특정 sprint id
    return allIssues.filter((i) => i.sprintId === scope);
  })();

  const totalTasks = issues.length;
  const closedTasks = issues.filter((i) => i.status === "CLOSED").length;
  const inProgressTasks = issues.filter((i) => i.status === "IN_PROGRESS").length;
  const rejectedTasks = issues.filter((i) => i.status === "REJECTED").length;
  const holdTasks = issues.filter((i) => i.status === "HOLD").length;
  const totalPts = issues.reduce((s, i) => s + i.points, 0);
  const closedPts = issues.filter((i) => i.status === "CLOSED").reduce((s, i) => s + i.points, 0);
  const pct = totalTasks > 0 ? Math.round((closedTasks / totalTasks) * 100) : 0;

  // 담당자별 통계 (과제 수 + 스토리포인트)
  const assigneeStats = issues.reduce((acc, i) => {
    const key = i.assignee?.id ?? "none";
    if (!acc[key]) acc[key] = {
      name: i.assignee?.name ?? "미배정",
      color: i.assignee?.color ?? "#9ca3af",
      total: 0, closed: 0, inProgress: 0,
      totalPts: 0, closedPts: 0,
    };
    acc[key].total++;
    acc[key].totalPts += i.points;
    if (i.status === "CLOSED") { acc[key].closed++; acc[key].closedPts += i.points; }
    if (i.status === "IN_PROGRESS") acc[key].inProgress++;
    return acc;
  }, {} as Record<string, { name: string; color: string; total: number; closed: number; inProgress: number; totalPts: number; closedPts: number }>);

  const priorityStats = issues.reduce((acc, i) => {
    acc[i.priority] = (acc[i.priority] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // 상태별 분포
  const statusStats = Object.entries(STATUS_CONFIG).map(([k, v]) => ({
    key: k,
    label: v.label,
    color: v.color,
    count: issues.filter((i) => i.status === k).length,
  }));

  function StatCard({ icon, label, value, sub, bg, text }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; bg: string; text: string }) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className={`inline-flex p-2.5 rounded-xl mb-3 ${bg}`}><span className={text}>{icon}</span></div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 text-gray-700"
          >
            <option value="active">활성 스프린트{activeSprint ? ` (${activeSprint.name})` : ""}</option>
            <option value="all">전체 누적</option>
            {sprints.length > 0 && <option disabled>──────────</option>}
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status === "ACTIVE" ? "진행 중" : s.status === "COMPLETED" ? "완료" : "계획"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {scope === "active" && !activeSprint && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 text-sm flex items-center justify-between">
          <span>활성 스프린트가 없습니다.</span>
          <button onClick={() => setScope("all")} className="text-xs font-semibold underline">전체 보기로 전환</button>
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Target className="w-5 h-5" />} label="전체 과제" value={totalTasks} bg="bg-indigo-50" text="text-indigo-600" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="종료" value={closedTasks} sub={`${pct}% 달성 · ${closedPts}점`} bg="bg-green-50" text="text-green-600" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="진행 중" value={inProgressTasks} bg="bg-purple-50" text="text-purple-600" />
        <StatCard icon={<Award className="w-5 h-5" />} label="전체 포인트" value={`${totalPts}점`} sub={`보류 ${holdTasks} · 반려 ${rejectedTasks}`} bg="bg-amber-50" text="text-amber-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* 번다운 차트 */}
        {activeSprint && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />번다운 차트
              <span className="text-xs text-gray-400 font-normal">{activeSprint.name}</span>
            </h2>
            <BurndownChart sprint={activeSprint} />
          </div>
        )}

        {/* 담당자별 현황 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />담당자별 현황
          </h2>
          <div className="space-y-4">
            {Object.values(assigneeStats).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">과제가 없습니다</p>
            )}
            {Object.values(assigneeStats).sort((a, b) => b.total - a.total).map((stat) => {
              const rate = stat.total > 0 ? Math.round((stat.closed / stat.total) * 100) : 0;
              return (
                <div key={stat.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: stat.color }}>
                        {stat.name.slice(0, 1)}
                      </div>
                      <div>
                        <p className="text-sm text-gray-800 font-medium">{stat.name}</p>
                        <p className="text-[10px] text-gray-400">{stat.inProgress}개 진행 중</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-700">{stat.closedPts}/{stat.totalPts}점</p>
                      <p className="text-[10px] text-gray-400">{stat.closed}/{stat.total}개 · {rate}%</p>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${rate}%`, background: stat.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 상태별 분포 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-indigo-500" />상태별 현황
          </h2>
          <div className="space-y-3">
            {statusStats.filter((s) => s.count > 0 || totalTasks === 0).map((s) => {
              const rate = totalTasks > 0 ? (s.count / totalTasks) * 100 : 0;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="text-xs font-semibold w-14 text-right" style={{ color: s.color }}>{s.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${rate}%`, background: s.color }} />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right font-medium">{s.count}개</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 우선순위 분포 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">우선순위 분포</h2>
          <div className="space-y-3">
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => {
              const count = priorityStats[k] ?? 0;
              const rate = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className="text-xs font-semibold w-10 text-right" style={{ color: v.color }}>{v.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${rate}%`, background: v.color }} />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right font-medium">{count}개</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 스프린트 히스토리 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:col-span-2">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <PauseCircle className="w-4 h-4 text-indigo-500" />스프린트 히스토리
          </h2>
          {sprints.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">스프린트 기록이 없습니다</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sprints.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-sm text-gray-700 font-medium">{s.name}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    s.status === "ACTIVE" ? "bg-indigo-100 text-indigo-700" :
                    s.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                    "bg-gray-200 text-gray-600"
                  }`}>
                    {s.status === "ACTIVE" ? "진행 중" : s.status === "COMPLETED" ? "완료" : "계획"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
