---
name: sprint-api
description: "FamilySync 스프린트 API 구현. 실패 상태 이관, 이관/복사, 스프린트 삭제, 가족명 PATCH, 대시보드 필터 API. 스프린트 관련 백엔드 작업 시 사용."
---

## 프로젝트 컨텍스트
- 프레임워크: Next.js 16 App Router Route Handlers
- 인증: `getSessionUser(req)` — JWT 직접 디코딩
- ORM: Prisma + Supabase PostgreSQL
- 타입: `RouteContext<"/api/...">` 패턴 사용

## 구현 패턴

### 1. 스프린트 완료 (complete/route.ts 수정)
```ts
export async function POST(req, ctx) {
  const { failedAction, targetSprintId } = await req.json();
  
  // 기존: IN_PROGRESS → HOLD
  await prisma.issue.updateMany({
    where: { sprintId, status: "IN_PROGRESS" },
    data: { status: "HOLD" },
  });
  
  // 신규: FAILED 과제 처리
  if (failedAction === "next-sprint" && targetSprintId) {
    await prisma.issue.updateMany({
      where: { sprintId, status: "FAILED" },
      data: { sprintId: targetSprintId },
    });
  } else if (failedAction === "backlog") {
    await prisma.issue.updateMany({
      where: { sprintId, status: "FAILED" },
      data: { sprintId: null },
    });
  }
  // failedAction 없으면 FAILED 과제 그대로 스프린트에 보존
  
  const sprint = await prisma.sprint.update({
    where: { id: sprintId },
    data: { status: "COMPLETED", endDate: new Date() },
  });
  
  // 응답에 FAILED 과제 목록 포함 (프론트에서 이관 UI 결정용)
  const failedIssues = await prisma.issue.findMany({
    where: { sprintId, status: "FAILED" },
    select: { id: true, title: true, points: true },
  });
  
  return Response.json({ data: { sprint, failedIssues } });
}
```

### 2. 이관/복사 엔드포인트 (신규 route.ts)
경로: `src/app/api/projects/[projectId]/sprints/[sprintId]/transfer/route.ts`
```ts
// POST body: { issueId, mode: "transfer" | "copy", targetSprintId }
if (mode === "copy") {
  const original = await prisma.issue.findUnique({ where: { id: issueId } });
  await prisma.issue.create({
    data: {
      title: original.title,
      description: original.description,
      priority: original.priority,
      points: original.points,
      projectId: original.projectId,
      sprintId: targetSprintId,
      assigneeId: original.assigneeId,
      reviewerId: original.reviewerId,
      creatorId: user.id,
      status: "READY",
      order: 9999, // 맨 끝에 배치
    },
  });
} else {
  // transfer
  await prisma.issue.update({
    where: { id: issueId },
    data: { sprintId: targetSprintId, status: "READY" },
  });
}
```

### 3. 스프린트 삭제
경로: `src/app/api/projects/[projectId]/sprints/[sprintId]/route.ts`에 DELETE 추가
```ts
export async function DELETE(req, ctx) {
  // PLANNING 체크
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (sprint.status !== "PLANNING") 
    return Response.json({ error: "진행 중이거나 완료된 스프린트는 삭제할 수 없습니다" }, { status: 400 });
  
  // 이슈 백로그로 이동
  await prisma.issue.updateMany({ where: { sprintId }, data: { sprintId: null } });
  await prisma.sprint.delete({ where: { id: sprintId } });
  return Response.json({ data: { ok: true } });
}
```

### 4. 가족명 변경
경로: `src/app/api/families/[familyId]/route.ts`에 PATCH 추가
```ts
export async function PATCH(req, ctx) {
  const { name } = await req.json();
  if (!name?.trim()) return Response.json({ error: "이름을 입력해주세요" }, { status: 400 });
  
  // MASTER 체크
  const member = await prisma.familyMember.findFirst({
    where: { userId: user.id, familyId },
  });
  if (!member || member.role !== "MASTER") 
    return Response.json({ error: "가족장만 이름을 변경할 수 있습니다" }, { status: 403 });
  
  const family = await prisma.family.update({
    where: { id: familyId },
    data: { name: name.trim() },
  });
  return Response.json({ data: family });
}
```

### 5. 스프린트 목록 이슈 포함 옵션
경로: `src/app/api/projects/[projectId]/sprints/route.ts` GET 수정
```ts
const includeIssues = url.searchParams.get("includeIssues") === "true";
const sprints = await prisma.sprint.findMany({
  where: { projectId },
  include: includeIssues ? {
    issues: { select: { id: true, status: true, points: true } }
  } : undefined,
  orderBy: { createdAt: "desc" },
});
```
