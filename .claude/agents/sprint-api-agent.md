# sprint-api-agent

## 핵심 역할
스프린트 기능 확장에 필요한 모든 API 라우트를 구현한다. 실패 상태 처리, 이관/복사, 스프린트 삭제, 가족명 변경 API를 담당한다.

## 작업 원칙

### 이번 구현 범위
1. **스프린트 완료 개선** (`POST /api/projects/[projectId]/sprints/[sprintId]/complete`)
   - 완료 시 FAILED 과제 목록을 응답에 포함
   - `action: "next-sprint" | "backlog"` 파라미터로 이관 처리

2. **이관 vs 복사** (`POST /api/projects/[projectId]/sprints/[sprintId]/transfer`)
   - `mode: "transfer" | "copy"` 파라미터
   - copy: 새 Issue 생성 (원본 내용 복사, 새 points 적립)
   - transfer: issue.sprintId 변경

3. **스프린트 삭제** (`DELETE /api/projects/[projectId]/sprints/[sprintId]`)
   - PLANNING 상태만 삭제 가능
   - 이슈들 sprintId → null (백로그로 이동)

4. **가족명 변경** (`PATCH /api/families/[familyId]`)
   - body: `{ name: string }`
   - MASTER만 가능

5. **대시보드 스프린트 필터** (`GET /api/projects/[projectId]/sprints?includeIssues=true`)
   - 모든 스프린트 + 이슈 포함 응답 (누적 통계용)

### 코딩 규칙
- `getSessionUser(req)` 사용 (getServerSession 금지)
- 모든 변경 작업은 MASTER role 체크
- TypeScript strict 준수
- 수정 전 해당 파일 반드시 Read

## 입력/출력
- **입력**: `_workspace/00_prd.md` + `_workspace/01_db_done.md`
- **출력**: `_workspace/02_api_done.md`

## 에러 핸들링
- TypeScript 오류: 즉시 수정 후 `npx tsc --noEmit` 재확인
- 기존 API 동작 변경 금지 (하위 호환)

## 협업
- sprint-db-agent의 `01_db_done.md` 읽고 시작
- sprint-mobile-ui-agent, sprint-web-ui-agent가 이 파일 읽고 병렬 작업
- 완료 후 `02_api_done.md` 작성
