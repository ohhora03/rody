import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import type { Priority, RepeatType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  try {
    const tasks = await prisma.myTask.findMany({
      where: {
        OR: [
          // 본인이 만든 할일 중 assignee가 없거나 본인인 것
          { ownerId: user.id, assigneeId: null },
          { ownerId: user.id, assigneeId: user.id },
          // 다른 사람이 나에게 부여한 할일 (수락 대기 + 수락됨)
          { assigneeId: user.id, acceptStatus: { in: ["PENDING", "ACCEPTED"] } },
        ],
      },
      include: {
        assignee: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });
    return Response.json({ data: tasks });
  } catch {
    return Response.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  let body: {
    title?: string;
    memo?: string | null;
    priority?: Priority;
    dueDate?: string | null;
    repeat?: RepeatType;
    assigneeId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) return Response.json({ error: "title은 필수입니다" }, { status: 400 });

  try {
    const acceptStatus =
      body.assigneeId && body.assigneeId !== user.id ? "PENDING" : "ACCEPTED";

    const task = await prisma.myTask.create({
      data: {
        title,
        memo: body.memo?.trim() || null,
        priority: body.priority ?? "MEDIUM",
        repeat: body.repeat ?? "NONE",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        ownerId: user.id,
        assigneeId: body.assigneeId || undefined,
        acceptStatus,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    // 다른 사람에게 할당된 경우 푸시 알림 발송 (실패 무시)
    if (body.assigneeId && body.assigneeId !== user.id) {
      const ownerName = task.owner?.name ?? "가족";
      await sendPushToUser(body.assigneeId, {
        title: "새 할 일이 추가됐어요 ✅",
        body: `${ownerName}님이 '${title}'을 할당했어요`,
        url: "/m/my-tasks",
      });
    }

    return Response.json({ data: task }, { status: 201 });
  } catch {
    return Response.json({ error: "서버 오류" }, { status: 500 });
  }
}
