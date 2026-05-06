import { getServerSession } from "next-auth";
import { decode } from "next-auth/jwt";
import { authOptions } from "./auth";
import type { NextRequest } from "next/server";

export async function getSessionUser(req?: NextRequest): Promise<{ id: string } | null> {
  // 1) 쿠키 세션 확인 (웹)
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return { id: session.user.id };

  // 2) Bearer 토큰 확인 (모바일)
  const authHeader = req?.headers.get("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const token = await decode({
        token: authHeader.slice(7),
        secret: process.env.NEXTAUTH_SECRET!,
      });
      if (token?.id) return { id: token.id as string };
    } catch {}
  }

  return null;
}
