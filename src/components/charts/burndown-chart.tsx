"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { eachDayOfInterval, format, isAfter } from "date-fns";
import { ko } from "date-fns/locale";
import type { SprintWithIssues, BurndownPoint } from "@/types";

function buildData(sprint: SprintWithIssues): BurndownPoint[] {
  if (!sprint.startDate || !sprint.endDate) return [];
  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  const today = new Date();
  const days = eachDayOfInterval({ start, end });
  const total = sprint.issues.reduce((s, i) => s + i.points, 0);
  const n = days.length - 1 || 1;

  return days.map((day, idx) => {
    const ideal = Math.max(0, Math.round(total - (total / n) * idx));
    const isPast = !isAfter(day, today);
    let remaining: number | null = null;
    if (isPast) {
      const done = sprint.issues
        .filter((i) => i.status === "CLOSED" && i.updatedAt && !isAfter(new Date(i.updatedAt), day))
        .reduce((s, i) => s + i.points, 0);
      remaining = Math.max(0, total - done);
    }
    return { date: format(day, "M/d", { locale: ko }), remaining, ideal };
  });
}

export function BurndownChart({ sprint }: { sprint: SprintWithIssues }) {
  const data = buildData(sprint);
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-8">스프린트 기간이 설정되지 않았습니다</p>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8e6ff" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={{ stroke: "#e8e6ff" }} />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={{ stroke: "#e8e6ff" }} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: "8px", border: "1px solid #e8e6ff", fontSize: "12px" }}
          formatter={(v, name) => [`${v}점`, name === "remaining" ? "실제 남은 포인트" : "이상적 목표"]}
        />
        <Legend formatter={(v) => v === "remaining" ? "실제 남은 포인트" : "이상적 목표"} wrapperStyle={{ fontSize: "12px" }} />
        <Line type="monotone" dataKey="ideal" stroke="#c4b5fd" strokeWidth={2} strokeDasharray="5 5" dot={false} name="ideal" />
        <Line type="monotone" dataKey="remaining" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: "#6366f1", r: 3 }} connectNulls={false} name="remaining" />
      </LineChart>
    </ResponsiveContainer>
  );
}
