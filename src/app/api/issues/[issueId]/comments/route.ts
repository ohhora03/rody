import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[issueId]/comments">
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { issueId } = await ctx.params;
  const { content } = await req.json();
  if (!content?.trim()) return Response.json({ error: "댓글 내용을 입력해주세요" }, { status: 400 });

  const comment = await prisma.comment.create({
    data: {
      content: content.trim(),
      type: "COMMENT",
      issueId,
      authorId: session.user.id,
    },
    include: { author: true },
  });
  return Response.json({ data: comment }, { status: 201 });
}
