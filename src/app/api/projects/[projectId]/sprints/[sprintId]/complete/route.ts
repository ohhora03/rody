import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";

type FailedAction = "next-sprint" | "backlog" | null | undefined;

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
  if (!member || member.role !== "MASTER") {
    return Response.json({ error: "마스터만 스프린트를 완료할 수 있습니다" }, { status: 403 });
  }

  // 요청 body 파싱 (없을 수도 있음)
  let failedAction: FailedAction = null;
  let targetSprintId: string | undefined;
  try {
    const body = await req.json();
    failedAction = body?.failedAction ?? null;
    targetSprintId = body?.targetSprintId;
  } catch {
    // body 없음 — failedAction null 로 진행
  }

  // 미완료(=완료/거부되지 않은) 이슈를 FAILED 후보로 본다
  const incomplete = await prisma.issue.findMany({
    where: {
      sprintId,
      status: { notIn: ["RESOLVED", "CLOSED"] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      points: true,
      assigneeId: true,
    },
  });

  // failedAction이 없으면: 미완료 목록 반환 + 스프린트는 완료 처리(기존 동작 유지)
  if (!failedAction) {
    // 진행 중이던 과제는 HOLD 처리 (기존 동작 유지)
    await prisma.issue.updateMany({
      where: { sprintId, status: "IN_PROGRESS" },
      data: { status: "HOLD" },
    });
    const sprint = await prisma.sprint.update({
      where: { id: sprintId },
      data: { status: "COMPLETED", endDate: new Date() },
    });
    return Response.json({ data: sprint, failedIssues: incomplete });
  }

  // failedAction == "next-sprint": targetSprintId 검증 후 이관
  if (failedAction === "next-sprint") {
    if (!targetSprintId) {
      return Response.json({ error: "이관할 대상 스프린트를 선택해주세요" }, { status: 400 });
    }
    const target = await prisma.sprint.findFirst({
      where: { id: targetSprintId, projectId },
    });
    if (!target) {
      return Response.json({ error: "대상 스프린트를 찾을 수 없습니다" }, { status: 404 });
    }

    const incompleteIds = incomplete.map((i) => i.id);
    const [, , sprint] = await prisma.$transaction([
      prisma.issue.updateMany({
        where: { id: { in: incompleteIds } },
        data: { sprintId: targetSprintId, status: "READY" },
      }),
      prisma.issue.updateMany({
        where: { sprintId, status: "IN_PROGRESS" },
        data: { status: "HOLD" },
      }),
      prisma.sprint.update({
        where: { id: sprintId },
        data: { status: "COMPLETED", endDate: new Date() },
      }),
    ]);
    return Response.json({ data: sprint, failedIssues: incomplete });
  }

  // failedAction == "backlog": 미완료 과제 sprintId → null
  if (failedAction === "backlog") {
    const incompleteIds = incomplete.map((i) => i.id);
    const [, sprint] = await prisma.$transaction([
      prisma.issue.updateMany({
        where: { id: { in: incompleteIds } },
        data: { sprintId: null, status: "READY" },
      }),
      prisma.sprint.update({
        where: { id: sprintId },
        data: { status: "COMPLETED", endDate: new Date() },
      }),
    ]);
    return Response.json({ data: sprint, failedIssues: incomplete });
  }

  return Response.json({ error: "지원하지 않는 failedAction 값입니다" }, { status: 400 });
}
