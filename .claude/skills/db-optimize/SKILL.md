---
name: db-optimize
description: "FamilySync Prisma + Supabase 레이어 최적화. 커넥션 풀 설정, 쿼리 병렬화, include 최소화, 인덱스 개선. DB 관련 5초 지연 해결, 'DB 느려', 'Prisma 최적화', '쿼리 개선' 요청 시 이 스킬을 사용할 것."
---

## Supabase + Prisma 커넥션 최적화

### Serverless 환경 (Vercel)
Vercel의 각 함수 호스팅은 stateless — Prisma가 자체 커넥션 풀을 쌓으면 충돌한다.

**필수 DATABASE_URL 파라미터:**
```
?pgbouncer=true&connection_limit=1&pool_timeout=0&sslmode=require
```

- `connection_limit=1`: Prisma가 커넥션 1개만 유지 (PgBouncer가 풀 관리)
- `pool_timeout=0`: 커넥션 대기 타임아웃 없음 (무한 대기 → PgBouncer가 알아서)
- `pgbouncer=true`: Prepared statement 비활성화 (PgBouncer 트랜잭션 모드 호환)

**DIRECT_URL**: migration + schema push 전용. 포트 5432 직접 연결.

### 로컬 개발 (.env.local)
개발에서는 커넥션 풀 없어도 되지만 DIRECT_URL은 필요:
```
DATABASE_URL="postgresql://...@...pooler.supabase.com:5432/postgres?sslmode=require"
DIRECT_URL="postgresql://...@...supabase.co:5432/postgres?sslmode=require"
```

## 쿼리 최적화 패턴

### 1. 중첩 include → 병렬 select
**나쁜 예 (현재 mobile-home.ts):**
```ts
const memberships = await prisma.familyMember.findMany({
  include: {
    family: {
      include: {
        members: { include: { user: true } },
        projects: { include: { sprints: true } },
      },
    },
  },
});
```
이 쿼리 1개가 JOIN이 폭증하면 수백ms 걸릴 수 있다.

**좋은 예 (분리 + 병렬):**
```ts
const membership = await prisma.familyMember.findFirst({
  where: { userId },
  select: { familyId: true },
});

if (!membership) return emptyResult;

const [family, projects] = await Promise.all([
  prisma.family.findUnique({
    where: { id: membership.familyId },
    include: { members: { select: { id: true, role: true, nickname: true, user: { select: { id: true, name: true, color: true } } } } },
  }),
  prisma.project.findMany({
    where: { familyId: membership.familyId },
    include: { sprints: { orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true, startDate: true, endDate: true, goal: true } } },
    orderBy: { createdAt: "asc" },
  }),
]);
```

### 2. 직렬 await → Promise.all
```ts
// 나쁨
const issues = await prisma.issue.findMany({...});
const backlog = await prisma.issue.findMany({...});

// 좋음
const [issues, backlog] = await Promise.all([
  prisma.issue.findMany({...}),
  prisma.issue.findMany({...}),
]);
```

### 3. include 대신 select로 필드 제한
```ts
// 나쁨: User 전체 로드
include: { assignee: true }

// 좋음: 필요한 필드만
select: { assignee: { select: { id: true, name: true, color: true } } }
```

### 4. PrismaClient 옵션 정리
```ts
// prisma.ts - 불필요한 datasources 오버라이드 제거
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
    // datasources 오버라이드 제거: schema.prisma의 env() 직접 사용
  });
```

## 수정 순서
1. `.env.local`에 `DIRECT_URL` 추가
2. `src/lib/prisma.ts` 정리
3. `src/lib/mobile-home.ts` 쿼리 분리 + 병렬화
4. 기타 API 라우트 직렬 패턴 수정
5. `npx tsc --noEmit` 확인
