# PRD — ARC (FamilySync) Sprint 기능 확장

- 작성일: 2026-05-24
- 작성자: pm-agent
- 대상 에이전트: `sprint-db-agent`, `sprint-api-agent`, `sprint-mobile-ui-agent`, `sprint-web-ui-agent`
- 범위: 스프린트 라이프사이클 강화 (FAILED 처리·이관/복사·삭제), 가족 식별성(가족 이름), 대시보드 필터, 추가 제안

> **Next.js 16 주의:** 본 프로젝트는 Next.js 16. API 작성/수정 시 반드시 `node_modules/next/dist/docs/`를 우선 확인할 것. `RouteContext<"...">` 타입과 `ctx.params`는 await 필요.

---

## 0. 공통 컨텍스트

### 현 데이터 모델 요점 (`prisma/schema.prisma`)
- `Sprint.status`: `PLANNING | ACTIVE | COMPLETED`
- `Issue.status`: `READY | IN_PROGRESS | RESOLVED | CLOSED | REJECTED | HOLD`
- `Issue.sprintId`는 nullable, `onDelete: SetNull` — 스프린트가 사라지면 자동으로 백로그로 떨어짐
- `Issue.points: Float @default(1)` — 포인트는 이슈에 귀속됨
- `FamilyMember.role`: `MASTER | MEMBER`
- `Family.name: String` (이미 존재, 변경 API만 추가)

### 현 API 라우트
- `POST /api/projects/[projectId]/sprints` (생성, MASTER만)
- `POST /api/projects/[projectId]/sprints/[sprintId]/start` (PLANNING → ACTIVE)
- `POST /api/projects/[projectId]/sprints/[sprintId]/complete` (ACTIVE → COMPLETED)
- `GET/PATCH/DELETE /api/projects/[projectId]/sprints/[sprintId]` (개별 조작; 본 PRD에서 DELETE 정책 변경)

---

## 1. FAILED 상태 + 완료 시 이관 모달

### 1.1 목적
스프린트 종료 시점에 미완료/거부 과제를 명시적으로 처리하여 "스프린트 회고 가능성"을 확보한다. 미완수가 다음 스프린트로 묻지도 따지지도 않고 흘러가는 현 동작을 방지.

### 1.2 사용자 스토리
- (MASTER로서) ACTIVE 스프린트를 완료할 때, 미완료(RESOLVED/CLOSED가 아닌) 이슈 목록을 보고 각 이슈를 "다음 스프린트 이관 / 백로그로 / 그대로 두기(=FAILED로 마감)" 중 선택할 수 있다.
- (MEMBER로서) 내가 끝까지 못 끝낸 과제는 FAILED 라벨이 붙어 회고에 활용된다.

### 1.3 DB 변경 명세
```prisma
enum IssueStatus {
  READY
  IN_PROGRESS
  RESOLVED
  CLOSED
  REJECTED
  HOLD
  FAILED   // 신규: 스프린트 종료 시 미완료로 마감된 과제
}
```
- 마이그레이션명: `add_failed_issue_status`
- 백필 불필요(기존 데이터 영향 없음).
- 인덱스 추가 권장: `@@index([sprintId, status])` — 완료 모달 조회 성능.

### 1.4 API 명세

#### (a) 완료 직전 미완료 조회
`GET /api/projects/[projectId]/sprints/[sprintId]/incomplete`
- 권한: 프로젝트 멤버
- 응답:
```json
{
  "data": {
    "sprint": { "id": "...", "name": "Sprint 3", "status": "ACTIVE" },
    "incompleteIssues": [
      { "id": "...", "title": "...", "status": "IN_PROGRESS", "points": 3, "assignee": {...} }
    ]
  }
}
```
- 미완료 정의: `status NOT IN (RESOLVED, CLOSED)` 그리고 `sprintId = :sprintId`

#### (b) 완료 + 이관 처리 (기존 complete 엔드포인트 확장)
`POST /api/projects/[projectId]/sprints/[sprintId]/complete`
- 권한: MASTER
- Body:
```json
{
  "carryOver": [
    { "issueId": "i_1", "action": "MOVE_NEXT", "targetSprintId": "s_next" },
    { "issueId": "i_2", "action": "MOVE_BACKLOG" },
    { "issueId": "i_3", "action": "KEEP_FAILED" }
  ]
}
```
- `action`:
  - `MOVE_NEXT` — `sprintId = targetSprintId`, status는 유지 (READY/IN_PROGRESS 등). `targetSprintId`는 PLANNING 상태여야 함. 누락 시 400.
  - `MOVE_BACKLOG` — `sprintId = null`, status는 유지.
  - `KEEP_FAILED` — `sprintId = 그대로`, `status = FAILED`.
- 트랜잭션 처리(prisma.$transaction). 모든 이슈 업데이트 후 `Sprint.status = COMPLETED`.
- Body 누락 또는 `carryOver` 미제공 시: 미완료 이슈가 0개여야만 통과. 그 외 400 (`"미완료 과제 처리 방식을 지정해주세요"`).
- 응답: `{ data: { sprint, updatedIssueIds: [...] } }`

### 1.5 UI/UX

#### 웹 (`familysync/src/app/(dashboard)/projects/[projectId]/sprint`)
- 스프린트 "완료" 버튼 클릭 → `incomplete` 조회 → 모달 오픈
- 모달 구성:
  - 헤더: "Sprint X 완료 — 미완료 N건 처리"
  - 각 이슈 행: 제목 / 담당자 / 포인트 / 라디오(다음 스프린트 이관 · 백로그로 이동 · FAILED로 마감)
  - "다음 스프린트 이관" 선택 시 우측에 대상 PLANNING 스프린트 드롭다운 노출 (PLANNING 스프린트 0개면 disabled + "PLANNING 스프린트가 없습니다" 안내)
  - "모두 이관 / 모두 백로그 / 모두 FAILED" 일괄 적용 버튼
  - CTA: "완료 처리"
- FAILED 이슈 시각화: 회색 X 배지 + 취소선 톤다운 (RESOLVED 그린, FAILED 그레이 #6b7280, REJECTED 레드와 구분)

#### 모바일 (`familysync-mobile/app`)
- 스프린트 상세 화면 하단 sticky "완료" 버튼 → BottomSheet 모달
- 행 단위 세그먼트 컨트롤(이관/백로그/FAILED) + 이관 선택 시 inline picker

---

## 2. 이관(Move) vs 복사(Copy)

### 2.1 목적
같은 작업을 여러 스프린트에 반복 등록해야 할 때(예: 매주 반복되는 청소 과제), 포인트 적립 정책을 명확히 한다.

### 2.2 정책 정의
| 동작 | sprintId 변경 | Issue 신규 생성 | 포인트 적립 | 이력(Comment) |
|---|---|---|---|---|
| **이관 (Move)** | O | X | 원본 이슈 1회만 (스프린트 간 이동이라 중복 X) | "Sprint A → Sprint B 이관" 시스템 코멘트 |
| **복사 (Copy)** | X (원본 유지) | O (새 Issue) | 원본 + 사본 각각 적립 | 사본에 "Sprint A의 #IS-12 복사본" 시스템 코멘트 |

### 2.3 API 명세

#### (a) 이관
`POST /api/issues/[issueId]/move`
- 권한: MASTER 또는 해당 이슈 assignee
- Body: `{ "targetSprintId": "..." | null }`  (null = 백로그)
- 검증: target sprint가 같은 project에 속해야 함. target sprint status가 `COMPLETED`면 거부 (400, "완료된 스프린트로는 이관할 수 없습니다").
- 시스템 코멘트 1건 자동 생성 (`type: "MOVE"`, `fromStatus`/`toStatus`에 sprintId 기록).

#### (b) 복사
`POST /api/issues/[issueId]/copy`
- 권한: MASTER 또는 해당 이슈 creator
- Body: `{ "targetSprintId": "..." | null, "resetStatus": true }`
- 동작:
  - 신규 Issue insert: `title, description, priority, points, assigneeId, reviewerId, projectId` 복사
  - `status` = `resetStatus ? READY : 원본 status`
  - `creatorId` = 호출자
  - `order` = target sprint(또는 백로그) 최대 order + 1
- 시스템 코멘트(`type: "COPY"`) 신·구 양쪽에 1건씩.
- 응답: `{ data: { issue } }` (새 이슈)

### 2.4 UI/UX
- 이슈 디테일 패널 우상단 케밥 메뉴에 "이관" / "복사" 항목.
- 이관: 단일 선택 모달(스프린트/백로그 목록, COMPLETED 제외).
- 복사: 동일 모달 + "상태 초기화(READY)" 체크박스(기본 ON).
- 백로그/스프린트 뷰의 다중 선택 시 일괄 이관 지원(복사는 단건만 — UX 단순화).

---

## 3. 스프린트 삭제

### 3.1 목적
잘못 만든 PLANNING 스프린트를 정리. ACTIVE/COMPLETED는 회고/통계 보존을 위해 삭제 금지.

### 3.2 정책
- 삭제 가능 조건: `Sprint.status === "PLANNING"` AND 호출자 `role === "MASTER"`
- 삭제 시 동작: 소속 이슈는 `sprintId = null` (백로그 이동). Prisma 스키마의 `onDelete: SetNull` 활용. 단, **명시적으로 트랜잭션 내에서 update 후 delete** 하여 audit 코멘트 남김(`type: "SPRINT_DELETED"`).

### 3.3 API
`DELETE /api/projects/[projectId]/sprints/[sprintId]`
- 200: `{ data: { deleted: true, movedIssueCount: N } }`
- 403: 권한 부족 / 409: `"PLANNING 상태의 스프린트만 삭제할 수 있습니다"` (status가 ACTIVE/COMPLETED인 경우)

### 3.4 UI/UX
- 웹: 스프린트 카드 우상단 메뉴 → "삭제". 확인 다이얼로그(이슈 N개가 백로그로 이동됨 안내).
- 모바일: 스프린트 상세 헤더 메뉴 → "삭제".
- PLANNING이 아니면 메뉴 항목 자체를 숨기거나 disabled + 툴팁.

---

## 4. 가족 이름 설정 (MASTER only)

### 4.1 목적
가족별 식별성을 강화. 사이드바/설정 화면에서 누가 봐도 어느 가족인지 인지 가능.

### 4.2 API
`PATCH /api/families/[familyId]`
- 권한: MASTER
- Body: `{ "name": "string (1~30자, trim 후 빈문자열 금지)" }`
- 응답: `{ data: family }`
- 검증: 30자 초과 / 빈 문자열 시 400.

### 4.3 UI/UX

#### 웹 (`src/components` 사이드바)
- 사이드바 최상단 가족명 표시 옆 연필 아이콘(MASTER에게만 노출).
- 클릭 시 inline edit 또는 작은 모달. 저장 시 TanStack Query invalidate `['family', familyId]`.

#### 모바일 (`familysync-mobile/app/(tabs)/settings` 가정)
- 설정 화면 최상단 "가족" 섹션에 가족명 표시 + MASTER만 우측 화살표/편집 노출.
- 편집 화면: TextInput + 저장 버튼 (헤더 우측).

### 4.4 권한 처리
- 비-MASTER가 PATCH 호출 시 403. UI에서도 편집 entry point 숨김.

---

## 5. 대시보드 스프린트 필터

### 5.1 목적
대시보드는 현재 누적 기준이라 활성 스프린트의 현황 파악이 어렵다. 기본값을 "현재 활성 스프린트"로 잡고, 사용자가 "전체 누적"으로 토글 가능하게 한다.

### 5.2 API
`GET /api/projects/[projectId]/dashboard?scope=active|all|sprint&sprintId=...`
- `scope=active` (기본): 현재 `Sprint.status = ACTIVE`인 스프린트 1건의 이슈만 집계. 활성 스프린트가 없으면 빈 결과 + `meta.empty = "NO_ACTIVE_SPRINT"`.
- `scope=all`: 프로젝트 전체 누적.
- `scope=sprint&sprintId=...`: 특정 스프린트 단건.
- 응답에 `meta.scope`, `meta.sprint`(해당 시) 동봉.

### 5.3 집계 지표 (현 화면과 동일 + 확장)
- 총 포인트 / 완료 포인트 / 진행률
- 멤버별 포인트 (assignee 기준, FAILED 제외 또는 별도 표기)
- 상태별 이슈 수 (FAILED 카테고리 추가)
- (신규) 스프린트 완료율(완료된 이슈 수 / 전체 이슈 수)

### 5.4 UI/UX
- 대시보드 상단에 세그먼트 컨트롤: `[활성 스프린트] [전체] [특정 스프린트 ▾]`
- 기본값 활성. 활성 스프린트 없을 시 "활성 스프린트가 없습니다 — 전체 보기로 전환" 안내 + 자동 fallback 버튼.
- 모바일 동일 패턴(상단 chip 그룹).

---

## 6. PM 추가 제안 (Backlog 아이디어)

| # | 제안 | 가치 | 난이도 | 비고 |
|---|---|---|---|---|
| P1 | **스프린트 회고(Retrospective) 노트** — COMPLETED 시 모달에서 "잘된 점/개선점/액션" 3필드 저장, Sprint에 `retrospective: Json?` 추가 | 가족 학습 루프 형성, FAILED 처리와 자연스럽게 연결 | ★★☆ | DB 1필드 + 1엔드포인트로 PoC 가능 |
| P2 | **반복 이슈 템플릿(Recurring Issue)** — 매주/매월 자동 생성. "이번 주 청소" 같은 류. `IssueTemplate` 모델 + cron(Vercel Cron / Supabase scheduled function) | 복사 기능의 자동화 버전, 반복 작업 마찰 제거 | ★★★ | 스케줄러 인프라 필요, 알림 연동 |
| P3 | **번다운 차트** — 스프린트 기간 동안 잔여 포인트 일자별 추이. Issue 상태 변경 시 snapshot 저장 (`SprintBurnSnapshot` 모델) | 진척 가시화, 회고 자료 | ★★☆ | snapshot 적재 전략(이벤트 vs 일배치) 결정 필요 |
| P4 | **알림: 스프린트 종료 D-1 / 미완료 경고** — 기존 PushSubscription 재활용, MASTER에게 종료 전날 미완료 N건 푸시 | FAILED 누적 방지, MyTask 푸시 인프라 재사용 | ★☆☆ | 가장 가벼움, 빠른 ROI |
| P5 | **이슈 의존성(blocked by)** — `Issue.blockedById` self relation. 차단된 이슈는 READY로 못 옮김 | 복잡한 가족 프로젝트(이사·여행) 시 유용 | ★★☆ | UI(그래프/리스트 뱃지)가 핵심 비용 |

추천 우선순위: **P4 → P1 → P3 → P2 → P5**

---

## 7. 마이그레이션·롤아웃 순서 (에이전트 작업 순)

1. `sprint-db-agent`
   - `IssueStatus`에 `FAILED` 추가
   - `@@index([sprintId, status])` 추가
   - `prisma migrate dev --name add_failed_and_sprint_indexes`
2. `sprint-api-agent`
   - `/sprints/[sprintId]/incomplete` GET
   - `/sprints/[sprintId]/complete` POST 확장 (carryOver)
   - `/sprints/[sprintId]` DELETE 정책 강화
   - `/issues/[issueId]/move`, `/issues/[issueId]/copy` POST
   - `/families/[familyId]` PATCH
   - `/projects/[projectId]/dashboard` scope 파라미터
3. `sprint-web-ui-agent`
   - 완료 모달, 이관/복사 메뉴, 삭제 다이얼로그, 사이드바 가족명 편집, 대시보드 세그먼트
4. `sprint-mobile-ui-agent`
   - 완료 BottomSheet, 이관/복사 액션시트, 설정 가족명 편집, 대시보드 chip

각 단계 완료 후 `_workspace/`에 `01_db.md`, `02_api.md`, `03_web.md`, `04_mobile.md` 작업 노트 산출.

---

## 8. 비기능 요구사항

- **권한 가드**: 모든 변경 API는 `getSessionUser` + family membership + 필요 시 MASTER 체크.
- **트랜잭션**: 완료(carryOver), 복사(코멘트 동반), 삭제(코멘트 + cascade)는 `prisma.$transaction` 필수.
- **i18n**: 모든 사용자 노출 문구는 한국어. 토스트 메시지는 동사형 종결("이관했어요", "삭제했어요").
- **테스트**: 핵심 시나리오 — (a) FAILED carryOver 3종 동작, (b) PLANNING 외 sprint delete 거부, (c) MASTER 권한 가드, (d) 대시보드 scope=active fallback.

---

끝.
