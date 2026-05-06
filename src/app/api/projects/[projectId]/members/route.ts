import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/projects/[projectId]/members">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { projectId } = await ctx.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      familyId: true,
      family: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, color: true, email: true } } },
          },
        },
      },
    },
  });
  if (!project) return Response.json({ error: "프로젝트를 찾을 수 없습니다" }, { status: 404 });

  const isMember = project.family.members.some((m) => m.userId === user.id);
  if (!isMember) return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });

  const members = project.family.members.map((m) => ({
    id: m.user.id,
    name: m.nickname || m.user.name,
    color: m.user.color,
    email: m.user.email,
    role: m.role,
  }));

  return Response.json({ data: members });
}
