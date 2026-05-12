import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/projects/[projectId]/sprints/[sprintId]">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { sprintId } = await ctx.params;

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      issues: {
        include: { assignee: true, reviewer: true },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!sprint) return Response.json({ error: "스프린트를 찾을 수 없습니다" }, { status: 404 });

  return Response.json({ data: sprint });
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/projects/[projectId]/sprints/[sprintId]">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { projectId, sprintId } = await ctx.params;

  const member = await prisma.familyMember.findFirst({
    where: { userId: user.id, family: { projects: { some: { id: projectId } } } },
  });
  if (!member || member.role !== "MASTER") return Response.json({ error: "마스터만 수정할 수 있습니다" }, { status: 403 });

  const body = await req.json();
  const sprint = await prisma.sprint.update({
    where: { id: sprintId },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.goal !== undefined && { goal: body.goal }),
      ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
    },
  });
  return Response.json({ data: sprint });
}
