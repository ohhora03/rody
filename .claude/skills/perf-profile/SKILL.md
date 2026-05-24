---
name: perf-profile
description: "FamilySync(ARC) 앱의 성능 병목을 진단하는 스킬. API 응답 5초 지연, DB 커넥션 지연, Prisma 쿼리 과다, 프론트 직렬 fetch 등 성능 문제 원인을 특정한다."
---

## 목표
API 호출이 5초씩 걸리는 원인을 코드 분석으로 특정하고, 수정 우선순위를 산출한다.

## 진단 체크리스트

### 1. DB 커넥션 설정 확인
파일: `src/lib/prisma.ts`, `.env`, `.env.local`

```
확인 항목:
- DATABASE_URL에 connection_limit=1 포함 여부 (Supabase + serverless 필수)
- DIRECT_URL이 .env.local에 존재하는지
- PrismaClient 생성 옵션에 불필요한 datasources 오버라이드 여부
- 싱글턴 패턴 작동 여부 (globalForPrisma 사용)
```

**Supabase + Prisma 권장 URL 형식:**
- Serverless (Vercel): `postgresql://...@...pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1`
- DIRECT_URL: `postgresql://...@...supabase.co:5432/postgres` (migration 전용)

### 2. fetchMobileHomeData 쿼리 분석
파일: `src/lib/mobile-home.ts`

```
확인 항목:
- 중첩 include 깊이 (family → members → user 등)
- Promise.all vs 직렬 await
- 전체 데이터 로드 vs 필요 필드만 select
- 쿼리 수 카운트 (3개 이상이면 병렬화 검토)
```

### 3. API 라우트 세션 검증 패턴
파일: `src/lib/get-session.ts` + 각 API 라우트

```
확인 항목:
- getToken()만 사용하는지 (JWT 직접 디코딩 = DB 조회 없음)
- getServerSession() 혼용 여부 (이게 있으면 매 요청마다 세션 endpoint 호출)
- req 없이 getSessionUser() 호출하는 라우트 (= getServerSession 폴백 발생)
```

### 4. 프론트 useQuery 직렬 호출 패턴
파일: `src/app/m/*/page.tsx`

```
확인 항목:
- enabled: !!이전쿼리결과 로 인한 워터폴 (순차 실행)
- 동일 queryKey를 여러 컴포넌트가 각각 fetch하는 중복
- TanStack Query 전역 설정 (providers.tsx)
```

### 5. 환경변수 정합성
```
확인 항목:
- .env.local: DIRECT_URL 누락 여부
- .env.local: NEXTAUTH_URL 포트 (3001이면 dev 서버 포트와 불일치 가능)
- schema.prisma: directUrl = env("DIRECT_URL") → .env.local에 없으면 오류
```

## 정적 분석 방법
로컬 서버 없이도 수행 가능:
1. 각 파일 Read
2. 쿼리 패턴 카운트
3. `grep -n "await prisma"` 로 직렬 쿼리 탐지
4. `grep -n "getServerSession"` 으로 세션 방식 확인
5. `grep -n "enabled:"` 으로 useQuery 워터폴 탐지

## 출력
`_workspace/00_profile_report.md` — 병목 목록, 원인 추정, 각 에이전트 전달 사항
