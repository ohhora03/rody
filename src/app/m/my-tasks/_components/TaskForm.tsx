"use client";

import { useState } from "react";

export type Priority = "HIGH" | "MEDIUM" | "LOW";
export type TaskStatus = "PENDING" | "DONE";
export type RepeatType = "NONE" | "DAILY" | "WEEKLY";
export type AcceptStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface MyTask {
  id: string;
  title: string;
  memo: string | null;
  priority: Priority;
  status: TaskStatus;
  acceptStatus: AcceptStatus;
  dueDate: string | null;
  repeat: RepeatType;
  ownerId: string;
  assigneeId: string | null;
  owner?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskFormValues {
  title: string;
  memo: string | null;
  priority: Priority;
  dueDate: string | null;
  repeat: RepeatType;
  assigneeId: string | null;
}

export interface FamilyMemberOption {
  id: string;
  name: string;
}

interface Props {
  initial?: Partial<TaskFormValues>;
  submitLabel?: string;
  submitting?: boolean;
  currentUserId?: string;
  familyMembers?: FamilyMemberOption[];
  onSubmit: (values: TaskFormValues) => void;
  onCancel?: () => void;
}

// ISO 8601 → YYYY-MM-DD (date input value)
function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function TaskForm({
  initial,
  submitLabel = "저장",
  submitting = false,
  currentUserId,
  familyMembers,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(toDateInputValue(initial?.dueDate ?? null));
  const [repeat, setRepeat] = useState<RepeatType>(initial?.repeat ?? "NONE");
  const [assigneeId, setAssigneeId] = useState<string>(
    initial?.assigneeId ?? currentUserId ?? "",
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      memo: memo.trim() ? memo.trim() : null,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      repeat,
      assigneeId: assigneeId || null,
    });
  };

  const canSubmit = title.trim().length > 0 && !submitting;

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ display: "block" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          제목 *
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="할 일 제목"
          autoFocus
          style={{
            width: "100%",
            padding: "11px 14px",
            border: "1.5px solid #e5e7eb",
            borderRadius: 10,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </label>

      <label style={{ display: "block" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          메모
        </div>
        <textarea
          value={memo ?? ""}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          rows={3}
          style={{
            width: "100%",
            padding: "11px 14px",
            border: "1.5px solid #e5e7eb",
            borderRadius: 10,
            fontSize: 14,
            outline: "none",
            resize: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
      </label>

      <label style={{ display: "block" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          우선순위
        </div>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          style={{
            width: "100%",
            padding: "11px 14px",
            border: "1.5px solid #e5e7eb",
            borderRadius: 10,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            backgroundColor: "#fff",
          }}
        >
          <option value="HIGH">높음</option>
          <option value="MEDIUM">보통</option>
          <option value="LOW">낮음</option>
        </select>
      </label>

      <label style={{ display: "block" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          마감일
        </div>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={{
            width: "100%",
            padding: "11px 14px",
            border: "1.5px solid #e5e7eb",
            borderRadius: 10,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            backgroundColor: "#fff",
          }}
        />
      </label>

      <label style={{ display: "block" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          반복
        </div>
        <select
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as RepeatType)}
          style={{
            width: "100%",
            padding: "11px 14px",
            border: "1.5px solid #e5e7eb",
            borderRadius: 10,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            backgroundColor: "#fff",
          }}
        >
          <option value="NONE">반복 안 함</option>
          <option value="DAILY">매일</option>
          <option value="WEEKLY">매주</option>
        </select>
      </label>

      {familyMembers && familyMembers.length > 0 && (
        <label style={{ display: "block" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            담당자
          </div>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            style={{
              width: "100%",
              padding: "11px 14px",
              border: "1.5px solid #e5e7eb",
              borderRadius: 10,
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
              backgroundColor: "#fff",
            }}
          >
            {currentUserId && (
              <option value={currentUserId}>나 자신</option>
            )}
            {familyMembers
              .filter((m) => m.id !== currentUserId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </label>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "13px",
              border: "1.5px solid #e5e7eb",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              backgroundColor: "#fff",
              color: "#6b7280",
              cursor: "pointer",
            }}
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            flex: 2,
            padding: "13px",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            backgroundColor: canSubmit ? "#6366f1" : "#e0e7ff",
            color: canSubmit ? "#fff" : "#9ca3af",
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {submitting ? "저장 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
