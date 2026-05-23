import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
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
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  try {
    const task = await prisma.myTask.findUnique({ where: { id } });
    if (!task || task.ownerId !== user.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const willCompleteRepeat =
      body.status === "DONE" &&
      task.status !== "DONE" &&
      task.repeat !== "NONE";

    const updated = await prisma.myTask.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.memo !== undefined && { memo: body.memo }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.repeat !== undefined && { repeat: body.repeat }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.dueDate !== undefined && {
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
        }),
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
          ownerId: user.id,
        },
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
