import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { getProjectMembership } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/projects/[projectId]/sprints/[sprintId]/transfer">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { projectId, sprintId } = await ctx.params;

  // 프로젝트 멤버십 체크 (project + familyMember 직렬 2 RTT를 단일 쿼리로 통합)
  const member = await getProjectMembership(user.id, projectId);
  if (!member) return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });

  let body: { issueId?: string; mode?: "transfer" | "copy"; targetSprintId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const { issueId, mode, targetSprintId } = body;
  if (!issueId) return Response.json({ error: "issueId가 필요합니다" }, { status: 400 });
  if (mode !== "transfer" && mode !== "copy") {
    return Response.json({ error: "mode는 transfer 또는 copy여야 합니다" }, { status: 400 });
  }
  if (!targetSprintId) return Response.json({ error: "targetSprintId가 필요합니다" }, { status: 400 });

  // 이슈 검증 — 동일 프로젝트 + 현 sprintId 일치
  const issue = await prisma.issue.findFirst({
    where: { id: issueId, projectId, sprintId },
  });
  if (!issue) return Response.json({ error: "이슈를 찾을 수 없습니다" }, { status: 404 });

  // 대상 스프린트 검증 — 동일 프로젝트
  const target = await prisma.sprint.findFirst({
    where: { id: targetSprintId, projectId },
  });
  if (!target) return Response.json({ error: "대상 스프린트를 찾을 수 없습니다" }, { status: 404 });

  if (mode === "transfer") {
    const updated = await prisma.issue.update({
      where: { id: issueId },
      data: { sprintId: targetSprintId, status: "READY" },
    });
    return Response.json({ data: updated });
  }

  // copy
  const created = await prisma.issue.create({
    data: {
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      points: issue.points,
      projectId: issue.projectId,
      assigneeId: issue.assigneeId,
      reviewerId: issue.reviewerId,
      sprintId: targetSprintId,
      status: "READY",
      order: 9999,
      creatorId: user.id,
    },
  });
  return Response.json({ data: created }, { status: 201 });
}
