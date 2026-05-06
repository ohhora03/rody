import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";

async function getMemberAndProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "프로젝트를 찾을 수 없습니다", status: 404 };
  const member = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId, familyId: project.familyId } },
  });
  if (!member) return { error: "접근 권한이 없습니다", status: 403 };
  return { project, member };
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/projects/[projectId]/sprints">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { projectId } = await ctx.params;
  const result = await getMemberAndProject(user.id, projectId);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });

  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ data: sprints });
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/projects/[projectId]/sprints">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { projectId } = await ctx.params;
  const result = await getMemberAndProject(user.id, projectId);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  if (result.member.role !== "MASTER") return Response.json({ error: "마스터만 스프린트를 생성할 수 있습니다" }, { status: 403 });

  const { name, goal, startDate, endDate } = await req.json();
  if (!name?.trim()) return Response.json({ error: "스프린트 이름을 입력해주세요" }, { status: 400 });

  const sprint = await prisma.sprint.create({
    data: {
      name: name.trim(),
      goal: goal?.trim() || null,
      projectId,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
  });
  return Response.json({ data: sprint }, { status: 201 });
}
