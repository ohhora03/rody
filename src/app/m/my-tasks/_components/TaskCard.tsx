"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Repeat } from "lucide-react";
import type { MyTask } from "./TaskForm";

interface Props {
  task: MyTask;
  onTap?: (task: MyTask) => void;
}

const PRIORITY_CONFIG: Record<MyTask["priority"], { label: string; bg: string; color: string }> = {
  HIGH:   { label: "높음", bg: "#fee2e2", color: "#dc2626" },
  MEDIUM: { label: "보통", bg: "#fef3c7", color: "#d97706" },
  LOW:    { label: "낮음", bg: "#dcfce7", color: "#16a34a" },
};

function formatDueDate(date: string | null) {
  if (!date) return null;
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

export default function TaskCard({ task, onTap }: Props) {
  const queryClient = useQueryClient();
  const isDone = task.status === "DONE";

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const nextStatus = isDone ? "PENDING" : "DONE";
      const res = await fetch(`/api/my-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("상태 변경 실패");
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["my-tasks"] });
      const prev = queryClient.getQueryData<MyTask[]>(["my-tasks"]);
      const nextStatus: MyTask["status"] = isDone ? "PENDING" : "DONE";
      queryClient.setQueryData<MyTask[]>(["my-tasks"], (old) =>
        (old ?? []).map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["my-tasks"], ctx.prev);
      alert("상태 변경에 실패했어요");
    },
    onSettled: () => {
      // 반복 과제 완료 시 새 과제가 자동 생성되므로 항상 invalidate
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
    },
  });

  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const dueStr = formatDueDate(task.dueDate);

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        padding: "12px 14px",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: isDone ? 0.6 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {/* 체크박스 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleMutation.mutate();
        }}
        disabled={toggleMutation.isPending}
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: 6,
          border: isDone ? "none" : "2px solid #d1d5db",
          backgroundColor: isDone ? "#6366f1" : "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
        aria-label={isDone ? "미완료로 변경" : "완료로 변경"}
      >
        {isDone && <Check size={16} color="#fff" strokeWidth={3} />}
      </button>

      {/* 본문 */}
      <button
        onClick={() => onTap?.(task)}
        style={{
          flex: 1,
          minWidth: 0,
          background: "none",
          border: "none",
          padding: 0,
          textAlign: "left",
          cursor: onTap ? "pointer" : "default",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: isDone ? "#9ca3af" : "#111827",
            textDecoration: isDone ? "line-through" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: 5,
          }}
        >
          {task.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              backgroundColor: priorityCfg.bg,
              color: priorityCfg.color,
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 20,
            }}
          >
            {priorityCfg.label}
          </span>
          {dueStr && (
            <span
              style={{
                backgroundColor: "#f1f5f9",
                color: "#6b7280",
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 20,
              }}
            >
              {dueStr}
            </span>
          )}
          {task.repeat !== "NONE" && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                color: "#6366f1",
                fontSize: 11,
                fontWeight: 600,
              }}
              title={task.repeat === "DAILY" ? "매일 반복" : "매주 반복"}
            >
              <Repeat size={12} />
              {task.repeat === "DAILY" ? "매일" : "매주"}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
