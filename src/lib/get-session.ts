import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import type { NextRequest } from "next/server";

/**
 * API 라우트에서 현재 사용자 ID를 반환.
 * getToken()을 사용해 JWT를 직접 디코딩 → DB 조회 없음.
 * (기존 getServerSession은 session callback을 호출하여 매 요청마다 DB를 조회했음)
 */
export async function getSessionUser(req?: NextRequest): Promise<{ id: string } | null> {
  // API Route: req 객체에서 JWT 직접 디코딩 (DB 조회 없음)
  if (req) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! });
    if (token?.id) return { id: token.id as string };

    // Bearer 토큰 (모바일 앱용)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      try {
        const { decode } = await import("next-auth/jwt");
        const decoded = await decode({
          token: authHeader.slice(7),
          secret: process.env.NEXTAUTH_SECRET!,
        });
        if (decoded?.id) return { id: decoded.id as string };
      } catch {}
    }
    return null;
  }

  // Server Component용 fallback (req 없을 때만)
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return { id: session.user.id };
  return null;
}
