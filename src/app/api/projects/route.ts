import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const familyId = req.nextUrl.searchParams.get("familyId");
  if (!familyId) return Response.json({ error: "familyId가 필요합니다" }, { status: 400 });

  const isMember = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId: session.user.id, familyId } },
  });
  if (!isMember) return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });

  const projects = await prisma.project.findMany({
    where: { familyId },
    include: { sprints: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ data: projects });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { name, description, key, familyId } = await req.json();
  if (!name?.trim() || !key?.trim() || !familyId)
    return Response.json({ error: "name, key, familyId는 필수입니다" }, { status: 400 });

  const member = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId: session.user.id, familyId } },
  });
  if (!member) return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });
  if (member.role !== "MASTER") return Response.json({ error: "마스터만 프로젝트를 생성할 수 있습니다" }, { status: 403 });

  const project = await prisma.project.create({
    data: { name: name.trim(), description: description?.trim(), key: key.trim().toUpperCase(), familyId },
  });

  return Response.json({ data: project }, { status: 201 });
}
