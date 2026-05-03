import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/projects/[projectId]/sprints/[sprintId]/start">
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { projectId, sprintId } = await ctx.params;

  const member = await prisma.familyMember.findFirst({
    where: { userId: session.user.id, family: { projects: { some: { id: projectId } } } },
  });
  if (!member || member.role !== "MASTER") return Response.json({ error: "마스터만 스프린트를 시작할 수 있습니다" }, { status: 403 });

  const active = await prisma.sprint.findFirst({ where: { projectId, status: "ACTIVE" } });
  if (active) return Response.json({ error: "이미 진행 중인 스프린트가 있습니다" }, { status: 400 });

  const sprint = await prisma.sprint.update({
    where: { id: sprintId },
    data: { status: "ACTIVE", startDate: new Date() },
  });
  return Response.json({ data: sprint });
}
