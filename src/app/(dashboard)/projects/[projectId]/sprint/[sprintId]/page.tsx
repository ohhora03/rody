"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { BarChart2, Filter, Layers, Plus } from "lucide-react";
import { PRIORITY_CONFIG, STATUS_CONFIG, KANBAN_COLUMNS, getDDayLabel, cn } from "@/lib/utils";
import type { IssueWithRelations, SprintWithIssues, IssueStatus, Member } from "@/types";
import { BurndownChart } from "@/components/charts/burndown-chart";
import { TaskModal } from "@/components/ticket/task-modal";
import { toast } from "sonner";

export default function SprintPage() {
  const { projectId, sprintId } = useParams<{ projectId: string; sprintId: string }>();
  const { data: session } = useSession();
  const [sprint, setSprint] = useState<SprintWithIssues | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState<"all" | "mine" | "high">("all");
  const [swimlane, setSwimlane] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [selectedTask, setSelectedTask] = useState<IssueWithRelations | null>(null);
  const [showCreateFor, setShowCreateFor] = useState<IssueStatus | null>(null);

  const load = useCallback(async () => {
    const [spRes, mbRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/sprints/${sprintId}`),
      fetch(`/api/projects/${projectId}/members`),
    ]);
    const [spJson, mbJson] = await Promise.all([spRes.json(), mbRes.json()]);
    if (spJson.data) setSprint(spJson.data);
    setMembers(mbJson.data ?? []);
  }, [projectId, sprintId]);

  useEffect(() => { load(); }, [load]);

  async function onDragEnd(result: DropResult) {
    if (!result.destination || !sprint) return;
    const issueId = result.draggableId;
    const newStatus = result.destination.droppableId.split(":").pop() as IssueStatus;
    const newOrder = result.destination.index;

    setSprint((prev) => {
      if (!prev) return prev;
      return { ...prev, issues: prev.issues.map((i) => i.id === issueId ? { ...i, status: newStatus, order: newOrder } : i) };
    });

    const res = await fetch("/api/issues/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueId, status: newStatus, order: newOrder }),
    });

    if (res.ok && newStatus === "CLOSED") {
      const { default: confetti } = await import("canvas-confetti");
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ["#6366f1", "#8b5cf6", "#c4b5fd"] });
      toast.success("종료! 🎉");
    }
    load();
  }

  if (!sprint) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  const allIssues = sprint.issues;
  const filtered = allIssues.filter((i) => {
    if (filter === "mine") return i.assigneeId === session?.user?.id;
    if (filter === "high") return i.priority === "HIGH";
    return true;
  });

  const totalPts = allIssues.reduce((s, i) => s + i.points, 0);
  const closedPts = allIssues.filter((i) => i.status === "CLOSED").reduce((s, i) => s + i.points, 0);
  const progress = totalPts > 0 ? Math.round((closedPts / totalPts) * 100) : 0;

  const swimlaneMembers = Array.from(
    new Map(allIssues.filter((i) => i.assignee).map((i) => [i.assignee!.id, { id: i.assignee!.id, name: i.assignee!.name, color: i.assignee!.color }])).values()
  );

  function ColGroup({ prefix, groupIssues }: { prefix: string; groupIssues: IssueWithRelations[] }) {
    return (
      <div className="flex gap-4">
        {KANBAN_COLUMNS.map((colId) => {
          const cfg = STATUS_CONFIG[colId];
          const colIssues = groupIssues.filter((i) => i.status === colId).sort((a, b) => a.order - b.order);
          const colPts = colIssues.reduce((s, i) => s + i.points, 0);
          return (
            <div key={colId} className="w-68 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                <span className="font-semibold text-gray-700 text-sm">{cfg.label}</span>
                <span className="ml-auto text-xs text-gray-400">{colIssues.length} · {colPts}점</span>
                <button
                  onClick={() => setShowCreateFor(colId)}
                  className="p-0.5 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                  title="과제 추가"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <Droppable droppableId={`${prefix}:${colId}`}>
                {(provided, snap) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn("min-h-28 rounded-2xl p-2 space-y-2 transition-colors", snap.isDraggingOver ? "bg-indigo-50 ring-2 ring-indigo-200" : "bg-gray-50")}
                  >
                    {colIssues.map((issue, idx) => (
                      <Draggable key={issue.id} draggableId={issue.id} index={idx}>
                        {(dp, ds) => (
                          <div
                            ref={dp.innerRef}
                            {...dp.draggableProps}
                            {...dp.dragHandleProps}
                            onClick={() => setSelectedTask(issue)}
                            className={cn(
                              "bg-white rounded-xl p-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all",
                              ds.isDragging && "rotate-1 scale-[1.02] shadow-xl"
                            )}
                          >
                            <div className="w-full h-0.5 rounded-full mb-2.5" style={{ background: PRIORITY_CONFIG[issue.priority]?.color }} />
                            <p className="text-sm text-gray-800 font-medium line-clamp-2 mb-3">{issue.title}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400">{PRIORITY_CONFIG[issue.priority]?.label}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md font-medium">{issue.points}{(issue as any).pointUnit === "DAY" ? "일" : "시간"}</span>
                                {issue.reviewer && (
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold ring-1 ring-white" style={{ background: issue.reviewer.color || "#10b981" }} title={`검수: ${issue.reviewer.name}`}>
                                    {issue.reviewer.name.slice(0, 1)}
                                  </div>
                                )}
                                {issue.assignee ? (
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: issue.assignee.color || "#6366f1" }} title={issue.assignee.name}>
                                    {issue.assignee.name.slice(0, 1)}
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gray-100 border border-dashed border-gray-300" />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{sprint.name}</h1>
            {sprint.goal && <p className="text-sm text-gray-500 mt-0.5">{sprint.goal}</p>}
          </div>
          <div className="flex items-center gap-2">
            {sprint.endDate && (
              <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                {getDDayLabel(sprint.endDate)}
              </span>
            )}
            <button
              onClick={() => setShowCreateFor("READY")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />과제 추가
            </button>
            <button
              onClick={() => setShowChart(!showChart)}
              className={cn("p-2 rounded-xl transition-colors", showChart ? "bg-indigo-100 text-indigo-600" : "text-gray-400 hover:bg-gray-100")}
            >
              <BarChart2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-gray-500 flex-shrink-0">{closedPts}/{totalPts}점 · {progress}%</span>
        </div>
      </div>

      {showChart && (
        <div className="mx-6 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">번다운 차트</h3>
          <BurndownChart sprint={sprint} />
        </div>
      )}

      {/* 필터 바 */}
      <div className="px-6 py-3 flex items-center gap-2 flex-shrink-0">
        <Filter className="w-4 h-4 text-gray-400" />
        {([["all", "전체"], ["mine", "내 담당"], ["high", "높음 우선"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium", filter === k ? "bg-indigo-100 text-indigo-700" : "text-gray-500 hover:bg-gray-100")}>
            {l}
          </button>
        ))}
        <button
          onClick={() => setSwimlane(!swimlane)}
          className={cn("ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium", swimlane ? "bg-indigo-100 text-indigo-700" : "text-gray-500 hover:bg-gray-100")}
        >
          <Layers className="w-3.5 h-3.5" />스윔레인
        </button>
      </div>

      {/* 보드 */}
      <div className="flex-1 overflow-x-auto px-6 pb-6">
        <DragDropContext onDragEnd={onDragEnd}>
          {swimlane && swimlaneMembers.length > 0 ? (
            <div className="space-y-8 min-w-max">
              {swimlaneMembers.map((m) => (
                <div key={m.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-medium" style={{ background: m.color }}>{m.name.slice(0, 1)}</div>
                    <span className="font-medium text-gray-700 text-sm">{m.name}</span>
                  </div>
                  <ColGroup prefix={m.id} groupIssues={filtered.filter((i) => i.assigneeId === m.id)} />
                </div>
              ))}
            </div>
          ) : (
            <ColGroup prefix="col" groupIssues={filtered} />
          )}
        </DragDropContext>
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          projectId={projectId}
          members={members}
          onClose={() => setSelectedTask(null)}
          onSave={() => { setSelectedTask(null); load(); }}
        />
      )}

      {showCreateFor && (
        <TaskModal
          projectId={projectId}
          sprintId={sprintId}
          members={members}
          onClose={() => setShowCreateFor(null)}
          onSave={() => { setShowCreateFor(null); load(); }}
        />
      )}
    </div>
  );
}
