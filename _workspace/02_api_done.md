# 02_api_done — sprint-api-agent 작업 결과

- 작성일: 2026-05-24
- 작성자: sprint-api-agent
- 대상 PRD: `_workspace/00_prd.md` §1~5
- 선행 작업: `_workspace/01_db_done.md` (IssueStatus.FAILED, `@@index([sprintId, status])` 적용됨)

## 0. 공통

- 인증: 모든 라우트는 `getSessionUser(req)` 사용 (JWT 직접 디코딩, DB 조회 없음).
- 권한 가드: 프로젝트 멤버십 → MASTER 체크 순.
- `RouteContext<...>` 타입은 Next.js 16 자동 생성. `ctx.params`는 await.
- 트랜잭션: 다단계 변경(완료+이관, 삭제+이슈 백로그 이동)은 `prisma.$transaction([...])` 사용.
- 타입 검증: `npx next typegen` → `npx tsc --noEmit` 통과 (본 작업에서 작성/수정한 5개 라우트에 한해 에러 0건. UI 컴포넌트 측 `IssueStatus.FAILED` 미대응 에러는 web-ui-agent 영역).

---

## 1. POST `/api/projects/[projectId]/sprints/[sprintId]/complete` (수정)

**파일:** `src/app/api/projects/[projectId]/sprints/[sprintId]/complete/route.ts`

### Body
```ts
{
  failedAction?: "next-sprint" | "backlog" | null,
  targetSprintId?: string
}
```

### 동작
1. MASTER 권한 체크.
2. 해당 스프린트의 미완료 이슈(`status NOT IN (RESOLVED, CLOSED)`)를 조회.
3. 분기:
   - **`failedAction` 없음/null** — 진행 중 이슈는 HOLD로 (기존 동작 유지), 스프린트 COMPLETED 처리. 응답에 `failedIssues` 동봉(프론트가 모달에서 처리 방식을 결정하는 용도).
   - **`failedAction === "next-sprint"`** — `targetSprintId` 필수. 동일 프로젝트 검증 후 트랜잭션으로 (a) 미완료 이슈 sprintId 이동 + status READY, (b) 진행 중 이슈 HOLD, (c) 스프린트 COMPLETED.
   - **`failedAction === "backlog"`** — 트랜잭션으로 (a) 미완료 이슈 sprintId=null + status READY, (b) 스프린트 COMPLETED.
4. 응답: `{ data: sprint, failedIssues: [{id,title,status,points,assigneeId}, ...] }`

### 에러
- 401 인증 / 403 MASTER 아님 / 400 next-sprint인데 targetSprintId 누락 / 404 targetSprintId 미존재 / 400 알 수 없는 failedAction.

> 비고: PRD §1.4 (b)의 `carryOver` per-issue 액션 모델 대신, 입력 명세에 따라 일괄 `failedAction` + `targetSprintId` 모델로 구현. 프론트에서 일괄/분기 UX를 제어한다.

---

## 2. POST `/api/projects/[projectId]/sprints/[sprintId]/transfer` (신규)

**파일:** `src/app/api/projects/[projectId]/sprints/[sprintId]/transfer/route.ts`

### Body
```ts
{
  issueId: string,
  mode: "transfer" | "copy",
  targetSprintId: string
}
```

### 동작
- 프로젝트 멤버십 체크(MASTER 강제 아님 — 멤버면 가능).
- 이슈 검증: 동일 프로젝트 + 현재 `sprintId`가 path의 sprintId와 일치.
- 대상 스프린트 검증: 동일 프로젝트.
- **transfer:** `prisma.issue.update`로 `sprintId = targetSprintId`, `status = READY`.
- **copy:** `prisma.issue.create`로 신규 이슈 생성. 복사 필드 — `title, description, priority, points, projectId, assigneeId, reviewerId`. 추가 세팅 — `sprintId = targetSprintId`, `status = READY`, `order = 9999`, `creatorId = 호출자`.

### 에러
- 401 / 403 / 404 / 400 invalid mode / 400 missing body fields.

---

## 3. DELETE `/api/projects/[projectId]/sprints/[sprintId]` (추가)

**파일:** `src/app/api/projects/[projectId]/sprints/[sprintId]/route.ts` (기존 GET/PATCH 유지, DELETE 핸들러 append)

### 동작
- MASTER만.
- `sprint.status === "PLANNING"` 아니면 400 `"PLANNING 상태의 스프린트만 삭제할 수 있습니다"`.
- 트랜잭션:
  1. `prisma.issue.updateMany({ where: { sprintId }, data: { sprintId: null } })` — 백로그로 이동.
  2. `prisma.sprint.delete({ where: { id: sprintId } })`.
- 응답: `{ data: { deleted: true } }`.

> 비고: PRD §3.2의 `SPRINT_DELETED` audit comment는 본 입력 명세 범위 밖이라 미구현. 추후 확장 시 트랜잭션에 추가만 하면 됨.

---

## 4. PATCH `/api/families/[familyId]` (추가)

**파일:** `src/app/api/families/[familyId]/route.ts` (기존 GET 유지, PATCH 추가)

### Body
```ts
{ name: string }
```

### 동작
- 가족 멤버십 + MASTER 체크 (비-MASTER 403 `"마스터만 가족 이름을 변경할 수 있습니다"`).
- `name.trim()` 후 빈문자열 400, 30자 초과 400.
- `prisma.family.update({ where: { id: familyId }, data: { name } })`.
- 응답: `{ data: family }`.

---

## 5. GET `/api/projects/[projectId]/sprints?includeIssues=true` (확장)

**파일:** `src/app/api/projects/[projectId]/sprints/route.ts`

- 쿼리 파라미터 `includeIssues=true`이면 각 sprint에 `issues: [{ id, status, points }]` 포함.
- false/미지정 시 기존 동작 그대로(스프린트 목록만).
- `select`로 최소 필드만 끌어와서 페이로드 최소화.

---

## 6. 인계 / 후속 작업

- **web-ui-agent**: 
  - `IssueStatus.FAILED` 라벨/컬러 매핑을 `task-modal.tsx`, `sprints/page.tsx` 등에 추가해야 함 (현재 tsc 에러 2건 — 본 API 작업 범위 밖).
  - `complete` 호출 시 1차 호출(미완료 조회용으로 `failedIssues` 받기) → 모달에서 분기 선택 후 2차 호출로 `failedAction` 지정 패턴을 권장. 단, 1차 호출에서도 스프린트가 COMPLETED로 전환되므로 UX 시퀀스는 "완료 클릭 → confirm 모달에 미완료 N건 표시 → 선택 → 한 번에 POST" 단일 호출로 가는 것이 자연스러움. 필요 시 `GET /incomplete` 별도 추가 검토.
  - 스프린트 카드 메뉴: PLANNING 외에는 삭제 항목 hidden.
  - 사이드바: 가족명 옆 연필 아이콘 → PATCH `/api/families/[familyId]`.
- **mobile-ui-agent**: 동일 API 그대로 활용 가능. 모바일 Bearer 토큰은 `getSessionUser`가 자동 처리.

---

## 7. 변경 파일 목록

| 파일 | 변경 |
|---|---|
| `src/app/api/projects/[projectId]/sprints/[sprintId]/complete/route.ts` | POST 확장 (failedAction 분기) |
| `src/app/api/projects/[projectId]/sprints/[sprintId]/transfer/route.ts` | 신규 (POST) |
| `src/app/api/projects/[projectId]/sprints/[sprintId]/route.ts` | DELETE 핸들러 추가 |
| `src/app/api/families/[familyId]/route.ts` | PATCH 핸들러 추가 |
| `src/app/api/projects/[projectId]/sprints/route.ts` | GET에 `includeIssues` 파라미터 |

끝.
