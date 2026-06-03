import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { getIssueMembership } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import type { IssueStatus, Priority } from "@/types";

const INCLUDE = {
  assignee: true,
  reviewer: true,
  creator: true,
  sprint: true,
  comments: { include: { author: true }, orderBy: { createdAt: "asc" as const } },
};

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[issueId]">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { issueId } = await ctx.params;
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, include: INCLUDE });
  if (!issue) return Response.json({ error: "과제를 찾을 수 없습니다" }, { status: 404 });

  return Response.json({ data: issue });
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[issueId]">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { issueId } = await ctx.params;
  const body = await req.json();

  // 권한 검증(issue → project → family 멤버) + 상태 변경 시 현재 status 조회를 병렬화
  const isStatusChange = body.status !== undefined;
  const [member, current] = await Promise.all([
    getIssueMembership(user.id, issueId),
    isStatusChange
      ? prisma.issue.findUnique({ where: { id: issueId }, select: { status: true } })
      : Promise.resolve(null),
  ]);
  if (!member) return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });

  const data = {
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.status !== undefined && { status: body.status as IssueStatus }),
    ...(body.priority !== undefined && { priority: body.priority as Priority }),
    ...(body.points !== undefined && { points: Number(body.points) }),
    ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId }),
    ...(body.reviewerId !== undefined && { reviewerId: body.reviewerId }),
    ...(body.sprintId !== undefined && { sprintId: body.sprintId }),
    ...(body.order !== undefined && { order: body.order }),
    ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
  };

  // 상태 변경 시 히스토리 로그 + update를 단일 트랜잭션으로 묶음
  let issue;
  if (isStatusChange && current && current.status !== body.status) {
    [, issue] = await prisma.$transaction([
      prisma.comment.create({
        data: {
          content: `상태를 변경했습니다`,
          type: "STATUS_CHANGE",
          fromStatus: current.status,
          toStatus: body.status,
          issueId,
          authorId: user.id,
        },
      }),
      prisma.issue.update({ where: { id: issueId }, data, include: INCLUDE }),
    ]);
  } else {
    issue = await prisma.issue.update({ where: { id: issueId }, data, include: INCLUDE });
  }

  return Response.json({ data: issue });
}

export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[issueId]">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { issueId } = await ctx.params;

  // 권한 검증: 멤버가 아니면 삭제 불가(이전엔 검증 누락 → 임의 issueId 삭제 가능)
  const member = await getIssueMembership(user.id, issueId);
  if (!member) return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });

  await prisma.issue.delete({ where: { id: issueId } });
  return Response.json({ data: { deleted: true } });
}
