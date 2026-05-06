type Priority = "HIGH" | "MEDIUM" | "LOW";

interface PriorityDotProps {
  priority: Priority;
}

const PRIORITY_COLOR: Record<Priority, string> = {
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#d1d5db",
};

export default function PriorityDot({ priority }: PriorityDotProps) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: PRIORITY_COLOR[priority] ?? "#d1d5db",
        flexShrink: 0,
      }}
    />
  );
}
