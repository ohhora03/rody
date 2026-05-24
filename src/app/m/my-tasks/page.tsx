"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import TaskCard from "./_components/TaskCard";
import type { MyTask } from "./_components/TaskForm";

type FilterMode = "ALL" | "TODAY" | "DONE";

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

function isSameLocalDate(iso: string | null, ref: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function sortTasks(a: MyTask, b: MyTask) {
  // 미완료 먼저
  if (a.status !== b.status) return a.status === "DONE" ? 1 : -1;
  // dueDate 없으면 맨 뒤
  if (!a.dueDate && !b.dueDate) {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  }
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  // dueDate 오름차순
  const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  if (diff !== 0) return diff;
  // priority HIGH > MEDIUM > LOW
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  return priorityOrder[a.priority] - priorityOrder[b.priority];
}

export default function MyTasksPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const [filter, setFilter] = useState<FilterMode>("ALL");

  const { data: tasks = [], isLoading } = useQuery<MyTask[]>({
    queryKey: ["my-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/my-tasks");
      if (!res.ok) throw new Error("목록을 불러오지 못했어요");
      const json = await res.json();
      return json.data as MyTask[];
    },
    staleTime: 60_000,
  });

  const acceptMutation = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      fetch(`/api/my-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptStatus: accept ? "ACCEPTED" : "REJECTED" }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-tasks"] }),
  });

  // 수락 대기 항목 (다른 사람이 나에게 부여)
  const pendingAcceptTasks = tasks.filter(
    (t) => t.acceptStatus === "PENDING" && t.assigneeId === currentUserId,
  );
  // 정식 목록 (수락된 것만)
  const acceptedTasks = tasks.filter((t) => t.acceptStatus === "ACCEPTED");

  const today = new Date();
  const filtered = acceptedTasks.filter((t) => {
    if (filter === "TODAY") return isSameLocalDate(t.dueDate, today);
    if (filter === "DONE") return t.status === "DONE";
    return true;
  });

  const sorted = [...filtered].sort(sortTasks);

  const FILTERS: { key: FilterMode; label: string }[] = [
    { key: "ALL", label: "전체" },
    { key: "TODAY", label: "오늘" },
    { key: "DONE", label: "완료" },
  ];

  return (
    <div style={{ background: "#f8fafc", minHeight: "100%", position: "relative" }}>
      {/* Header */}
      <div
        style={{
          padding: "24px 20px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>내 할 일</span>
          <span
            style={{
              backgroundColor: "#e0e7ff",
              color: "#6366f1",
              fontSize: 12,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 20,
            }}
          >
            {acceptedTasks.length}
          </span>
        </div>
      </div>

      {/* 수락 대기 섹션 */}
      {pendingAcceptTasks.length > 0 && (
        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#ea580c", padding: "0 4px" }}>
            수락 대기 ({pendingAcceptTasks.length})
          </div>
          {pendingAcceptTasks.map((task) => (
            <div
              key={task.id}
              style={{
                backgroundColor: "#fff7ed",
                borderRadius: 12,
                padding: "14px 16px",
                border: "1.5px solid #fed7aa",
              }}
            >
              <div style={{ fontSize: 12, color: "#ea580c", fontWeight: 600, marginBottom: 6 }}>
                {task.owner?.name ?? "가족"}님이 할일을 부여했어요
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
                {task.title}
              </div>
              {task.memo && (
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>{task.memo}</div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => acceptMutation.mutate({ id: task.id, accept: true })}
                  disabled={acceptMutation.isPending}
                  style={{
                    flex: 1,
                    padding: "9px",
                    backgroundColor: "#6366f1",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ✅ 수락
                </button>
                <button
                  onClick={() => acceptMutation.mutate({ id: task.id, accept: false })}
                  disabled={acceptMutation.isPending}
                  style={{
                    flex: 1,
                    padding: "9px",
                    backgroundColor: "#fff",
                    color: "#ef4444",
                    border: "1.5px solid #ef4444",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ❌ 거절
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter chips */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "0 16px 14px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
                backgroundColor: active ? "#6366f1" : "#e0e7ff",
                color: active ? "#fff" : "#6366f1",
                transition: "all 0.15s",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <Spinner />
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#6b7280" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 12 }}>
            할 일이 없어요
          </div>
          <button
            onClick={() => router.push("/m/my-tasks/new")}
            style={{
              padding: "10px 20px",
              backgroundColor: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + 추가하기
          </button>
        </div>
      ) : (
        <div style={{ padding: "0 16px" }}>
          {sorted.map((task) => (
            <TaskCard key={task.id} task={task} currentUserId={currentUserId} />
          ))}
        </div>
      )}

      <div style={{ height: 80 }} />

      {/* Floating add button */}
      <button
        onClick={() => router.push("/m/my-tasks/new")}
        aria-label="새 할 일 추가"
        style={{
          position: "fixed",
          right: 20,
          bottom: "calc(80px + env(safe-area-inset-bottom))",
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: "#6366f1",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
          zIndex: 50,
        }}
      >
        <Plus size={26} />
      </button>
    </div>
  );
}
