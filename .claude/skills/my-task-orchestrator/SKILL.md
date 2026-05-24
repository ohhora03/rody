---
name: my-task-orchestrator
description: "MyTask 기능 전체 구현을 오케스트레이션. Phase 1(DB/API/UI)과 Phase 2(푸시 알림) 에이전트 팀을 순서대로 실행. 'MyTask 구현', '내 할 일 기능', 'my-task 시작', '다시 실행', '재실행', '업데이트', 'Phase 1 실행', 'Phase 2 실행' 요청 시 반드시 이 스킬을 사용할 것."
---

## 실행 모드
**파이프라인 + 팬아웃 하이브리드**
- Phase 1-A: db-architect (순차, 단독)
- Phase 1-B: api-builder + ui-builder (병렬 팬아웃, db 완료 후)
- Phase 1-C: qa-validator (팬인, 1-B 완료 후)
- Phase 2: push-engineer (순차, Phase 1 QA 통과 후)
- Phase 2-QA: qa-validator (Phase 2 완료 후)

## Phase 0: 컨텍스트 확인

```
_workspace/ 존재 여부 확인:
- 없음 → 초기 실행
- 있음 + 사용자가 특정 단계만 재실행 요청 → 부분 재실행
- 있음 + 새로운 요청 → _workspace/ → _workspace_prev/ 이동 후 새 실행
```

파일 체크:
- `_workspace/01_db_done.md` → db 완료 여부
- `_workspace/02_api_done.md` → api 완료 여부
- `_workspace/03_ui_done.md` → ui 완료 여부
- `_workspace/04_push_done.md` → push 완료 여부

## Phase 1-A: DB 스키마

**에이전트**: db-architect
**스킬**: my-task-db
**실행 모드**: 서브 에이전트 (단독 작업)

```
Agent(
  subagent_type: "general-purpose",
  model: "opus",
  prompt: "db-architect 에이전트로서 작업한다. 
           [에이전트 정의 파일: /Users/rody/Desktop/familysync/.claude/agents/db-architect.md 읽기]
           [스킬 파일: /Users/rody/Desktop/familysync/.claude/skills/my-task-db/SKILL.md 읽기]
           두 파일을 읽고 지시에 따라 Prisma 스키마를 업데이트하고 DB에 반영한다."
)
```

완료 조건: `_workspace/01_db_done.md` 존재

## Phase 1-B: API + UI (병렬)

**에이전트**: api-builder + ui-builder
**실행 모드**: 서브 에이전트 병렬 (run_in_background)

api-builder 프롬프트:
```
에이전트 정의: .claude/agents/api-builder.md
스킬: .claude/skills/my-task-api/SKILL.md
입력: _workspace/01_db_done.md
작업: MyTask CRUD API + Push 구독 API 구현
```

ui-builder 프롬프트:
```
에이전트 정의: .claude/agents/ui-builder.md
스킬: .claude/skills/my-task-ui/SKILL.md
입력: _workspace/02_api_done.md (api-builder가 작성 완료 후 읽기)
작업: MyTask 모바일 UI 구현
```

> ui-builder는 api-builder의 `02_api_done.md` 완성을 기다려야 한다.
> 순차 실행이 더 안전하면 api-builder 완료 후 ui-builder를 실행한다.

완료 조건: `_workspace/02_api_done.md` + `_workspace/03_ui_done.md` 존재

## Phase 1-C: QA 검증

**에이전트**: qa-validator
**스킬**: my-task-qa
**실행 모드**: 서브 에이전트

```
에이전트 정의: .claude/agents/qa-validator.md
스킬: .claude/skills/my-task-qa/SKILL.md
입력: _workspace/01_db_done.md, _workspace/02_api_done.md, _workspace/03_ui_done.md
작업: Phase 1 검증 체크리스트 실행
```

QA 결과에 버그가 있으면:
- 해당 에이전트(api-builder 또는 ui-builder)를 재호출하여 수정
- 수정 후 QA 재실행 (최대 2회)

## Phase 2: 푸시 알림

Phase 1 QA 통과 후 실행.

**에이전트**: push-engineer
**스킬**: my-task-push
**실행 모드**: 서브 에이전트

```
에이전트 정의: .claude/agents/push-engineer.md
스킬: .claude/skills/my-task-push/SKILL.md
입력: _workspace/02_api_done.md
작업: VAPID, 서비스워커 push, Cron, 설정 UI 구현
```

완료 조건: `_workspace/04_push_done.md` 존재

## Phase 2-QA

qa-validator를 재실행하여 Phase 2 체크리스트 검증.

## 에러 핸들링
- `prisma db push` 실패: db-architect에게 재시도 요청 (최대 1회)
- TypeScript 오류: 해당 에이전트에게 수정 요청
- QA 2회 재시도 후 실패: `_workspace/05_qa_report.md`에 미해결 항목 기록 후 사용자에게 보고

## 데이터 흐름
```
db-architect → 01_db_done.md
    ↓
api-builder → 02_api_done.md
    ↓
ui-builder → 03_ui_done.md
    ↓
qa-validator → 05_qa_report.md (Phase 1)
    ↓
push-engineer → 04_push_done.md
    ↓
qa-validator → 05_qa_report.md (Phase 2 추가)
```

## 테스트 시나리오

### 정상 흐름
1. `_workspace/` 없음 → 초기 실행
2. db-architect가 schema.prisma 수정 + prisma db push 성공
3. api-builder가 4개 엔드포인트 구현
4. ui-builder가 my-tasks 페이지 + 네비게이션 탭 추가
5. qa-validator가 tsc --noEmit 통과 확인
6. push-engineer가 sw.js + cron + 설정 UI 구현

### 에러 흐름
1. prisma db push 실패 → 스키마 수정 후 재시도 → 재실패 시 `01_db_error.md` 작성 후 중단
2. tsc 오류 발견 → 해당 에이전트 수정 요청 → 재검증
