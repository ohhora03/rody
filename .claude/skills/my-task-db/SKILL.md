---
name: my-task-db
description: "MyTask, PushSubscription Prisma 모델 추가 및 DB 마이그레이션. schema.prisma 수정, prisma db push, prisma generate 전 과정을 수행. 'DB 스키마', 'prisma 모델 추가', 'MyTask 마이그레이션' 같은 요청 시 이 스킬을 사용할 것."
---

## 목표
`/prisma/schema.prisma`에 `MyTask`, `PushSubscription`, `TaskStatus`, `RepeatType` 모델/enum을 추가하고 DB에 반영한다.

## 실행 순서

### 1. 기존 스키마 파악
`/prisma/schema.prisma` 전체를 읽는다. 특히:
- `Priority` enum이 이미 존재하는지 확인 (재정의 금지)
- `User` 모델의 기존 relation 필드 목록 파악
- 현재 모델 목록 확인

### 2. 추가할 모델/enum

```prisma
enum TaskStatus {
  PENDING
  DONE
}

enum RepeatType {
  NONE
  DAILY
  WEEKLY
}

model MyTask {
  id        String     @id @default(cuid())
  title     String
  memo      String?
  priority  Priority   @default(MEDIUM)
  status    TaskStatus @default(PENDING)
  dueDate   DateTime?
  repeat    RepeatType @default(NONE)
  ownerId   String
  owner     User       @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@index([ownerId])
  @@index([ownerId, status])
  @@index([ownerId, dueDate])
}

model PushSubscription {
  id           String   @id @default(cuid())
  userId       String
  endpoint     String   @unique
  p256dh       String
  auth         String
  reminderHour Int      @default(21)
  enabled      Boolean  @default(true)
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())

  @@index([userId])
}
```

### 3. User 모델에 relation 추가
기존 relation 필드들 아래에 추가:
```prisma
myTasks           MyTask[]
pushSubscriptions PushSubscription[]
```

### 4. 검증 및 적용
```bash
cd /Users/rody/Desktop/familysync
npx prisma validate
npx prisma db push
npx prisma generate
```

### 5. 산출물 작성
`_workspace/01_db_done.md`에 추가된 모델/enum과 타입 요약을 기록한다.

## 주의사항
- `Priority` enum은 이미 존재한다 — 절대 재정의하지 않는다
- `prisma db push` 실패 시 에러 메시지를 분석하고 스키마 수정 후 1회 재시도
- 재시도 실패 시 `_workspace/01_db_error.md`에 기록
