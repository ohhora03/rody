"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { mApi } from "../_lib/api";

type Priority = "HIGH" | "MEDIUM" | "LOW";

interface Member {
  id: string;
  user: { id: string; name: string; color: string };
}

interface Props {
  projectId: string;
  sprintId?: string | null;
  members?: Member[];
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: "HIGH", label: "높음", color: "#f97316" },
  { value: "MEDIUM", label: "보통", color: "#eab308" },
  { value: "LOW", label: "낮음", color: "#6b7280" },
];

export default function CreateIssueFAB({ projectId, sprintId, members = [] }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleClose() {
    setOpen(false);
    setTitle("");
    setPriority("MEDIUM");
    setAssigneeId("");
    setError("");
  }

  async function handleSubmit() {
    if (!title.trim()) { setError("제목을 입력해주세요"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await mApi.createIssue({
        title: title.trim(),
        projectId,
        sprintId: sprintId ?? null,
        assigneeId: assigneeId || null,
        priority,
      });
      if (res.error) throw new Error(res.error);
      // Invalidate all issue-related queries
      qc.invalidateQueries({ queryKey: ["m-issues"] });
      qc.invalidateQueries({ queryKey: ["m-backlog"] });
      handleClose();
    } catch (e: any) {
      setError(e?.message ?? "생성에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* FAB 버튼 */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 76,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: "50%",
          backgroundColor: "#6366f1",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
          zIndex: 90,
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.94)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* 모달 백드롭 */}
      {open && (
        <div
          onClick={handleClose}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            zIndex: 200,
          }}
        />
      )}

      {/* 바텀 시트 */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#fff",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: "0 20px 32px",
          zIndex: 201,
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
        }}
      >
        {/* 핸들 */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, marginBottom: 4 }}>
          <div style={{ width: 36, height: 4, backgroundColor: "#e5e7eb", borderRadius: 2 }} />
        </div>

        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 20px" }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>새 이슈 만들기</span>
          <button
            onClick={handleClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9ca3af" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 제목 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
            제목 *
          </label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="이슈 제목을 입력하세요"
            style={{
              width: "100%",
              padding: "12px 14px",
              border: error ? "1.5px solid #ef4444" : "1.5px solid #e5e7eb",
              borderRadius: 10,
              fontSize: 15,
              color: "#111827",
              outline: "none",
              boxSizing: "border-box",
              backgroundColor: "#f9fafb",
            }}
          />
          {error && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>{error}</p>}
        </div>

        {/* 우선순위 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>
            우선순위
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {PRIORITY_OPTIONS.map(({ value, label, color }) => (
              <button
                key={value}
                onClick={() => setPriority(value)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: priority === value ? `1.5px solid ${color}` : "1.5px solid #e5e7eb",
                  backgroundColor: priority === value ? `${color}18` : "#fff",
                  color: priority === value ? color : "#6b7280",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 담당자 */}
        {members.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>
              담당자
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => setAssigneeId("")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: !assigneeId ? "1.5px solid #6366f1" : "1.5px solid #e5e7eb",
                  backgroundColor: !assigneeId ? "#eef2ff" : "#fff",
                  color: !assigneeId ? "#6366f1" : "#6b7280",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                없음
              </button>
              {members.map((m) => (
                <button
                  key={m.user.id}
                  onClick={() => setAssigneeId(m.user.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: assigneeId === m.user.id ? "1.5px solid #6366f1" : "1.5px solid #e5e7eb",
                    backgroundColor: assigneeId === m.user.id ? "#eef2ff" : "#fff",
                    color: assigneeId === m.user.id ? "#6366f1" : "#374151",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      backgroundColor: m.user.color ?? "#6366f1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {m.user.name[0]}
                  </div>
                  {m.user.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 생성 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={loading || !title.trim()}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 12,
            border: "none",
            backgroundColor: !title.trim() || loading ? "#c7d2fe" : "#6366f1",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            cursor: !title.trim() || loading ? "not-allowed" : "pointer",
            transition: "background-color 0.15s",
          }}
        >
          {loading ? "생성 중..." : "이슈 만들기"}
        </button>
      </div>
    </>
  );
}
