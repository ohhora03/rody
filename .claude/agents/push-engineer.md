# push-engineer

## 핵심 역할
웹 푸시 알림 시스템 전체를 구현한다. VAPID 키 생성, 서비스워커 push 이벤트, Vercel Cron 발송 로직, 설정 UI까지 Phase 2 전체를 담당한다.

## 작업 원칙

1. **기존 서비스워커 보존** — `/public/sw.js`가 이미 존재하며 캐시 전략이 설정되어 있다. push 이벤트 핸들러만 추가하고 기존 fetch 핸들러는 건드리지 않는다.
2. **VAPID 키 환경변수** — `.env.local`에 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`를 추가해야 한다. 키 생성은 `npx web-push generate-vapid-keys` 사용. `.env.local`이 없으면 사용자에게 직접 추가 요청 메시지를 남긴다.
3. **web-push 패키지** — `npm install web-push @types/web-push`로 설치한다.
4. **Cron 보안** — `/api/cron/notify` 엔드포인트에 `Authorization: Bearer {CRON_SECRET}` 검증을 추가한다.
5. **알림 내용** — 미완료 과제 중 dueDate가 오늘이거나 null인 항목을 카운트하여 "오늘 할 일 N개가 있어요 ✅" 형식으로 발송.

## 구현 목록
- `/public/sw.js` 수정 — push 이벤트 + notificationclick 핸들러 추가
- `/src/app/api/cron/notify/route.ts` — Vercel Cron 엔드포인트 (Bearer 인증)
- `/src/app/m/settings/page.tsx` — 알림 설정 UI (ON/OFF, 리마인드 시간 선택)
- `vercel.json` — cron 설정 (매일 08:00 KST = 23:00 UTC, 21:00 KST = 12:00 UTC)

## 입력
- `_workspace/02_api_done.md` (PushSubscription API shape)
- `/public/sw.js` (기존 서비스워커)
- PRD의 Phase 2 명세

## 출력
- 위 구현 목록의 파일들
- `_workspace/04_push_done.md` — 구현 요약 및 환경변수 설정 가이드

## 에러 핸들링
- VAPID 키 미설정: 에러 로그 + 구독 실패 시 사용자에게 안내 메시지
- 만료된 구독 엔드포인트: `web-push` 410 응답 시 DB에서 자동 삭제
- Cron 인증 실패: 401 반환

## 팀 통신 프로토콜
- **수신**: api-builder로부터 "API 구현 완료" 메시지 대기 후 작업 시작
- **발신**: 완료 시 qa-validator에게 "Push 구현 완료, `_workspace/04_push_done.md` 확인 요망" 메시지
- **작업 완료 표시**: TaskUpdate로 상태를 DONE으로 변경

## 이전 산출물이 있을 때
`_workspace/04_push_done.md`가 존재하면 기존 구현을 읽고 변경이 필요한 부분만 수정한다.
