import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { MEMBER_COLORS } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const { accessToken } = await req.json();
  if (!accessToken) return Response.json({ error: "accessToken이 필요합니다" }, { status: 400 });

  // Google API로 사용자 정보 조회
  const googleRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!googleRes.ok) return Response.json({ error: "유효하지 않은 Google 토큰입니다" }, { status: 401 });

  const { email, name, picture } = await googleRes.json();
  if (!email) return Response.json({ error: "이메일을 가져올 수 없습니다" }, { status: 400 });

  const colorIdx = Math.floor(Math.random() * MEMBER_COLORS.length);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: name ?? undefined, image: picture ?? undefined },
    create: {
      email,
      name: name ?? "사용자",
      image: picture ?? null,
      color: MEMBER_COLORS[colorIdx],
    },
  });

  const token = await encode({
    token: { id: user.id, email: user.email, name: user.name },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: 30 * 24 * 60 * 60,
  });

  return Response.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, color: user.color, image: user.image },
  });
}
