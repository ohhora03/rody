---
name: perf-orchestrator
description: "FamilySync(ARC) 성능 개선 전체를 오케스트레이션. '느려', '5초', '속도 개선', '성능', 'API 지연', 'DB 최적화', '캐시', 'staleTime', 'Prisma 느려', '로딩 오래 걸려', '퍼포먼스', '다시 개선', '재실행', '업데이트' 요청 시 반드시 이 스킬을 사용할 것."
---

## 실행 모드
**파이프라인 + 팬아웃 하이브리드**
- Phase 0: 컨텍스트 확인 (재실행 vs 초기 실행 판별)
- Phase 1: perf-profiler (단독, 순차)
- Phase 2: db-optimizer + frontend-optimizer (병렬 팬아웃)
- Phase 3: perf-qa (팬인)

## 작업공간
이 하네스의 모든 산출물은 **`_workspace/perf/`** 하위에 기록한다. (`_workspace/` 루트는 sprint·my-task 하네스와 공유되므로 충돌 방지를 위해 전용 하위 폴더를 사용한다.)

## Phase 0: 컨텍스트 확인

```
_workspace/perf/ 존재 여부:
- 없음 → 초기 실행
- 있음 + 부분 재실행 요청 → 해당 Phase만 재실행
- 있음 + 새 요청 → _workspace/perf/ → _workspace/perf_prev/ 이동 후 새 실행
```

파일 체크:
- `_workspace/perf/00_profile_report.md` → 프로파일링 완료 여부
- `_workspace/perf/01_db_done.md` → DB 최적화 완료 여부
- `_workspace/perf/02_frontend_done.md` → 프론트 최적화 완료 여부
- `_workspace/perf/03_qa_report.md` → QA 완료 여부

## Phase 1: 성능 프로파일링

**에이전트**: perf-profiler
**스킬**: perf-profile
**실행 모드**: 서브 에이전트 (단독)

```
Agent(
  subagent_type: "general-purpose",
  model: "opus",
  prompt: "perf-profiler 에이전트로서 작업한다.
           [에이전트 정의: /Users/rody/Desktop/familysync/.claude/agents/perf-profiler.md 읽기]
           [스킬: /Users/rody/Desktop/familysync/.claude/skills/perf-profile/SKILL.md 읽기]
           
           프로젝트 루트: /Users/rody/Desktop/familysync/
           
           다음 파일을 읽고 병목을 진단하라:
           - src/lib/prisma.ts
           - src/lib/mobile-home.ts
           - src/lib/get-session.ts
           - src/lib/auth.ts
           - .env.local
           - .env
           - src/components/providers.tsx
           - src/app/m/dashboard/page.tsx (일부)
           - src/app/m/sprint/page.tsx (일부)
           - src/app/m/my-tasks/page.tsx (일부)
           
           _workspace/perf/ 디렉토리를 만들고 00_profile_report.md에 진단 결과를 기록하라."
)
```

완료 조건: `_workspace/perf/00_profile_report.md` 존재

## Phase 2: DB + 프론트 병렬 최적화

Phase 1 완료 후 두 에이전트를 병렬 실행.

**db-optimizer 프롬프트:**
```
에이전트 정의: .claude/agents/db-optimizer.md
스킬: .claude/skills/db-optimize/SKILL.md
입력: _workspace/perf/00_profile_report.md 읽기
작업: 
  1. .env.local에 DIRECT_URL 추가
  2. src/lib/prisma.ts 정리
  3. src/lib/mobile-home.ts 쿼리 병렬화
  4. 기타 직렬 패턴 수정
출력: _workspace/perf/01_db_done.md
```

**frontend-optimizer 프롬프트:**
```
에이전트 정의: .claude/agents/frontend-optimizer.md
스킬: .claude/skills/frontend-optimize/SKILL.md
입력: _workspace/perf/00_profile_report.md 읽기
작업:
  1. src/components/providers.tsx QueryClient 설정 최적화
  2. 각 페이지 staleTime / enabled 조건 개선
  3. refetchOnWindowFocus: false 설정
출력: _workspace/perf/02_frontend_done.md
```

두 에이전트는 수정 파일이 겹치지 않으므로 완전 병렬 실행 가능.

완료 조건: `_workspace/perf/01_db_done.md` + `_workspace/perf/02_frontend_done.md` 존재

## Phase 3: QA 검증

**에이전트**: perf-qa
**스킬**: perf-qa
**실행 모드**: 서브 에이전트

```
에이전트 정의: .claude/agents/perf-qa.md
스킬: .claude/skills/perf-qa/SKILL.md
입력: _workspace/perf/01_db_done.md, _workspace/perf/02_frontend_done.md
작업: tsc, build, 코드 패턴 교차 확인
출력: _workspace/perf/03_qa_report.md
```

QA 실패 시:
- TypeScript 오류 → 해당 에이전트 재호출 (최대 2회)
- 빌드 실패 → 원인 파악 후 수정 요청

## 에러 핸들링
- db-optimizer 실패: `_workspace/perf/01_db_error.md` 기록 후 QA에서 보고
- frontend-optimizer 실패: `_workspace/perf/02_frontend_error.md` 기록 후 QA에서 보고
- QA 2회 재시도 후 실패: `03_qa_report.md`에 미해결 항목 기록 후 사용자 보고

## 데이터 흐름
```
perf-profiler → 00_profile_report.md
    ↓
db-optimizer → 01_db_done.md
frontend-optimizer → 02_frontend_done.md (병렬)
    ↓
perf-qa → 03_qa_report.md
```

## 테스트 시나리오

### 정상 흐름
1. `_workspace/` 없음 → 초기 실행
2. perf-profiler가 5초 원인을 prisma.ts / mobile-home.ts에서 특정
3. db-optimizer가 커넥션 풀 설정 + 쿼리 병렬화 완료
4. frontend-optimizer가 QueryClient 설정 최적화 완료
5. perf-qa가 tsc + build PASS 확인

### 에러 흐름
1. tsc 오류 발견 → db-optimizer에 수정 요청 → 재검증
2. build 실패 → 원인 파일 특정 → 수정 후 재빌드 확인
