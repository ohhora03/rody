import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { IssueStatus, Priority } from "@/types";

const INCLUDE = {
  assignee: true,
  reviewer: true,
  creator: true,
  sprint: true,
  comments: { include: { author: true }, orderBy: { createdAt: "asc" as const } },
};

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[issueId]">
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { issueId } = await ctx.params;
  const body = await req.json();

  // 상태 변경이면 히스토리 로그 생성
  if (body.status !== undefined) {
    const current = await prisma.issue.findUnique({ where: { id: issueId }, select: { status: true } });
    if (current && current.status !== body.status) {
      await prisma.comment.create({
        data: {
          content: `상태를 변경했습니다`,
          type: "STATUS_CHANGE",
          fromStatus: current.status,
          toStatus: body.status,
          issueId,
          authorId: session.user.id,
        },
      });
    }
  }

  const issue = await prisma.issue.update({
    where: { id: issueId },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status as IssueStatus }),
      ...(body.priority !== undefined && { priority: body.priority as Priority }),
      ...(body.points !== undefined && { points: body.points }),
      ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId }),
      ...(body.reviewerId !== undefined && { reviewerId: body.reviewerId }),
      ...(body.sprintId !== undefined && { sprintId: body.sprintId }),
      ...(body.order !== undefined && { order: body.order }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
    },
    include: INCLUDE,
  });

  return Response.json({ data: issue });
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/issues/[issueId]">
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { issueId } = await ctx.params;
  await prisma.issue.delete({ where: { id: issueId } });
  return Response.json({ data: { deleted: true } });
}
