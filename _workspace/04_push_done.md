# 04 — Push 알림 구현 완료

## 상태
- Web Push 알림 시스템 전체 구현 완료
- VAPID 키 발급 및 `.env.local` 설정 완료
- 서비스워커 push 이벤트 핸들러 추가 (기존 캐시 로직 보존)
- Vercel Cron 엔드포인트 + Bearer 인증 구현
- 설정 UI(`/m/settings`)에 푸시 알림 ON/OFF 토글 추가

## 변경/생성 파일

### 생성
- `src/app/api/cron/notify/route.ts` — Cron 엔드포인트 (GET/POST, Bearer 인증, 만료 구독 자동 비활성화)
- `vercel.json` — Vercel Cron 스케줄 (08:00 / 21:00 KST)

### 수정
- `public/sw.js` — 기존 코드 보존, `push` + `notificationclick` 핸들러만 추가
  - 아이콘 경로: `/icon-192.png` (실제 존재하는 파일 사용, `/icons/icon-192x192.png` 아님)
- `src/app/m/settings/page.tsx` — `PushNotificationSection` 컴포넌트 추가
  - "알림 설정" 섹션, 토글, 권한 상태(`Notification.permission === 'denied'`) 처리, 미지원 브라우저 처리
  - `urlBase64ToArrayBuffer` 헬퍼 포함 (TS strict 모드 호환을 위해 `Uint8Array` 대신 `ArrayBuffer` 반환)
- `.env.local` — VAPID 키 + `CRON_SECRET` 추가

### 설치된 패키지
- `web-push`
- `@types/web-push` (dev)

## 환경 변수 (`.env.local`에 추가됨)

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BDfIdB2JoMs3Y7kLOaete7KAxndqj6bHVhoWIRG5zsVcai8sWdhuBc25wipDznmHv8121T1AjSV4o4B4fhomx0s
VAPID_PRIVATE_KEY=s4tNcVKdViUTo3HXtpSsz91a79RprQXrH3j7VmwOZuo
VAPID_SUBJECT=mailto:ohhora03@gmail.com
CRON_SECRET=arc-cron-secret-2026
```

> `NEXT_PUBLIC_VAPID_PUBLIC_KEY`만 클라이언트에 노출됨 (의도된 동작 — 공개 키).
> `VAPID_PRIVATE_KEY`, `CRON_SECRET`는 서버 전용.

## Cron 스케줄

`vercel.json`:
- `0 23 * * *` UTC = **08:00 KST** (아침 알림)
- `0 12 * * *` UTC = **21:00 KST** (저녁 알림)

Vercel Cron이 자동으로 `Authorization: Bearer <CRON_SECRET>` 헤더를 붙여 GET 요청을 보냄. 라우트는 GET/POST 둘 다 핸들링.

## Cron 동작
1. `enabled: true` 인 모든 `PushSubscription` 조회
2. 각 사용자의 `myTasks.status === 'PENDING'` 카운트
3. 0개면 skip, 1개 이상이면 `"미완료 과제 N개가 있어요 ✅"` 발송
4. web-push 응답 404/410(만료) → `enabled: false`로 자동 비활성화
5. 응답: `{ sent, skipped, failed }`

## 수동 단계 (개발자)

1. **Vercel 환경 변수 등록** — Vercel 대시보드 → Project Settings → Environment Variables 에 위 4개 변수 추가 (Production, Preview 모두)
2. **PWA 설치 후 테스트** — iOS Safari는 홈 화면 추가 후에만 푸시 권한 요청 가능
3. **Cron 수동 트리거 테스트**:
   ```bash
   curl -X POST https://<your-domain>/api/cron/notify \
     -H "Authorization: Bearer arc-cron-secret-2026"
   ```
   기대 응답: `{"sent":N,"skipped":M,"failed":0}`
4. **로컬 테스트 (선택)** — `npm run dev` 후 `localhost:3001/m/settings` 에서 토글, 동일 curl로 `/api/cron/notify` 호출

## 검증
- `npx tsc --noEmit` 통과 (타입 에러 없음)
- 기존 `sw.js` 캐시 전략(fetch handler) 변경 없음
- BottomNav에 `설정` 탭이 이미 존재 — 추가 변경 불필요

## qa-validator 메시지
> Push 구현 완료, `_workspace/04_push_done.md` 확인 요망.
