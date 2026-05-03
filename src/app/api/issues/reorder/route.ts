import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { IssueStatus } from "@/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { issueId, status, order } = await req.json();

  const current = await prisma.issue.findUnique({ where: { id: issueId }, select: { status: true } });
  if (current && current.status !== status) {
    await prisma.comment.create({
      data: {
        content: "상태를 변경했습니다",
        type: "STATUS_CHANGE",
        fromStatus: current.status,
        toStatus: status,
        issueId,
        authorId: session.user.id,
      },
    });
  }

  const issue = await prisma.issue.update({
    where: { id: issueId },
    data: { status: status as IssueStatus, order },
  });

  return Response.json({ data: issue });
}
