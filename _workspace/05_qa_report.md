# QA 검증 보고서 — Phase 1

검증 일자: 2026-05-23
대상: MyTask + PushSubscription 1차 구현 (DB, API, UI)

## 종합 결과

**Phase 1 통과.** 발견된 버그 없음. 단, TS 빌드 시 `.next/types/routes.d.ts` 재생성이 선행되어야 함 (운영 메모 참조).

## 체크리스트 결과

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | `MyTask`, `PushSubscription` 모델 schema.prisma 존재 | PASS | `prisma/schema.prisma` L181-211 |
| 2 | `npx tsc --noEmit` 통과 | PASS (조건부) | `next build` 후 재생성된 라우트 타입으로 통과. 첫 실행 시 routes.d.ts 미갱신으로 일시 실패함 (아래 운영 메모 참조) |
| 3 | GET `/api/my-tasks` 응답 shape이 UI 타입과 일치 | PASS | API: `{ data: MyTask[] }`. UI: `json.data as MyTask[]` (page.tsx L68). 필드명 1:1 일치 |
| 4 | PATCH 핸들러 repeat 로직 구현 | PASS | `[id]/route.ts` L43-46, L62-74 — `status === DONE && task.status !== DONE && task.repeat !== NONE` 분기 + 다음 과제 생성 |
| 5 | 3개 API 파일 모두 `getSessionUser` 인증 | PASS | `route.ts` L7,L22 / `[id]/route.ts` L18,L87 / `push/subscribe/route.ts` L6,L54 — 모든 핸들러 가드 존재 |
| 6 | 모든 MyTask 쿼리에 `ownerId: user.id` 스코프 | PASS | findMany는 where 절에, create는 data에 주입. PATCH/DELETE는 findUnique 후 `task.ownerId !== user.id` 가드 |
| 7 | 모바일 네비게이션에 "내 할 일" 탭 추가 | PASS | `BottomNav.tsx` L11 — `{ href: "/m/my-tasks", label: "내 할 일", Icon: CheckSquare }` |
| 8 | TaskCard 낙관적 업데이트 쿼리키 `["my-tasks"]` | PASS | `TaskCard.tsx` L42,L43,L45,L51,L56 — invalidate/setQueryData 모두 동일 키 사용 |

## 경계면 교차 검증 결과 (API ↔ UI 필드 정합성)

API `MyTask` 응답 필드 (02_api_done.md 명세 + 실제 route.ts 동작):
`id, title, memo, priority, status, dueDate, repeat, ownerId, createdAt, updatedAt`

UI `MyTask` 인터페이스 (`TaskForm.tsx` L9-20):
`id, title, memo, priority, status, dueDate, repeat, ownerId, createdAt, updatedAt`

**불일치 없음.** Prisma 모델 필드명(camelCase)이 API → UI에서 일관되게 유지됨.

추가 교차 확인:
- TaskCard에서 사용하는 필드: `task.id, status, priority, dueDate, repeat, title` — 모두 명세에 존재
- TaskForm submit payload: `{ title, memo, priority, dueDate, repeat }` — POST 본문 명세와 일치
- POST 응답 `{ data: MyTask }` ↔ new/page.tsx L23-24의 `json.data as MyTask` 일치
- DELETE 204(no body) → 현재 UI에서는 DELETE를 사용하지 않으므로 영향 없음 (향후 사용 시 `res.json()` 호출 금지)

## Prisma 스키마 ↔ 코드 일치

| 필드 | schema.prisma | 코드 사용 위치 | 일치 |
|------|---------------|---------------|------|
| ownerId | `ownerId String` | route.ts where/data, [id]/route.ts | OK |
| dueDate | `dueDate DateTime?` | API `new Date(body.dueDate)`, UI ISO string | OK |
| repeat | `repeat RepeatType @default(NONE)` | enum NONE/DAILY/WEEKLY 일관 사용 | OK |
| status | `status TaskStatus @default(PENDING)` | enum PENDING/DONE 일관 사용 | OK |
| reminderHour | `reminderHour Int @default(21)` | push/subscribe upsert 갱신 | OK |
| enabled | `enabled Boolean @default(true)` | upsert에서 `enabled: true` 복원, DELETE에서 `enabled: false` | OK |
| endpoint | `endpoint String @unique` | upsert where 키, DELETE 본인소유 검증 | OK |

스네이크/카멜 불일치 없음.

## 부수적 관찰 (버그 아님, 참고)

1. **`getSessionUser` 위치 확인** — 실제 import 경로 `@/lib/get-session`이 사용됨. 다른 라우트와 동일한 패턴 (확인 완료, 정상).
2. **DELETE 후 빈 응답** — `new Response(null, { status: 204 })` 정상. 명세대로 본문 없음.
3. **PATCH의 dueDate 갱신** — `body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(...) : null }`. `null` 명시 전달 시 dueDate 제거 가능 — 명세대로 동작.
4. **반복 다음 dueDate 계산** — `calcNextDue(task.dueDate, task.repeat)`. `task.dueDate`가 null이면 `new Date()`(현재)에 +1/+7 — 명세대로 동작.
5. **upsert의 userId 갱신** — 같은 endpoint를 다른 사용자가 재구독하면 소유권이 이전됨. 명세상 "재구독 케이스"로 의도된 동작이지만, 디바이스 공유 환경에서 prior owner의 구독이 사라질 수 있음. **현재 명세 위반은 아니며 Phase 2에서 push 발송 시 충돌이 없으므로 PASS.** (향후 정책 결정 필요 시 검토 권고)
6. **POST의 `dueDate: null` 처리** — `body.dueDate ? new Date(body.dueDate) : null`. 정상.
7. **PATCH 멱등성** — `task.status !== "DONE"`을 willCompleteRepeat 조건에 포함하여 이미 DONE인 과제 재PATCH 시 새 과제가 생성되지 않음. 명세 일치.

## TypeScript 빌드 결과

최초 실행 시 발생한 오류 (참고용):
```
src/app/api/my-tasks/[id]/route.ts(16,21): error TS2344: Type '"/api/my-tasks/[id]"' does not satisfy the constraint 'AppRouteHandlerRoutes'.
src/app/api/my-tasks/[id]/route.ts(21,11): error TS2339: Property 'id' does not exist on type 'unknown'.
src/app/api/my-tasks/[id]/route.ts(84,21): error TS2344: Type '"/api/my-tasks/[id]"' does not satisfy the constraint 'AppRouteHandlerRoutes'.
src/app/api/my-tasks/[id]/route.ts(89,11): error TS2339: Property 'id' does not exist on type 'unknown'.
```

**원인:** `.next/types/routes.d.ts`의 `AppRouteHandlerRoutes` 유니언 타입이 새 라우트 추가 후 재생성되지 않아 발생. Next.js 16의 typed routes 시스템 특성.

**해결:** `npx next build`(또는 `next dev` 1회) 실행 후 routes.d.ts가 갱신되면 동일한 코드가 그대로 통과. 재실행한 `tsc --noEmit`은 오류 0건.

**코드 수정 불필요** — `RouteContext<"/api/issues/[issueId]">` 패턴과 동일하게 작성되어 있으며, 기존 라우트와 같은 메커니즘을 사용함.

## 운영 메모 (수정 권고 아님)

- 새 API 라우트 추가 후 CI/pre-commit에서 `tsc --noEmit` 단독 실행 시 위 오류가 재현될 수 있음. 빌드 또는 `next dev` 선행 단계가 필요. AGENTS.md에 명시되어 있는 "Next.js 16 breaking changes"의 일환.
- Phase 2 작업자(push-engineer)가 `/api/cron/notify` 등 새 라우트를 추가하면 동일 현상이 발생할 수 있음을 인지할 것.

## 수정 권고

없음. Phase 2 진행 가능.

---

# QA 검증 보고서 — Phase 2

검증 일자: 2026-05-23
대상: Web Push 알림 시스템 (서비스워커, Cron 엔드포인트, 설정 UI)

## Phase 2 결과

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | `sw.js`에 `addEventListener('push', ...)` 핸들러 | PASS | `public/sw.js` L74-84 — `event.data?.json()` 파싱, `showNotification` 호출, `data.url` 페이로드 보존 |
| 2 | `sw.js`에 `addEventListener('notificationclick', ...)` 핸들러 | PASS | `public/sw.js` L86-91 — `event.notification.close()` 후 `openWindow(data.url ?? '/m/my-tasks')` |
| 3 | 기존 `sw.js` fetch/install/activate 핸들러 유지 | PASS | install(L15-20), activate(L22-29), fetch(L31-71) 모두 원본 그대로. CACHE_NAME='arc-v3', STATIC_ASSETS 변경 없음 |
| 4 | Cron 엔드포인트 `CRON_SECRET` Bearer 인증 | PASS | `route.ts` L14-17 — `auth !== `Bearer ${CRON_SECRET}`` 시 401. `CRON_SECRET` 미설정도 차단 |
| 5 | Cron 엔드포인트 410/404 처리 (구독 비활성화) | PASS | `route.ts` L58-66 — `err.statusCode === 404 || 410` 시 `enabled: false` 업데이트 후 throw → failed 카운트 반영 |
| 6 | `vercel.json` crons 배열 + `/api/cron/notify` 경로 | PASS | `0 23 * * *` (08:00 KST), `0 12 * * *` (21:00 KST) 두 스케줄 모두 `/api/cron/notify` |
| 7 | 설정 페이지가 `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY` 사용 | PASS | `settings/page.tsx` L74 — 키 미설정 시 에러 메시지 후 return. `applicationServerKey: urlBase64ToArrayBuffer(publicKey)` (L92) |
| 8 | 설정 페이지가 `Notification.permission === 'denied'` 처리 | PASS | L152-153 안내 문구, L161 버튼 disabled, L174 opacity 0.5. `requestPermission()` 결과 미허용 시 별도 에러도 표시 (L82-85) |

## 추가 교차 검증

**SW 페이로드 ↔ Cron 발송 일치**
- Cron이 보내는 페이로드(`route.ts` L51-55): `{ title, body, url: "/m/my-tasks" }`
- SW push 핸들러(`sw.js` L77-82): `data.title`, `data.body`, `data.url` 모두 사용. **불일치 없음.**

**Subscribe API ↔ 설정 UI 본문 일치**
- 클라이언트 POST 본문(`settings/page.tsx` L99-103): `{ endpoint, p256dh, auth }`
- 서버 요구 필드(`subscribe/route.ts` L21-22): `endpoint, p256dh, auth` 필수. **일치.**
- DELETE 본문: `{ endpoint }` → 서버 `existing.userId !== user.id` 가드로 본인 소유만 비활성화. **소유권 검증 OK.**

**Upsert 로직**
- `where: { endpoint }` 기반 upsert (`subscribe/route.ts` L30-46)
- update 시 `enabled: true` 복원 + `userId: user.id` 갱신 → 재구독/소유권 이전 케이스 처리
- create 시 `reminderHour` 기본값은 schema(`@default(21)`)에서 처리, 선택적 override 지원

**TypeScript 컴파일**
- `npx tsc --noEmit` 종료 코드 0, 출력 없음 (오류 0건). Phase 1에서 언급된 `.next/types/routes.d.ts` 재생성 이슈는 본 검증 시점에 이미 해소된 상태.

## 부수적 관찰 (버그 아님)

1. **`webpush.setVapidDetails` 모듈 로드 시점 호출** — `route.ts` L8-10. VAPID 키 미설정 시에도 모듈은 로드되며, 요청 핸들러에서 500 응답으로 명시적 안내(L19-21). 정상.
2. **failed 카운팅** — 410/404 시 `enabled: false` 후 `throw err` → `Promise.allSettled`에서 rejected로 집계되어 `failed`에 포함. 명세상 "비활성화 후 실패로 집계"가 의도된 동작인지 명세 확인 권고. 현재는 운영상 정상 동작 (만료된 것도 "발송 실패"로 알림되어 트래킹 가능).
3. **`urlBase64ToArrayBuffer` 반환 타입** — `04_push_done.md`에 명시된대로 TS strict 호환을 위해 `ArrayBuffer` 반환. `pushManager.subscribe`의 `applicationServerKey` 시그니처와 일치.
4. **Cron GET/POST 둘 다 지원** — Vercel Cron은 기본 GET. 수동 테스트용 POST도 동일 핸들러 사용. 정상.

## 최종 결론

- Phase 1: PASS
- Phase 2: PASS
- 미해결 항목: 없음

전체 MyTask + 푸시 알림 시스템 구현 완료. 운영 배포 전 수동 단계(Vercel 환경변수 등록, PWA 설치 후 iOS 푸시 테스트)는 `04_push_done.md` 가이드 참고.

