---
name: sprint-prd
description: "FamilySync 스프린트 기능 요구사항 분석 및 PRD 작성. 실패 상태, 이관/복사, 스프린트 삭제, 가족명, 대시보드 필터 등 스프린트 관련 기능 확장 요청 시 PM 분석에 사용."
---

## 분석 대상 기능

### 1. FAILED 상태 + 이관 UI
- 현재: REJECTED(반려) 상태만 존재
- 변경: FAILED(실패) 상태 추가 — 과제를 시도했으나 완수 못한 경우
- 스프린트 완료 시 FAILED 과제가 있으면 이관 선택 UI 표시
- 선택: "다음 스프린트로 이관" / "백로그로 이동"

### 2. 이관 vs 복사
- 이관(Transfer): 기존 Issue를 다른 스프린트로 그냥 옮김 → 포인트 중복 불가
- 복사(Copy): 내용만 복사하여 새 Issue 생성 → 포인트 새로 적립 가능
- 적용 시점: 완료/실패된 과제를 새 스프린트에 추가할 때

### 3. 스프린트 삭제
- PLANNING 상태 스프린트만 삭제 가능 (ACTIVE는 먼저 완료해야)
- 삭제 시 소속 이슈들은 백로그로 이동 (sprintId → null)
- 확인 다이얼로그 필수

### 4. 가족 이름 설정
- MASTER 역할만 변경 가능
- 변경 위치: 모바일 설정 페이지 + 웹 사이드바
- 변경 후 앱 전반의 가족명 즉시 반영

### 5. 대시보드 스프린트 필터
- 기본값: 활성(ACTIVE) 스프린트 통계
- 전체 선택: 모든 스프린트 누적 포인트/과제 합산
- 스프린트별 드롭다운 선택도 가능하면 추가

## DB 변경 명세
```
enum IssueStatus {
  READY
  IN_PROGRESS
  RESOLVED
  CLOSED
  REJECTED
  HOLD
  FAILED  ← 추가
}
```

## API 명세
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/projects/[id]/sprints/[id]/complete | body: { failedAction: "next-sprint"\|"backlog", targetSprintId?: string } |
| POST | /api/projects/[id]/sprints/[id]/issues/transfer | body: { issueId, mode: "transfer"\|"copy", targetSprintId } |
| DELETE | /api/projects/[id]/sprints/[id] | PLANNING만 가능, 이슈 백로그 이동 |
| PATCH | /api/families/[id] | body: { name: string }, MASTER만 |
| GET | /api/projects/[id]/sprints | 기존 + ?includeIssues=true 파라미터 추가 |

## PM 추가 제안
| 기능 | 이유 | 난이도 |
|------|------|--------|
| 스프린트 Velocity 추적 | 스프린트별 완료 포인트 추이 그래프 | 보통 |
| 스프린트 Capacity 설정 | 목표 포인트 설정하고 달성률 표시 | 간단 |
| 완료 축하 애니메이션 | 가족 앱 특성 상 게임화 요소 | 간단 |
| 이슈 히스토리 | 어떤 스프린트를 거쳤는지 이력 | 복잡 |
| 스프린트 회고 메모 | 완료 시 한 마디 남기는 기능 | 간단 |
