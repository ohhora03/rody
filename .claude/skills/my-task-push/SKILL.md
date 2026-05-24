---
name: my-task-push
description: "MyTask 웹 푸시 알림 구현. VAPID 키, 서비스워커 push 이벤트, Vercel Cron 발송, 설정 UI. 'push 알림', 'VAPID', 'web-push', 'Cron 알림', '설정 탭' 요청 시 이 스킬을 사용할 것."
---

## 목표
Web Push API를 사용해 미완료 과제 알림을 구현한다. 매일 오전 8시/오후 9시(KST) Vercel Cron으로 발송한다.

## 패키지 설치 (선행)
```bash
cd /Users/rody/Desktop/familysync
npm install web-push
npm install --save-dev @types/web-push
```

## VAPID 키 설정
```bash
npx web-push generate-vapid-keys
```
생성된 키를 `.env.local`에 추가:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:ohhora03@gmail.com
```
> `.env.local`이 없으면 생성한다. `.gitignore`에 이미 등록되어 있을 것이므로 확인.

## 1. 서비스워커 push 이벤트 (`/public/sw.js` 수정)
기존 코드 아래에 추가:
```js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'ARC 알림', {
      body: data.body ?? '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { url: data.url ?? '/m/my-tasks' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

## 2. Cron 엔드포인트 (`/src/app/api/cron/notify/route.ts`)
```ts
import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function POST(req: Request) {
  // Bearer 인증
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 활성 구독 가져오기
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { enabled: true },
    include: {
      user: { include: { myTasks: { where: { status: 'PENDING' } } } }
    },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const pendingCount = sub.user.myTasks.length;
      if (pendingCount === 0) return;

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: 'ARC — 오늘의 할 일',
            body: `미완료 과제 ${pendingCount}개가 있어요 ✅`,
            url: '/m/my-tasks',
          })
        );
      } catch (err: unknown) {
        // 만료된 구독 자동 삭제
        if ((err as { statusCode?: number }).statusCode === 410) {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { enabled: false },
          });
        }
      }
    })
  );

  return Response.json({ sent: results.filter(r => r.status === 'fulfilled').length });
}
```

## 3. vercel.json
프로젝트 루트에 `vercel.json`이 없으면 생성, 있으면 crons 섹션 추가:
```json
{
  "crons": [
    { "path": "/api/cron/notify", "schedule": "0 23 * * *" },
    { "path": "/api/cron/notify", "schedule": "0 12 * * *" }
  ]
}
```
(23:00 UTC = 08:00 KST, 12:00 UTC = 21:00 KST)

> `CRON_SECRET` 환경변수도 `.env.local`에 추가 필요: `CRON_SECRET=<임의의 긴 문자열>`

## 4. 설정 UI (`/src/app/m/settings/page.tsx`)
```tsx
// 구독 상태 + 토글
const [isSubscribed, setIsSubscribed] = useState(false);

async function subscribe() {
  const sw = await navigator.serviceWorker.ready;
  const subscription = await sw.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
  });
  const { endpoint, keys } = subscription.toJSON();
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, p256dh: keys?.p256dh, auth: keys?.auth }),
  });
  setIsSubscribed(true);
}
```

`urlBase64ToUint8Array` 유틸 함수도 같은 파일에 포함한다.

## 산출물
`_workspace/04_push_done.md`에 구현 요약과 필요한 환경변수 목록을 기록한다.
