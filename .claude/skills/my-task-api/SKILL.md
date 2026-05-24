---
name: my-task-api
description: "MyTask CRUD API와 Push 구독 API 구현. /api/my-tasks, /api/push/subscribe 라우트 생성. 'MyTask API', '내 할 일 API', 'push subscribe 엔드포인트' 같은 요청 시 이 스킬을 사용할 것."
---

## 목표
Next.js 16 App Router Route Handler로 MyTask CRUD + Push 구독 API를 구현한다.

## 패턴 파악 (필수 선행)
`/src/app/api/issues/route.ts`와 `/src/app/api/issues/[issueId]/route.ts`를 읽어 다음을 파악한다:
- `getSessionUser(req)` 호출 방식
- `Response.json()` 응답 형식
- Prisma 에러 catch 패턴

## 구현할 엔드포인트

### GET /api/my-tasks
```ts
// 본인 과제 전체 반환 (정렬 없음 — 클라이언트에서 처리)
const tasks = await prisma.myTask.findMany({
  where: { ownerId: user.id },
});
return Response.json({ data: tasks });
```

### POST /api/my-tasks
Request body: `{ title, memo?, priority?, dueDate?, repeat? }`
```ts
const task = await prisma.myTask.create({
  data: { ...body, ownerId: user.id },
});
return Response.json({ data: task }, { status: 201 });
```

### PATCH /api/my-tasks/[id]
Request body: `{ title?, memo?, priority?, dueDate?, repeat?, status? }`

**핵심: 반복 과제 완료 처리**
```ts
// status가 DONE으로 변경되고 repeat !== NONE이면
// 다음 주기의 새 과제를 생성한다
if (body.status === "DONE" && task.repeat !== "NONE") {
  const nextDue = calcNextDue(task.dueDate, task.repeat); // DAILY: +1일, WEEKLY: +7일
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
```

권한 확인: `task.ownerId !== user.id`이면 404 반환 (403 아님 — 존재 자체를 숨김)

### DELETE /api/my-tasks/[id]
권한 확인 후 삭제. 204 반환.

### POST /api/push/subscribe
Request body: `{ endpoint, p256dh, auth, reminderHour? }`
```ts
// upsert — 같은 endpoint가 있으면 업데이트
await prisma.pushSubscription.upsert({
  where: { endpoint: body.endpoint },
  update: { p256dh: body.p256dh, auth: body.auth, enabled: true },
  create: { ...body, userId: user.id },
});
```

### DELETE /api/push/subscribe
Request body: `{ endpoint }`
`enabled: false`로 업데이트 (삭제 대신 — 재구독 히스토리 보존)

## 파일 구조
```
/src/app/api/my-tasks/route.ts         — GET, POST
/src/app/api/my-tasks/[id]/route.ts    — PATCH, DELETE
/src/app/api/push/subscribe/route.ts   — POST, DELETE
```

## 에러 핸들링
- 인증 실패: `{ error: "인증이 필요합니다" }` + 401
- 권한 없음 (타인 데이터): `{ error: "Not found" }` + 404
- Prisma 에러: `{ error: "서버 오류" }` + 500 (상세 메시지 숨김)

## 산출물
`_workspace/02_api_done.md`에 각 엔드포인트의 request/response shape을 요약한다.
ui-builder와 push-engineer가 이 파일을 읽으므로 정확하게 작성한다.
