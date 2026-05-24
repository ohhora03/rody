---
name: my-task-qa
description: "MyTask 구현 통합 검증. API shape과 UI 타입 일치 확인, TypeScript 빌드 검증, 인증 누락 체크. 'QA', '검증', '타입 오류 확인', '빌드 확인' 요청 시 이 스킬을 사용할 것."
---

## 목표
구현된 코드의 경계면 버그를 찾는다. 단순 파일 존재 확인이 아니라 API ↔ UI 타입 불일치, 인증 누락, 빌드 오류를 탐지한다.

## Phase 1 검증 체크리스트

### 1. TypeScript 빌드
```bash
cd /Users/rody/Desktop/familysync
npx tsc --noEmit 2>&1 | head -50
```
오류 있으면 보고서에 전체 내용 포함.

### 2. API shape ↔ UI 타입 교차 비교
- `/src/app/api/my-tasks/route.ts`의 응답 필드 목록
- `/src/app/m/my-tasks/page.tsx` 또는 TaskCard에서 사용하는 필드 목록
- 불일치 항목 (예: API는 `dueDate`, UI는 `due_date`) 보고

### 3. Prisma 스키마 일치
- `schema.prisma`의 `MyTask` 필드명 목록
- API 쿼리에서 사용하는 필드명 목록
- Camel case / snake case 불일치 탐지

### 4. 인증 체크
`/src/app/api/my-tasks/route.ts`, `/src/app/api/my-tasks/[id]/route.ts`, `/src/app/api/push/subscribe/route.ts` 모두 `getSessionUser` 또는 동등한 인증 코드가 있는지 확인.

### 5. 반복 과제 로직 확인
`/src/app/api/my-tasks/[id]/route.ts`의 PATCH 핸들러에서:
- `status === "DONE"` 조건 분기 존재
- `repeat !== "NONE"` 체크 존재
- 새 과제 생성 코드 존재

### 6. 네비게이션 탭
`/src/app/m/layout.tsx`에 `/m/my-tasks` 링크가 추가됐는지 확인.

## Phase 2 검증 체크리스트

### 7. 서비스워커 push 이벤트
`/public/sw.js`에 `addEventListener('push', ...)` 존재 여부.

### 8. Cron 보안
`/src/app/api/cron/notify/route.ts`에 `CRON_SECRET` Bearer 인증 코드 존재.

### 9. vercel.json cron 설정
`/vercel.json`의 crons 배열에 `/api/cron/notify` 경로 존재.

### 10. 만료 구독 처리
Cron 엔드포인트에 410 상태코드 처리 코드 존재.

## 보고서 형식 (`_workspace/05_qa_report.md`)
```markdown
# QA 검증 보고서

## Phase 1 결과
| 항목 | 상태 | 비고 |
|------|------|------|
| TypeScript 빌드 | ✅/❌ | 오류 내용 |
| API-UI shape 일치 | ✅/❌ | 불일치 목록 |
...

## 발견된 버그
1. ...

## 수정 권고
- api-builder: ...
- ui-builder: ...
```
