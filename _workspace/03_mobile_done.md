# 03_mobile_done — sprint-mobile-ui-agent 작업 결과

- 작성일: 2026-05-24
- 작성자: sprint-mobile-ui-agent
- 선행: `_workspace/01_db_done.md`, `_workspace/02_api_done.md`
- 검증: `npx tsc --noEmit` — `src/app/m/` 신규 에러 0건

---

## 1. 수정 파일

| 파일 | 변경 요약 |
|---|---|
| `src/app/m/_components/StatusBadge.tsx` | `FAILED` 상태 추가 (label "실패", bg `#fef2f2`, color `#dc2626`) + 타입에 FAILED 포함 |
| `src/app/m/_components/IssueModal.tsx` | `IssueStatus`에 `FAILED` 추가, `STATUS_CONFIG`에 FAILED 매핑(라벨/색상) |
| `src/app/m/_lib/api.ts` | `completeSprint` 시그니처에 body 옵션(`failedAction`, `targetSprintId`) 추가, 신규 헬퍼 `deleteSprint`, `transferIssue`, `updateFamily`, `sprintsWithIssues` 추가 |
| `src/app/m/sprint/page.tsx` | 스프린트 완료 → FAILED 처리 바텀시트, PLANNING 스프린트 삭제 버튼/확인 모달, 이슈 이관/복사 선택 모달 |
| `src/app/m/dashboard/page.tsx` | 스프린트 필터 드롭다운(active/all/특정 스프린트) 및 필터 적용 이슈 집계 |
| `src/app/m/settings/page.tsx` | 가족 이름 인라인 편집(MASTER 전용 연필 아이콘 → input + 저장/취소) |

---

## 2. 주요 변경 사항

### 2.1 StatusBadge / IssueModal — FAILED 라벨
- 두 컴포넌트의 `IssueStatus` 유니언에 `FAILED` 추가, 색상은 REJECTED와 유사한 레드 톤(`#dc2626`)으로 통일.
- 라벨은 "실패".

### 2.2 스프린트 완료 시 FAILED 이관 모달 (`m/sprint/page.tsx`)
- 패턴: PRD §1.4의 권장 시퀀스 ("완료 클릭 → 모달 → 선택 → 한 번 더 POST") 채택.
- 1차 호출(`completeProbeMutation`): body 없이 `completeSprint` 호출 → API는 진행 중 이슈 HOLD 처리하고 `failedIssues` 동봉(API 명세 §1).
  - `failedIssues.length === 0` → 바로 캐시 무효화하고 종료.
  - `failedIssues.length > 0` → 바텀시트 모달 오픈.
- 모달 액션:
  - **다음 스프린트로 이관**: `sortedSprints`에서 `status === "PLANNING"`인 첫 스프린트를 자동 선택. 없으면 disabled + "이관할 PLANNING 스프린트가 없어요" 에러.
  - **백로그로 이동**: `failedAction: "backlog"`.
  - **그대로 두기 (보류 처리)**: `failedAction: null` — 기존 1차 호출이 이미 처리한 상태 유지.
  - **취소**: 모달만 닫음(서버는 이미 1차 호출로 COMPLETED 전환됨에 주의 — 향후 `GET /incomplete` 분리 시 개선 가능).
- 2차 호출(`completeFinalMutation`)이 같은 sprint에 대해 한 번 더 POST하지만 API가 멱등적으로 처리(`failedAction` 따라 미완료 이슈 재배치).

### 2.3 스프린트 삭제 버튼
- 확장된 카드의 액션 영역에 `PLANNING` 상태일 때만 빨간 테두리 "스프린트 삭제" 버튼 표시(MASTER 전용).
- 클릭 시 가운데 모달로 확인 다이얼로그("이슈는 백로그로 이동돼요. 되돌릴 수 없어요").
- 확인 시 `DELETE /api/projects/[projectId]/sprints/[sprintId]` 호출 → 성공 시 `m-home` 무효화 및 확장 상태 초기화.

### 2.4 이관 vs 복사 선택 모달
- 기존 "스프린트 이동 바텀시트"에서 백로그가 아닌 **다른 스프린트** 선택 시, 곧바로 이동하지 않고 가운데 모달로 분기 선택.
  - **이관(Move)**: `POST /sprints/[currentSprintId]/transfer` `{ mode: "transfer" }` → 원본 이슈의 sprintId만 이동, 상태 READY로 리셋.
  - **복사(Copy)**: `{ mode: "copy" }` → 신규 이슈 생성(타이틀/설명/우선순위/포인트/담당자/리뷰어 복사, 상태 READY).
- 백로그 이동은 기존 `patchIssue({ sprintId: null })` 그대로 유지(API 명세에 transfer는 sprint↔sprint만 정의됨).

### 2.5 대시보드 스프린트 필터
- 헤더 아래에 `<select>` 드롭다운 배치. 기본값 `"active"`.
- 옵션: `활성 스프린트`(homeIssues), `전체 누적`(모든 스프린트 issues flat), `각 스프린트(상태 표시 포함)`.
- 데이터 소스:
  - active → `data.issues`(home 응답에 이미 포함된 active sprint 이슈).
  - all/특정 → 신규 `GET /api/projects/[projectId]/sprints?includeIssues=true` 사용(`sprintsWithIssues` 헬퍼).
- 필터링된 `issues`를 그대로 기존 통계(전체/진행중/완료/달성률)와 멤버 그룹핑에 사용 — 추가 컴포넌트 변경 없음.

### 2.6 가족 이름 편집 (settings)
- "가족 그룹 → 그룹 이름" 행에서 MASTER이면 이름 옆 연필 아이콘 표시.
- 클릭 시 input(`maxLength=30`) + 체크/X 버튼으로 인라인 전환.
- 저장: `PATCH /api/families/[familyId]` 호출 → 성공 시 `m-families`, `m-home` 쿼리 무효화로 앱 전반(사이드바·대시보드 헤더 등) 동기화.
- 빈 문자열 클라이언트 가드, 서버 응답에 `error` 있으면 우측 정렬 에러 메시지 노출.

---

## 3. 비-MASTER 동선
- 스프린트 페이지: 기존대로 시작/완료/삭제 액션 영역(`isMaster` 가드 내부)에서만 노출되므로 삭제 버튼도 자동 숨김.
- 설정 페이지: 가족 이름 옆 연필 아이콘 자체 미표시. 비-MASTER가 강제로 PATCH 호출해도 API 측 403 가드 + 에러 메시지 노출.

---

## 4. 미완료/후속 작업

1. **완료 1차 호출의 사이드이펙트** — 현재 API는 첫 POST에서 이미 `Sprint.status = COMPLETED`로 전환(`02_api_done.md` 명세). 사용자가 모달에서 "취소"를 누르면 스프린트는 이미 완료된 상태로 남음. 향후 API 측에 `GET /incomplete` 별도 엔드포인트가 추가되면 1차 호출을 readonly probe로 교체 권장(파일 내 주석으로 표시).
2. **이슈 디테일에서의 이관/복사** — `IssueModal` 우상단 케밥 메뉴 미구현. 현재 sprint 페이지의 인라인 MoveRight 버튼으로 동일 기능 접근 가능.
3. **대시보드 `scope=active|all|sprint` API 파라미터** — `02_api_done.md`에는 dashboard 엔드포인트 변경 미포함. 클라이언트 사이드 필터링으로 대체(전체 스프린트 이슈 fetch). 데이터 크기가 커지면 서버 측 집계 API 추가 권장.
4. **타입 일관성** — `IssueStatus` 유니언이 `m/sprint/page.tsx`, `m/dashboard/page.tsx`, `_components/StatusBadge.tsx`, `_components/IssueModal.tsx`에 중복 정의됨. 공통 타입 파일로 추출하는 리팩터링은 본 범위 밖.
5. **FAILED 시각 강화** — PRD §1.5의 "취소선 + 회색 톤다운"은 미적용(현재는 빨간 배지만). 필요 시 `TaskItem`에 `textDecoration: "line-through"` 분기 추가.

---

## 5. 검증
- `npx tsc --noEmit` 통과(`src/app/m/` 범위 신규 에러 0건).
- 기능 단위 테스트는 수동 검증 필요(개발 서버 `npm run dev`).

끝.
