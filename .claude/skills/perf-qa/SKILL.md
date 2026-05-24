---
name: perf-qa
description: "FamilySync 성능 최적화 후 검증. TypeScript 컴파일, Next.js 빌드, 코드 패턴 교차 확인. 성능 개선 완료 후 QA 단계에서 반드시 사용."
---

## 검증 절차

### Step 1: TypeScript 컴파일
```bash
cd /Users/rody/Desktop/familysync && npx tsc --noEmit 2>&1
```
오류 없으면 PASS. 오류 있으면 파일/줄 특정 후 해당 에이전트에 수정 요청.

### Step 2: Next.js 빌드
```bash
cd /Users/rody/Desktop/familysync && npm run build 2>&1 | tail -40
```
빌드 성공하면 PASS.

### Step 3: 핵심 코드 패턴 확인

**DB 최적화 확인:**
```bash
# Promise.all 적용 확인
grep -n "Promise.all" /Users/rody/Desktop/familysync/src/lib/mobile-home.ts

# 직렬 await 잔존 여부
grep -n "const.*await prisma" /Users/rody/Desktop/familysync/src/lib/mobile-home.ts

# connection_limit 확인
grep "connection_limit" /Users/rody/Desktop/familysync/.env /Users/rody/Desktop/familysync/.env.local 2>/dev/null

# DIRECT_URL 확인
grep "DIRECT_URL" /Users/rody/Desktop/familysync/.env.local
```

**프론트 최적화 확인:**
```bash
# refetchOnWindowFocus 설정
grep -n "refetchOnWindowFocus" /Users/rody/Desktop/familysync/src/components/providers.tsx

# staleTime 전역 설정
grep -n "staleTime" /Users/rody/Desktop/familysync/src/components/providers.tsx
```

### Step 4: 보고서 작성
`_workspace/03_qa_report.md`에 각 항목 PASS/FAIL + 총평 기록.

## 합격 기준
- tsc --noEmit: 오류 없음
- npm run build: 성공
- Promise.all: mobile-home.ts에 존재
- refetchOnWindowFocus: false 설정됨
- DIRECT_URL: .env.local에 존재
