"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, GripVertical, ChevronDown, ChevronRight, Zap, Package } from "lucide-react";
import { PRIORITY_CONFIG, STATUS_CONFIG, cn } from "@/lib/utils";
import type { IssueWithRelations, Sprint, Member } from "@/types";
import { TaskModal } from "@/components/ticket/task-modal";
import { toast } from "sonner";

function PriorityDot({ priority }: { priority: string }) {
  const c = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG];
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c?.color ?? "#ccc" }} />;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  if (!cfg) return null;
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0", cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

export default function BacklogPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [defaultSprintId, setDefaultSprintId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<IssueWithRelations | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [movingIssue, setMovingIssue] = useState<string | null>(null);

  // 이슈 — 60초 캐시
  const { data: issues = [], isLoading: issuesLoading } = useQuery<IssueWithRelations[]>({
    queryKey: ["issues", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/issues?projectId=${projectId}`);
      const j = await res.json();
      return j.data ?? [];
    },
    staleTime: 60_000,
    enabled: !!projectId,
  });

  // 스프린트 목록 — sprint kanban 페이지와 동일 키 공유
  const { data: sprints = [], isLoading: sprintsLoading } = useQuery<Sprint[]>({
    queryKey: ["sprints", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/sprints`);
      const j = await res.json();
      return j.data ?? [];
    },
    staleTime: 60_000,
    enabled: !!projectId,
  });

  // 멤버 — 5분 캐시 (자주 안 바뀜), sprint kanban 페이지와 동일 키 공유
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/members`);
      const j = await res.json();
      return j.data ?? [];
    },
    staleTime: 5 * 60_000,
    enabled: !!projectId,
  });

  const loading = issuesLoading || sprintsLoading;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
    queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
  }

  function openCreate(sprintId: string | null) {
    setDefaultSprintId(sprintId);
    setShowModal(true);
  }

  async function moveIssue(issueId: string, sprintId: string | null) {
    setMovingIssue(issueId);
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sprintId }),
    });
    if (res.ok) { toast.success(sprintId ? "스프린트로 이동" : "백로그로 이동"); refresh(); }
    else toast.error("이동 실패");
    setMovingIssue(null);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  const backlogIssues = issues.filter((i) => !i.sprintId);
  const activeSprints = sprints.filter((s) => s.status !== "COMPLETED");

  function Section({ sprint, sIssues }: { sprint: Sprint | null; sIssues: IssueWithRelations[] }) {
    const key = sprint?.id ?? "backlog";
    const open = !collapsed[key];
    const totalPts = sIssues.reduce((s, i) => s + i.points, 0);

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div
          className="flex items-center gap-3 px-4 py-3 bg-gray-50/80 border-b border-gray-100 cursor-pointer"
          onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
        >
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          {sprint ? <Zap className="w-4 h-4 text-indigo-500" /> : <Package className="w-4 h-4 text-gray-400" />}
          <span className="font-semibold text-gray-800 text-sm">{sprint?.name ?? "백로그"}</span>
          {sprint?.status === "ACTIVE" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">진행 중</span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{sIssues.length}개 · {totalPts}점</span>
        </div>

        {open && (
          <>
            {sIssues.length === 0 && <p className="py-6 text-center text-sm text-gray-400">과제가 없습니다</p>}
            {sIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50/40 border-b border-gray-50 last:border-0 group text-sm cursor-pointer"
                onClick={() => setSelectedTask(issue)}
              >
                <GripVertical className="w-4 h-4 text-gray-200 group-hover:text-gray-400 flex-shrink-0" />
                <PriorityDot priority={issue.priority} />
                <span className="flex-1 text-gray-800 truncate">{issue.title}</span>
                <StatusBadge status={issue.status} />
                <span className="flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold flex-shrink-0 px-1.5 py-0.5 whitespace-nowrap">{issue.points}pt</span>
                {issue.assignee ? (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0" style={{ background: issue.assignee.color || "#6366f1" }} title={issue.assignee.name}>
                    {issue.assignee.name.slice(0, 1)}
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-100 border border-dashed border-gray-300 flex-shrink-0" />
                )}
                <select
                  disabled={movingIssue === issue.id}
                  value={issue.sprintId ?? "backlog"}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); moveIssue(issue.id, e.target.value === "backlog" ? null : e.target.value); }}
                  className="opacity-0 group-hover:opacity-100 text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none"
                >
                  <option value="backlog">백로그</option>
                  {activeSprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            ))}
            <div className="px-4 py-2 border-t border-gray-50">
              <button
                onClick={() => openCreate(sprint?.id ?? null)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-600 transition-colors"
              >
                <Plus className="w-4 h-4" />과제 추가
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold text-gray-900">백로그</h1>
        <button
          onClick={() => openCreate(null)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />과제 만들기
        </button>
      </div>

      {activeSprints.map((sprint) => (
        <Section key={sprint.id} sprint={sprint} sIssues={issues.filter((i) => i.sprintId === sprint.id)} />
      ))}
      <Section sprint={null} sIssues={backlogIssues} />

      {showModal && (
        <TaskModal
          projectId={projectId}
          sprintId={defaultSprintId}
          members={members}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); refresh(); }}
        />
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          projectId={projectId}
          members={members}
          onClose={() => setSelectedTask(null)}
          onSave={() => { setSelectedTask(null); refresh(); }}
        />
      )}
    </div>
  );
}
