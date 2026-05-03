import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { inviteCode, nickname } = await req.json();
  if (!inviteCode?.trim() || !nickname?.trim())
    return Response.json({ error: "초대 코드와 호칭을 입력해주세요" }, { status: 400 });

  const family = await prisma.family.findUnique({ where: { inviteCode: inviteCode.trim() } });
  if (!family) return Response.json({ error: "유효하지 않은 초대 코드입니다" }, { status: 404 });

  const memberCount = await prisma.familyMember.count({ where: { familyId: family.id } });
  if (memberCount >= 6) return Response.json({ error: "가족 구성원은 최대 6명입니다" }, { status: 400 });

  const existing = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId: session.user.id, familyId: family.id } },
  });
  if (existing) return Response.json({ error: "이미 이 가족에 속해 있습니다" }, { status: 400 });

  const member = await prisma.familyMember.create({
    data: { userId: session.user.id, familyId: family.id, nickname: nickname.trim() },
    include: { family: true },
  });

  return Response.json({ data: member }, { status: 201 });
}
