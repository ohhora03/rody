import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  let body: {
    endpoint?: string;
    p256dh?: string;
    auth?: string;
    reminderHour?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const { endpoint, p256dh, auth, reminderHour } = body;
  if (!endpoint || !p256dh || !auth) {
    return Response.json(
      { error: "endpoint, p256dh, auth는 필수입니다" },
      { status: 400 }
    );
  }

  try {
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh,
        auth,
        enabled: true,
        ...(reminderHour !== undefined && { reminderHour }),
        userId: user.id,
      },
      create: {
        endpoint,
        p256dh,
        auth,
        userId: user.id,
        ...(reminderHour !== undefined && { reminderHour }),
      },
    });
    return Response.json({ data: subscription }, { status: 201 });
  } catch {
    return Response.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "인증이 필요합니다" }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const { endpoint } = body;
  if (!endpoint) {
    return Response.json({ error: "endpoint는 필수입니다" }, { status: 400 });
  }

  try {
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint },
      select: { userId: true },
    });
    if (!existing || existing.userId !== user.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.pushSubscription.update({
      where: { endpoint },
      data: { enabled: false },
    });
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "서버 오류" }, { status: 500 });
  }
}
