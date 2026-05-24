import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (vapidPublic && vapidPrivate && vapidSubject) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

async function handle(req: Request) {
  // Bearer 인증 (Vercel Cron이 자동으로 Authorization: Bearer <CRON_SECRET> 전송)
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return Response.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { enabled: true },
    include: {
      user: {
        include: {
          ownedMyTasks: { where: { status: "PENDING" } },
          assignedMyTasks: { where: { status: "PENDING" } },
        },
      },
    },
  });

  let sent = 0;
  let skipped = 0;

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      // owner이거나 assignee인 PENDING 과제 (중복 제거)
      const ids = new Set<string>();
      sub.user.ownedMyTasks.forEach((t) => ids.add(t.id));
      sub.user.assignedMyTasks.forEach((t) => ids.add(t.id));
      const pendingCount = ids.size;
      if (pendingCount === 0) {
        skipped++;
        return;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: "ARC — 오늘의 할 일",
            body: `미완료 과제 ${pendingCount}개가 있어요 ✅`,
            url: "/m/my-tasks",
          })
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // 만료/삭제된 구독 → 비활성화
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { enabled: false },
          });
        }
        throw err;
      }
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;

  return Response.json({ sent, skipped, failed });
}

export const POST = handle;
export const GET = handle;

