import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import type { Priority } from "@/types";

// 목록용: 표시에 필요한 필드만 (comments 제외 → 쿼리 대폭 경량화)
const INCLUDE = {
  assignee: true,
  reviewer: true,
  creator: true,
  sprint: { select: { id: true, name: true, status: true } },
};

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const sprintId = searchParams.get("sprintId");
  const assigneeId = searchParams.get("assigneeId");
  const backlogOnly = searchParams.get("backlogOnly") === "true";

  if (!projectId) return Response.json({ error: "projectId가 필요합니다" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { familyId: true } });
  if (!project) return Response.json({ error: "프로젝트를 찾을 수 없습니다" }, { status: 404 });

  const member = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: project.familyId } },
  });
  if (!member) return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });

  const issues = await prisma.issue.findMany({
    where: {
      projectId,
      ...(sprintId ? { sprintId } : {}),
      ...(backlogOnly ? { sprintId: null } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    },
    include: INCLUDE,
    orderBy: { order: "asc" },
  });

  return Response.json({ data: issues });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const body = await req.json();
  const { title, projectId, sprintId, assigneeId, reviewerId, priority, points, description } = body;

  if (!title?.trim() || !projectId) return Response.json({ error: "title과 projectId는 필수입니다" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { familyId: true } });
  if (!project) return Response.json({ error: "프로젝트를 찾을 수 없습니다" }, { status: 404 });

  const member = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: project.familyId } },
  });
  if (!member) return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });

  const last = await prisma.issue.findFirst({
    where: { projectId, sprintId: sprintId ?? null },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const issue = await prisma.issue.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      projectId,
      sprintId: sprintId || null,
      status: "READY",
      priority: (priority as Priority) || "MEDIUM",
      points: points != null ? Number(points) : 1,
      order: (last?.order ?? -1) + 1,
      assigneeId: assigneeId || null,
      reviewerId: reviewerId || null,
      creatorId: user.id,
    },
    include: INCLUDE,
  });

  return Response.json({ data: issue }, { status: 201 });
}
