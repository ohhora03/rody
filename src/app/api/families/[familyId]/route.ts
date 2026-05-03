import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/families/[familyId]">
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { familyId } = await ctx.params;

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: { members: { include: { user: true } } },
  });
  if (!family) return Response.json({ error: "가족을 찾을 수 없습니다" }, { status: 404 });

  const isMember = family.members.some((m) => m.userId === session.user.id);
  if (!isMember) return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });

  return Response.json({ data: family });
}
