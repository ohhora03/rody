import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { fetchMobileHomeData } from "@/lib/mobile-home";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const data = await fetchMobileHomeData(user.id);

  return Response.json({ data }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
