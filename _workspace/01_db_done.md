# 01_db_done — sprint-db-agent 작업 결과

- 작성일: 2026-05-24
- 작성자: sprint-db-agent
- 대상 PRD: `_workspace/00_prd.md` §1.3

## 1. 스키마 변경 사항

### 1.1 `IssueStatus` enum — `FAILED` 추가

변경 전:
```
READY, IN_PROGRESS, RESOLVED, CLOSED, REJECTED, HOLD
```
변경 후:
```
READY, IN_PROGRESS, RESOLVED, CLOSED, REJECTED, HOLD, FAILED
```
- 기존 enum 값은 모두 보존(순서/이름 변경 없음).
- `FAILED`만 신규 추가 — 스프린트 완료 시 미완료로 마감되는 과제용.

### 1.2 `Issue` 모델 인덱스 추가

PRD §1.3 권장 사항대로 완료 모달 조회 성능 확보:
```prisma
@@index([sprintId, status])
```
- 기존 인덱스(`projectId`, `sprintId`, `assigneeId`, `[projectId, sprintId]`)는 모두 유지.

수정 파일: `/Users/rody/Desktop/familysync/prisma/schema.prisma`

## 2. 실행 커맨드 및 결과

작업 디렉토리: `/Users/rody/Desktop/familysync`

### 2.1 `npx prisma db push`
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public"
  at "aws-1-ap-northeast-2.pooler.supabase.com:5432"

🚀  Your database is now in sync with your Prisma schema. Done in 537ms

Running generate... (Use --skip-generate to skip the generators)
✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 71ms
```
- 결과: 성공 (1회차, 재시도 불필요)
- Supabase Postgres에 `IssueStatus` enum 값 `FAILED` 추가, `Issue(sprintId, status)` 인덱스 생성 반영됨.

### 2.2 `npx prisma generate`
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 58ms
```
- 결과: 성공. Prisma Client에 `IssueStatus.FAILED` 사용 가능.

## 3. 후속 에이전트 인계 사항

- `sprint-api-agent`는 이제 다음을 사용할 수 있다:
  - `IssueStatus.FAILED` (Prisma Client typed enum)
  - `[sprintId, status]` 복합 인덱스 — `/sprints/[sprintId]/incomplete` 조회 및 carryOver 트랜잭션에서 활용
- 마이그레이션 파일은 생성하지 않았음(지시대로 `db push`만 수행). 향후 정식 마이그레이션 이력이 필요하면 `prisma migrate dev --name add_failed_and_sprint_indexes`로 별도 캡처 요망.

## 4. 비고

- Prisma 5.22.0 → 7.8.0 메이저 업데이트 안내가 출력되었으나, 본 작업 범위 외이므로 무시.
- 기존 데이터 백필 불필요(신규 enum 값 추가만 발생).
