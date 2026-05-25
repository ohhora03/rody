---
name: sprint-orchestrator
description: "FamilySync 스프린트 기능 확장 전체 오케스트레이션. '스프린트 수정', '실패 상태', '이관', '복사', '스프린트 삭제', '가족 이름', '대시보드 필터', '스프린트 기능', '다시 실행', '재실행', '업데이트', '스프린트 개선' 요청 시 반드시 이 스킬을 사용할 것."
---

## 실행 모드
**파이프라인 + 팬아웃 하이브리드 (서브 에이전트)**
- Phase 0: pm-agent (단독, PRD 작성)
- Phase 1: sprint-db-agent (단독, DB 변경)
- Phase 2A: sprint-api-agent (단독, API)
- Phase 2B: sprint-mobile-ui-agent + sprint-web-ui-agent (병렬)
- Phase 3: qa-validator (팬인)

## Phase 0: 컨텍스트 확인

```
_workspace/ 존재 여부:
- 없음 → 초기 실행
- 있음 + 부분 재실행 요청 → 해당 Phase만 재실행
- 있음 + 새 요청 → _workspace/ → _workspace_prev/ 이동 후 새 실행
```

파일 체크:
- `_workspace/00_prd.md` → PM 분석 완료
- `_workspace/01_db_done.md` → DB 완료
- `_workspace/02_api_done.md` → API 완료
- `_workspace/03_mobile_done.md` → 모바일 UI 완료
- `_workspace/04_web_done.md` → 웹 UI 완료
- `_workspace/05_qa_report.md` → QA 완료

## Phase 1: PM 분석

```
Agent(
  subagent_type: "general-purpose",
  model: "opus",
  prompt: "pm-agent로서 작업한다.
           [에이전트: .claude/agents/pm-agent.md]
           [스킬: .claude/skills/sprint-prd/SKILL.md]
           
           사용자 요청:
           - FAILED 상태 추가 + 스프린트 완료 시 이관 선택
           - 이관 vs 복사 (포인트 적립 차이)
           - 스프린트 삭제
           - 가족 이름 설정
           - 대시보드 스프린트 필터 (기본: 활성, 전체: 누적)
           - PM 추가 제안
           
           현재 코드: /Users/rody/Desktop/familysync/prisma/schema.prisma 읽기
           출력: _workspace/00_prd.md"
)
```

## Phase 2: DB 변경

```
Agent(
  subagent_type: "general-purpose",
  model: "opus",
  prompt: "sprint-db-agent로서 작업한다.
           [에이전트: .claude/agents/sprint-db-agent.md]
           [입력: _workspace/00_prd.md]
           
           1. /Users/rody/Desktop/familysync/prisma/schema.prisma 읽기
           2. IssueStatus enum에 FAILED 추가
           3. npx prisma db push && npx prisma generate 실행
           출력: _workspace/01_db_done.md"
)
```

## Phase 3: API 구현

```
Agent(
  subagent_type: "general-purpose",
  model: "opus",
  prompt: "sprint-api-agent로서 작업한다.
           [에이전트: .claude/agents/sprint-api-agent.md]
           [스킬: .claude/skills/sprint-api/SKILL.md]
           [입력: _workspace/01_db_done.md]
           
           프로젝트: /Users/rody/Desktop/familysync/
           구현할 API:
           1. complete/route.ts 수정 (FAILED 이관)
           2. transfer/route.ts 신규 (이관/복사)
           3. sprints/[id]/route.ts에 DELETE 추가
           4. families/[id]/route.ts에 PATCH 추가
           5. sprints/route.ts GET에 includeIssues 파라미터
           출력: _workspace/02_api_done.md"
)
```

## Phase 4: UI 병렬 구현

두 에이전트를 동시에 실행 (파일 겹침 없음):

**모바일:**
```
Agent(
  subagent_type: "general-purpose",
  model: "opus",
  run_in_background: true,
  prompt: "sprint-mobile-ui-agent로서 작업한다.
           [에이전트: .claude/agents/sprint-mobile-ui-agent.md]
           [스킬: .claude/skills/sprint-ui/SKILL.md]
           [입력: _workspace/02_api_done.md]
           
           수정 대상 (/src/app/m/ 하위만):
           - sprint/page.tsx: 완료 이관 모달, 이관/복사, 삭제 버튼
           - dashboard/page.tsx: 스프린트 필터
           - settings/page.tsx: 가족명 편집
           - _components/StatusBadge.tsx: FAILED 뱃지
           출력: _workspace/03_mobile_done.md"
)
```

**웹:**
```
Agent(
  subagent_type: "general-purpose",
  model: "opus",
  run_in_background: true,
  prompt: "sprint-web-ui-agent로서 작업한다.
           [에이전트: .claude/agents/sprint-web-ui-agent.md]
           [스킬: .claude/skills/sprint-ui/SKILL.md]
           [입력: _workspace/02_api_done.md]
           
           수정 대상 (/src/app/(dashboard)/ 및 /src/components/ 하위만):
           - projects/[id]/sprints/page.tsx: 완료 이관 모달, 삭제 버튼
           - projects/[id]/sprint/[id]/page.tsx: 이관/복사
           - projects/[id]/dashboard/page.tsx: 스프린트 필터
           - components/layout/sidebar.tsx: 가족명 표시/편집
           - lib/utils.ts: FAILED STATUS_CONFIG
           출력: _workspace/04_web_done.md"
)
```

## Phase 5: QA

```
Agent(
  subagent_type: "general-purpose",
  model: "opus",
  prompt: "qa-validator로서 작업한다.
           [에이전트: .claude/agents/qa-validator.md]
           [입력: 01~04_done.md 전부]
           
           cd /Users/rody/Desktop/familysync
           1. npx tsc --noEmit
           2. npm run build 2>&1 | tail -20
           3. FAILED enum 존재 확인
           4. 주요 API 파일 존재 확인
           출력: _workspace/05_qa_report.md"
)
```

## 에러 핸들링
- DB push 실패: sprint-db-agent 재시도 1회
- tsc 오류: 해당 에이전트 재호출
- QA 2회 실패: 05_qa_report.md에 미해결 기록 후 사용자 보고

## 데이터 흐름
```
pm-agent → 00_prd.md
    ↓
sprint-db-agent → 01_db_done.md
    ↓
sprint-api-agent → 02_api_done.md
    ↓ (병렬)
sprint-mobile-ui-agent → 03_mobile_done.md
sprint-web-ui-agent    → 04_web_done.md
    ↓
qa-validator → 05_qa_report.md
```

## 테스트 시나리오

### 정상 흐름
1. PM이 PRD 작성 + FAILED 추가 제안
2. DB에 FAILED enum 추가
3. complete API에 failedAction 파라미터 처리
4. 모바일/웹 완료 버튼 클릭 시 이관 모달 표시
5. 가족명 편집 및 앱 전반 반영
6. tsc + build PASS

### 에러 흐름
1. prisma db push 실패 → 스키마 수정 후 재시도
2. tsc 오류 → 해당 에이전트 수정 요청
