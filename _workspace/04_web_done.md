# 04_web_done — sprint-web-ui-agent 작업 결과

- 작성일: 2026-05-24
- 작성자: sprint-web-ui-agent
- 선행: `01_db_done.md` (FAILED 상태 + 인덱스), `02_api_done.md` (complete 확장 / transfer / DELETE sprint / PATCH family / sprints?includeIssues)
- tsc: `npx tsc --noEmit` 통과 (출력 0, 에러 0).

---

## 1. 수정 파일 목록

| 파일 | 변경 요약 |
|---|---|
| `src/lib/utils.ts` | `STATUS_CONFIG.FAILED` 추가 (label "실패", red-50/red-600). |
| `src/app/(dashboard)/projects/[projectId]/sprints/page.tsx` | 완료 → FAILED 처리 모달, PLANNING 카드 삭제 버튼+확인 모달. |
| `src/app/(dashboard)/projects/[projectId]/sprint/[sprintId]/page.tsx` | sprint 목록 fetch 추가, TaskModal에 `sprintId` / `allSprints` props 전달. |
| `src/components/ticket/task-modal.tsx` | 헤더에 Move 아이콘 버튼, 이관/복사 라디오 + 대상 스프린트 선택 모달, transfer API 호출. |
| `src/app/(dashboard)/projects/[projectId]/dashboard/page.tsx` | 상단 스프린트 필터 드롭다운 (active/all/sprintId), active 없을 시 fallback 배너. |
| `src/components/layout/sidebar.tsx` | 가족 이름 박스, MASTER만 Pencil 편집 버튼, 인라인 input + PATCH `/api/families/[familyId]`. |
| `src/app/(dashboard)/layout.tsx` | Sidebar에 `familyName`, `isMaster` props 전달. |

---

## 2. 주요 변경사항 디테일

### 2.1 utils.ts — FAILED 라벨 매핑
- API agent가 남긴 타입 에러 2건(`sprints/page.tsx`, `task-modal.tsx`의 `STATUS_CONFIG[IssueStatus.FAILED]` 미존재 액세스)이 본 추가로 해소됨.
- task-modal 활동 내역의 `STATUS_CONFIG[entry.fromStatus as keyof typeof STATUS_CONFIG]` 인덱싱이 FAILED 포함하여 자연스럽게 매핑됨 (label/bg/text 모두 표시 OK, 기존 `?? entry.fromStatus` fallback도 유지).

### 2.2 sprints/page.tsx — 완료 시 FAILED 처리 모달
- 흐름:
  1. "스프린트 완료" 클릭 → 단순 confirm("스프린트를 완료하시겠습니까?").
  2. `POST /api/.../complete`를 body `{}`로 1차 호출. 응답의 `failedIssues.length > 0`이면 모달 표시, 0이면 그대로 완료 토스트.
  3. 모달에서 라디오 선택:
     - "다음 스프린트로 이관" → PLANNING 스프린트 드롭다운 노출. 선택 후 `failedAction: "next-sprint"` + `targetSprintId`로 2차 호출.
     - "백로그로 이동" → `failedAction: "backlog"`로 2차 호출.
     - "그대로 두기" → 별도 호출 없음(1차 호출에서 이미 COMPLETED 처리됨), 모달만 닫고 새로고침.
  4. 토스트 ("이관했어요" / "백로그로 이동했어요" / "스프린트가 완료되었습니다").
- 미완료 이슈 리스트는 status 라벨/타이틀/포인트로 표시 (FAILED 라벨도 시각화됨).

### 2.3 sprints/page.tsx — PLANNING 스프린트 삭제
- PLANNING 카드 액션 영역에 `Trash2` 아이콘 버튼 추가. ACTIVE/COMPLETED에는 미표시(API에서 어차피 거부됨).
- 클릭 시 확인 모달 ("정말 이 스프린트를 삭제하시겠습니까? 스프린트에 속한 과제는 백로그로 이동합니다") → `DELETE /api/projects/[projectId]/sprints/[sprintId]` 호출 → 토스트 "스프린트를 삭제했어요" → 목록 새로고침.

### 2.4 task-modal.tsx — 이관 vs 복사
- 헤더에 `Move` 아이콘 버튼 (조건: `isEdit && sprintId && allSprints.length > 0`).
- 모달:
  - 라디오 2개: "이관 — 기존 과제 이동" / "복사 — 새 과제로 추가 (포인트 새로 적립)"
  - 대상 스프린트 select (현재 sprint 제외, COMPLETED 제외, ACTIVE/PLANNING 모두 노출)
  - 적용 시 `POST /api/projects/[projectId]/sprints/[sprintId]/transfer` 호출 `{ issueId, mode, targetSprintId }`
- 단건 처리 한정 (PRD대로 다중 선택 일괄은 미구현 — 후속).

### 2.5 dashboard/page.tsx — 스프린트 필터
- 상단 우측에 select 드롭다운: "활성 스프린트 (이름)" / "전체 누적" / 개별 스프린트 항목.
- 기본값 `active`. 활성 스프린트가 없으면 amber 배너에 "활성 스프린트가 없습니다 [전체 보기로 전환]" 버튼 노출 (PRD §5.4 패턴).
- 모든 통계(요약 카드, 담당자별, 상태별, 우선순위 분포)는 필터링된 `issues` 기반으로 자동 재계산. 스프린트 히스토리 섹션은 그대로 모든 스프린트 노출.
- 주의: 현재는 클라이언트 측 필터링(전체 이슈 fetch 후 sprintId 매칭). API의 `?scope=` 파라미터(`02_api_done.md`에는 미명시, PRD §5에서 제안)는 본 작업 범위 밖이라 미사용.

### 2.6 sidebar.tsx — 가족명 표시/편집
- 로고 영역 바로 아래, "모바일 앱으로 보기" 배너 위에 가족 이름 박스.
- 비편집 상태: "가족 [이름]" + MASTER에게만 `Pencil` 아이콘.
- 편집 상태: 인라인 input + `Check` 저장 버튼. Enter 저장 / Esc 취소. maxLength 30, trim 후 빈문자열 검증.
- `PATCH /api/families/[familyId]` 호출, 성공 시 로컬 state 업데이트 (페이지 리로드 없이 반영).
- `(dashboard)/layout.tsx`에서 `member.family.name` / `member.role === "MASTER"`를 `familyName` / `isMaster` props로 전달.

---

## 3. 알려진 한계 / 후속 작업

- **PRD §1.4 (a) `GET /incomplete` 미사용**: API agent는 1차 complete 호출에서 failedIssues 동봉 후 분기 호출 모델을 채택. 본 UI도 이 흐름을 따름. 결과적으로 "1차 호출 후 그대로 두기"는 별도 API 호출 없이 닫기만 함. 사용자가 모달에서 "나중에"를 누른 경우에도 스프린트는 이미 COMPLETED 상태가 되어 있음 — UX상 자연스럽긴 하지만 "취소" 의미가 약함. 정확한 취소가 필요하면 별도 GET `/incomplete` 추가 + 흐름 분리 필요.
- **PRD §2.4 다중 선택 일괄 이관**: 단건만 구현. 백로그/스프린트 뷰의 멀티셀렉트 UI 자체가 현 코드베이스에 없으므로 후속 작업.
- **PRD §5.2 dashboard API scope 파라미터**: 클라이언트 측 필터링으로 처리. 대규모 데이터 시 API 측 집계가 필요하면 후속 작업.
- **PRD §5.3 멤버별 포인트 FAILED 제외 표기**: 현재 멤버별 통계는 status별 분기 없이 totalPts에 합산 — FAILED를 별도 카테고리로 빼서 표기하는 시각화는 미구현. 상태별 분포 섹션에 "실패" 라벨(red)로 카운트만 표기됨.
- **스프린트 카드 메뉴 시스템**: PRD §3.4의 케밥 메뉴 대신, PLANNING 카드 액션 영역에 직접 버튼 노출하는 더 단순한 UX 채택.

끝.
