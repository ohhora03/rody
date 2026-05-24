import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// 모바일 홈 데이터의 select 정의 (필요한 컬럼만 가져와 페이로드 최소화)
const familyMemberUserSelect = {
  id: true,
  name: true,
  email: true,
  color: true,
} satisfies Prisma.UserSelect;

const familySelect = {
  id: true,
  name: true,
  inviteCode: true,
  createdAt: true,
  updatedAt: true,
  members: {
    select: {
      id: true,
      role: true,
      nickname: true,
      userId: true,
      familyId: true,
      joinedAt: true,
      user: { select: familyMemberUserSelect },
    },
  },
  projects: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      key: true,
      familyId: true,
      createdAt: true,
      updatedAt: true,
      sprints: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          goal: true,
          status: true,
          startDate: true,
          endDate: true,
          projectId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
} satisfies Prisma.FamilySelect;

export type MobileHomeFamily = Prisma.FamilyGetPayload<{ select: typeof familySelect }>;
export type MobileHomeProject = MobileHomeFamily["projects"][number];
export type MobileHomeSprint = MobileHomeProject["sprints"][number];

// 모바일 홈 데이터를 DB에서 직접 조회
// API route와 서버 컴포넌트 양쪽에서 공유
export async function fetchMobileHomeData(userId: string) {
  // 1단계: 사용자의 familyId 목록만 조회 (가벼움)
  const memberships = await prisma.familyMember.findMany({
    where: { userId },
    select: { familyId: true },
    orderBy: { joinedAt: "asc" },
  });

  if (!memberships.length) {
    return {
      families: [] as MobileHomeFamily[],
      project: null as MobileHomeProject | null,
      activeSprint: null as MobileHomeSprint | null,
      issues: [] as Awaited<ReturnType<typeof fetchActiveSprintIssues>>,
      backlogIssues: [] as Awaited<ReturnType<typeof fetchBacklogIssues>>,
    };
  }

  const familyIds = memberships.map((m) => m.familyId);

  // 2단계: families를 병렬로 조회 (각 family의 members/projects/sprints 포함)
  const families = await prisma.family.findMany({
    where: { id: { in: familyIds } },
    select: familySelect,
  });

  // memberships 순서를 유지하기 위해 familyId 순으로 정렬
  const familyById = new Map(families.map((f) => [f.id, f]));
  const orderedFamilies = familyIds
    .map((id) => familyById.get(id))
    .filter((f): f is MobileHomeFamily => Boolean(f));

  const primaryFamily = orderedFamilies[0] ?? null;
  const project = primaryFamily?.projects[0] ?? null;
  const activeSprint = project?.sprints.find((s) => s.status === "ACTIVE") ?? null;

  // 3단계: 이슈/백로그 병렬 조회 (activeSprint 확정 후)
  const [issues, backlogIssues] = project
    ? await Promise.all([
        activeSprint
          ? fetchActiveSprintIssues(project.id, activeSprint.id)
          : Promise.resolve([] as Awaited<ReturnType<typeof fetchActiveSprintIssues>>),
        fetchBacklogIssues(project.id),
      ])
    : [
        [] as Awaited<ReturnType<typeof fetchActiveSprintIssues>>,
        [] as Awaited<ReturnType<typeof fetchBacklogIssues>>,
      ];

  return {
    families: orderedFamilies,
    project,
    activeSprint,
    issues,
    backlogIssues,
  };
}

function fetchActiveSprintIssues(projectId: string, sprintId: string) {
  return prisma.issue.findMany({
    where: { projectId, sprintId },
    orderBy: { order: "asc" },
    include: {
      assignee: { select: { id: true, name: true, email: true, color: true } },
      creator: { select: { id: true, name: true, email: true, color: true } },
    },
  });
}

function fetchBacklogIssues(projectId: string) {
  return prisma.issue.findMany({
    where: { projectId, sprintId: null },
    orderBy: { order: "asc" },
    include: {
      assignee: { select: { id: true, name: true, email: true, color: true } },
    },
  });
}
