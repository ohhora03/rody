import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import type { Priority, RepeatType, TaskStatus } from "@prisma/client";

function calcNextDue(current: Date | null, repeat: RepeatType): Date {
  const base = current ? new Date(current) : new Date();
  const next = new Date(base);
  if (repeat === "DAILY") next.setDate(next.getDate() + 1);
  else if (repeat === "WEEKLY") next.setDate(next.getDate() + 7);
  return next;
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/my-tasks/[id]">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { id } = await ctx.params;

  let body: {
    title?: string;
    memo?: string | null;
    priority?: Priority;
    dueDate?: string | null;
    repeat?: RepeatType;
    status?: TaskStatus;
    assigneeId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  try {
    const task = await prisma.myTask.findUnique({
      where: { id },
      include: { owner: { select: { id: true, name: true } } },
    });
    if (!task) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const isOwner = task.ownerId === user.id;
    const isAssignee = task.assigneeId === user.id;
    if (!isOwner && !isAssignee) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // assignee만 가능한 변경은 status뿐. owner는 모두 가능.
    // assigneeId 변경은 owner만 가능.
    const assigneeChanging =
      body.assigneeId !== undefined && body.assigneeId !== task.assigneeId;
    if (assigneeChanging && !isOwner) {
      return Response.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const willCompleteRepeat =
      body.status === "DONE" &&
      task.status !== "DONE" &&
      task.repeat !== "NONE";

    const updated = await prisma.myTask.update({
      where: { id },
      data: {
        ...(isOwner && body.title !== undefined && { title: body.title }),
        ...(isOwner && body.memo !== undefined && { memo: body.memo }),
        ...(isOwner && body.priority !== undefined && { priority: body.priority }),
        ...(isOwner && body.repeat !== undefined && { repeat: body.repeat }),
        ...(body.status !== undefined && { status: body.status }),
        ...(isOwner && body.dueDate !== undefined && {
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
        }),
        ...(isOwner && body.assigneeId !== undefined && {
          assigneeId: body.assigneeId || null,
        }),
      },
      include: {
        assignee: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    if (willCompleteRepeat) {
      const nextDue = calcNextDue(task.dueDate, task.repeat);
      await prisma.myTask.create({
        data: {
          title: task.title,
          memo: task.memo,
          priority: task.priority,
          repeat: task.repeat,
          dueDate: nextDue,
          ownerId: task.ownerId,
          assigneeId: task.assigneeId,
        },
      });
    }

    // assigneeId 변경 시 새 assignee에게 푸시 (본인이 아닐 때만)
    if (
      assigneeChanging &&
      body.assigneeId &&
      body.assigneeId !== user.id
    ) {
      const ownerName = task.owner?.name ?? "가족";
      await sendPushToUser(body.assigneeId, {
        title: "새 할 일이 추가됐어요 ✅",
        body: `${ownerName}님이 '${task.title}'을 할당했어요`,
        url: "/m/my-tasks",
      });
    }

    return Response.json({ data: updated });
  } catch {
    return Response.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/my-tasks/[id]">
) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const task = await prisma.myTask.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!task || task.ownerId !== user.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.myTask.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "서버 오류" }, { status: 500 });
  }
}
