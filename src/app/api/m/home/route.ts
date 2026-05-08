import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";

// 모바일 홈 화면에 필요한 모든 데이터를 한 번에 반환
// families → projects → activeSprint → issues 를 1번 요청으로 해결
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  // 가족, 멤버, 프로젝트, 스프린트 병렬 조회
  const memberships = await prisma.familyMember.findMany({
    where: { userId: user.id },
    include: {
      family: {
        include: {
          members: { include: { user: true } },
          projects: {
            include: {
              sprints: { orderBy: { createdAt: "desc" } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!memberships.length) {
    return Response.json({ data: { families: [], projects: [], activeSprint: null, issues: [] } });
  }

  const family = memberships[0].family;
  const project = family.projects[0] ?? null;
  const activeSprint = project?.sprints.find((s) => s.status === "ACTIVE") ?? null;

  // 이슈는 활성 스프린트가 있을 때만 조회
  const issues = activeSprint
    ? await prisma.issue.findMany({
        where: { projectId: project!.id, sprintId: activeSprint.id },
        include: { assignee: true, creator: true },
        orderBy: { order: "asc" },
      })
    : [];

  return Response.json(
    {
      data: {
        families: memberships.map((m) => m.family),
        project,
        activeSprint,
        issues,
      },
    },
    {
      headers: {
        "Cache-Control": "private, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
