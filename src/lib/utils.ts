import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInDays, format, isToday, isTomorrow } from "date-fns";
import { ko } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  if (isToday(d)) return "오늘";
  if (isTomorrow(d)) return "내일";
  return format(d, "M월 d일", { locale: ko });
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "M월 d일 HH:mm", { locale: ko });
}

export function getDDayLabel(endDate: Date | string): string {
  const days = differenceInDays(new Date(endDate), new Date());
  if (days < 0) return `D+${Math.abs(days)}`;
  if (days === 0) return "D-Day";
  return `D-${days}`;
}

export const MEMBER_COLORS = [
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#10b981",
  "#f43f5e",
];

export const PRIORITY_CONFIG = {
  HIGH: { label: "높음", color: "#f97316" },
  MEDIUM: { label: "보통", color: "#eab308" },
  LOW: { label: "낮음", color: "#6b7280" },
} as const;

export const STATUS_CONFIG = {
  READY: { label: "준비", color: "#3b82f6", bg: "bg-blue-50", text: "text-blue-700" },
  IN_PROGRESS: { label: "진행 중", color: "#8b5cf6", bg: "bg-purple-50", text: "text-purple-700" },
  RESOLVED: { label: "해결됨", color: "#f59e0b", bg: "bg-amber-50", text: "text-amber-700" },
  CLOSED: { label: "종료", color: "#10b981", bg: "bg-green-50", text: "text-green-700" },
  REJECTED: { label: "반려", color: "#ef4444", bg: "bg-red-50", text: "text-red-700" },
  HOLD: { label: "보류", color: "#9ca3af", bg: "bg-gray-50", text: "text-gray-600" },
} as const;

export const KANBAN_COLUMNS: (keyof typeof STATUS_CONFIG)[] = [
  "READY",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];
