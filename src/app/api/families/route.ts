import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MEMBER_COLORS } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { name, nickname } = await req.json();
  if (!name?.trim() || !nickname?.trim())
    return Response.json({ error: "가족 이름과 호칭을 입력해주세요" }, { status: 400 });

  const existingMember = await prisma.familyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (existingMember) return Response.json({ error: "이미 가족에 속해 있습니다" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const colorIdx = MEMBER_COLORS.indexOf(user?.color ?? MEMBER_COLORS[0]);

  const family = await prisma.family.create({
    data: {
      name: name.trim(),
      members: {
        create: {
          userId: session.user.id,
          role: "MASTER",
          nickname: nickname.trim(),
        },
      },
    },
    include: { members: { include: { user: true } } },
  });

  return Response.json({ data: { familyId: family.id, family } }, { status: 201 });
}
