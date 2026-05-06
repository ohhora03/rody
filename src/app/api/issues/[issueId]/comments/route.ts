import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[issueId]/comments">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { issueId } = await ctx.params;
  const { content } = await req.json();
  if (!content?.trim()) return Response.json({ error: "댓글 내용을 입력해주세요" }, { status: 400 });

  const comment = await prisma.comment.create({
    data: {
      content: content.trim(),
      type: "COMMENT",
      issueId,
      authorId: user.id,
    },
    include: { author: true },
  });
  return Response.json({ data: comment }, { status: 201 });
}
