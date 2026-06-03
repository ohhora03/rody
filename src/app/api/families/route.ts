import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { MEMBER_COLORS } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  // members.user 전 컬럼(include:true) 대신 표시에 필요한 필드만 select (페이로드 경량화)
  const memberships = await prisma.familyMember.findMany({
    where: { userId: user.id },
    include: {
      family: {
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, color: true, email: true, image: true } },
            },
          },
        },
      },
    },
  });

  const families = memberships.map((m) => m.family);
  return Response.json({ data: families });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { name, nickname } = await req.json();
  if (!name?.trim() || !nickname?.trim())
    return Response.json({ error: "가족 이름과 호칭을 입력해주세요" }, { status: 400 });

  const existingMember = await prisma.familyMember.findFirst({
    where: { userId: user.id },
  });
  if (existingMember) return Response.json({ error: "이미 가족에 속해 있습니다" }, { status: 400 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const colorIdx = MEMBER_COLORS.indexOf(dbUser?.color ?? MEMBER_COLORS[0]);

  const family = await prisma.family.create({
    data: {
      name: name.trim(),
      members: {
        create: {
          userId: user.id,
          role: "MASTER",
          nickname: nickname.trim(),
        },
      },
    },
    include: { members: { include: { user: true } } },
  });

  return Response.json({ data: { familyId: family.id, family } }, { status: 201 });
}
