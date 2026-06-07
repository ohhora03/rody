"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import type { SprintWithIssues } from "@/types";

export default function SprintPrintPage() {
  const { projectId, sprintId } = useParams<{ projectId: string; sprintId: string }>();
  const [sprint, setSprint] = useState<SprintWithIssues | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/sprints/${sprintId}`)
      .then((r) => r.json())
      .then((j) => {
        setSprint(j.data);
        // 데이터 로드 후 자동으로 인쇄 다이얼로그 열기
        setTimeout(() => window.print(), 500);
      });
  }, [projectId, sprintId]);

  if (!sprint) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#6366f1" }}>
      <p>불러오는 중...</p>
    </div>
  );

  const issues = sprint.issues ?? [];
  const totalPts = issues.reduce((s, i) => s + i.points, 0);
  const closedPts = issues.filter((i) => i.status === "CLOSED").reduce((s, i) => s + i.points, 0);
  const progress = totalPts > 0 ? Math.round((closedPts / totalPts) * 100) : 0;

  const statusOrder = ["READY", "IN_PROGRESS", "RESOLVED", "CLOSED", "FAILED", "REJECTED"];
  const sorted = [...issues].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background: white; color: #111827; }

        .print-header { padding: 32px 40px 20px; border-bottom: 2px solid #6366f1; }
        .print-header h1 { font-size: 24px; font-weight: 700; color: #1e1b4b; }
        .print-header p { font-size: 13px; color: #6b7280; margin-top: 4px; }
        .meta-row { display: flex; gap: 24px; margin-top: 12px; font-size: 12px; color: #6b7280; }
        .meta-row span strong { color: #374151; }

        .progress-bar-wrap { margin-top: 10px; height: 6px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(to right, #6366f1, #8b5cf6); border-radius: 4px; }

        .print-body { padding: 24px 40px; }

        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        thead tr { background: #f3f4f6; }
        th { padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; }
        td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
        tr:last-child td { border-bottom: none; }

        .badge { display: inline-block; padding: 2px 7px; border-radius: 99px; font-size: 11px; font-weight: 600; }
        .points { font-weight: 700; color: #6366f1; }
        .desc { font-size: 11px; color: #6b7280; margin-top: 2px; }

        .print-footer { margin-top: 32px; padding: 16px 40px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }

        /* 인쇄 전용 스타일 */
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 0; size: A4; }
        }
      `}</style>

      {/* 화면에서만 보이는 버튼 */}
      <div className="no-print" style={{ position: "fixed", top: 16, right: 16, zIndex: 100, display: "flex", gap: 8 }}>
        <button
          onClick={() => window.print()}
          style={{ padding: "8px 18px", background: "#6366f1", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}
        >
          🖨️ PDF 저장 / 인쇄
        </button>
        <button
          onClick={() => window.close()}
          style={{ padding: "8px 14px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
        >
          닫기
        </button>
      </div>

      {/* 인쇄 영역 */}
      <div className="print-header">
        <h1>📋 {sprint.name}</h1>
        {sprint.goal && <p>{sprint.goal}</p>}
        <div className="meta-row">
          {sprint.startDate && <span><strong>시작</strong> {new Date(sprint.startDate).toLocaleDateString("ko")}</span>}
          {sprint.endDate && <span><strong>종료</strong> {new Date(sprint.endDate).toLocaleDateString("ko")}</span>}
          <span><strong>전체</strong> {issues.length}개</span>
          <span><strong>완료</strong> {issues.filter(i => i.status === "CLOSED").length}개</span>
          <span><strong>포인트</strong> {closedPts}/{totalPts}pt ({progress}%)</span>
        </div>
        <div className="progress-bar-wrap">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="print-body">
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th>과제명</th>
              <th style={{ width: 70 }}>상태</th>
              <th style={{ width: 60 }}>우선순위</th>
              <th style={{ width: 50 }}>포인트</th>
              <th style={{ width: 70 }}>담당자</th>
              <th style={{ width: 70 }}>검수자</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((issue, idx) => {
              const sc = STATUS_CONFIG[issue.status as keyof typeof STATUS_CONFIG];
              const pc = PRIORITY_CONFIG[issue.priority as keyof typeof PRIORITY_CONFIG];
              return (
                <tr key={issue.id}>
                  <td style={{ color: "#9ca3af" }}>{idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{issue.title}</div>
                    {issue.description && <div className="desc">{issue.description.slice(0, 80)}{issue.description.length > 80 ? "…" : ""}</div>}
                  </td>
                  <td>
                    {sc && (
                      <span className="badge" style={{ background: sc.bg?.replace("bg-", "") || "#f3f4f6", color: sc.color }}>
                        {sc.label}
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ color: pc?.color, fontWeight: 600, fontSize: 11 }}>{pc?.label ?? issue.priority}</span>
                  </td>
                  <td className="points">{issue.points}pt</td>
                  <td style={{ fontSize: 11, color: "#374151" }}>{(issue.assignee as { name?: string } | null)?.name ?? "-"}</td>
                  <td style={{ fontSize: 11, color: "#374151" }}>{(issue.reviewer as { name?: string } | null)?.name ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="print-footer">
        <span>ARC — 가족 스프린트 매니저</span>
        <span>출력일: {new Date().toLocaleDateString("ko")}</span>
      </div>
    </>
  );
}
