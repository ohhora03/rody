import { prisma } from "./prisma";

// 모바일 홈 데이터를 DB에서 직접 조회
// API route와 서버 컴포넌트 양쪽에서 공유
export async function fetchMobileHomeData(userId: string) {
  const memberships = await prisma.familyMember.findMany({
    where: { userId },
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
    return { families: [], project: null, activeSprint: null, issues: [], backlogIssues: [] };
  }

  const family = memberships[0].family;
  const project = family.projects[0] ?? null;
  const activeSprint = project?.sprints.find((s) => s.status === "ACTIVE") ?? null;

  const [issues, backlogIssues] = project
    ? await Promise.all([
        activeSprint
          ? prisma.issue.findMany({
              where: { projectId: project.id, sprintId: activeSprint.id },
              include: { assignee: true, creator: true },
              orderBy: { order: "asc" },
            })
          : Promise.resolve([]),
        prisma.issue.findMany({
          where: { projectId: project.id, sprintId: null },
          include: { assignee: true },
          orderBy: { order: "asc" },
        }),
      ])
    : [[], []];

  return {
    families: memberships.map((m) => m.family),
    project,
    activeSprint,
    issues,
    backlogIssues,
  };
}
