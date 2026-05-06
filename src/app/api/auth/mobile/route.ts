import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { MEMBER_COLORS } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const { email, name } = await req.json();
  if (!email?.trim()) return Response.json({ error: "이메일이 필요합니다" }, { status: 400 });

  const colorIdx = Math.floor(Math.random() * MEMBER_COLORS.length);
  const user = await prisma.user.upsert({
    where: { email: email.trim() },
    update: {},
    create: {
      email: email.trim(),
      name: name?.trim() || "사용자",
      color: MEMBER_COLORS[colorIdx],
    },
  });

  const token = await encode({
    token: { id: user.id, email: user.email, name: user.name },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: 30 * 24 * 60 * 60, // 30일
  });

  return Response.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, color: user.color },
  });
}
