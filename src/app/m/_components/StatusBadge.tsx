type IssueStatus = "READY" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REJECTED" | "HOLD" | "FAILED";

interface StatusBadgeProps {
  status: IssueStatus;
}

const STATUS_CONFIG: Record<IssueStatus, { label: string; bg: string; color: string }> = {
  READY: { label: "준비", bg: "#eff6ff", color: "#3b82f6" },
  IN_PROGRESS: { label: "진행 중", bg: "#f5f3ff", color: "#7c3aed" },
  RESOLVED: { label: "해결됨", bg: "#fffbeb", color: "#d97706" },
  CLOSED: { label: "종료", bg: "#f0fdf4", color: "#16a34a" },
  REJECTED: { label: "반려", bg: "#fef2f2", color: "#dc2626" },
  HOLD: { label: "보류", bg: "#f9fafb", color: "#6b7280" },
  FAILED: { label: "실패", bg: "#fef2f2", color: "#dc2626" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.HOLD;
  return (
    <span
      style={{
        backgroundColor: config.bg,
        color: config.color,
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: 20,
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {config.label}
    </span>
  );
}
