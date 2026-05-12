import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/projects/[projectId]/sprints/[sprintId]/complete">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { projectId, sprintId } = await ctx.params;

  const member = await prisma.familyMember.findFirst({
    where: { userId: user.id, family: { projects: { some: { id: projectId } } } },
  });
  if (!member || member.role !== "MASTER") return Response.json({ error: "마스터만 스프린트를 완료할 수 있습니다" }, { status: 403 });

  // 과제는 스프린트에 그대로 유지 (이력 보존)
  // 진행 중이던 과제는 HOLD 처리
  await prisma.issue.updateMany({
    where: { sprintId, status: "IN_PROGRESS" },
    data: { status: "HOLD" },
  });

  const sprint = await prisma.sprint.update({
    where: { id: sprintId },
    data: { status: "COMPLETED", endDate: new Date() },
  });
  return Response.json({ data: sprint });
}
