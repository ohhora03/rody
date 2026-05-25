import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/families/[familyId]">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { familyId } = await ctx.params;

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: { members: { include: { user: true } } },
  });
  if (!family) return Response.json({ error: "가족을 찾을 수 없습니다" }, { status: 404 });

  const isMember = family.members.some((m) => m.userId === user.id);
  if (!isMember) return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });

  return Response.json({ data: family });
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/families/[familyId]">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { familyId } = await ctx.params;

  const member = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId: user.id, familyId } },
  });
  if (!member) return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });
  if (member.role !== "MASTER") {
    return Response.json({ error: "마스터만 가족 이름을 변경할 수 있습니다" }, { status: 403 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const name = body?.name?.trim();
  if (!name) return Response.json({ error: "가족 이름을 입력해주세요" }, { status: 400 });
  if (name.length > 30) {
    return Response.json({ error: "가족 이름은 30자 이하여야 합니다" }, { status: 400 });
  }

  const family = await prisma.family.update({
    where: { id: familyId },
    data: { name },
  });
  return Response.json({ data: family });
}
