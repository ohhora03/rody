import webpush from "web-push";
import { prisma } from "./prisma";

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!vapidPublic || !vapidPrivate || !vapidSubject) return false;
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// 특정 사용자의 모든 활성 구독에 푸시 발송. 에러 무시.
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) return;
  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId, enabled: true },
    });
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
          );
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.update({
              where: { id: sub.id },
              data: { enabled: false },
            });
          }
        }
      }),
    );
  } catch {
    // ignore push errors
  }
}
