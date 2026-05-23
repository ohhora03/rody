import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import type { Priority, RepeatType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  try {
    const tasks = await prisma.myTask.findMany({
      where: { ownerId: user.id },
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
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) return Response.json({ error: "title은 필수입니다" }, { status: 400 });

  try {
    const task = await prisma.myTask.create({
      data: {
        title,
        memo: body.memo?.trim() || null,
        priority: body.priority ?? "MEDIUM",
        repeat: body.repeat ?? "NONE",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        ownerId: user.id,
      },
    });
    return Response.json({ data: task }, { status: 201 });
  } catch {
    return Response.json({ error: "서버 오류" }, { status: 500 });
  }
}
