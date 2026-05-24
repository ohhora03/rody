# perf-profiler 진단 보고서

> 분석 방식: **정적 분석 기반** (로컬 서버 미실행)
> 작성일: 2026-05-24
> 대상 현상: 모든 환경(로컬 dev 포함)에서 모든 API 호출이 ~5초씩 걸림

---

## 진단 요약

- **추정 5초 원인 (1순위 / 결정타):** `.env.local`의 `DATABASE_URL`이 **포트 5432 (직접 연결)** 로 설정되어 있고 `pgbouncer=true`, `connection_limit` 파라미터가 **모두 누락**. 결과적으로 모든 요청이 Supabase 풀러를 우회해 매번 새 TCP+TLS+Postgres 핸드셰이크를 수행 → 한국(서버) ↔ ap-northeast-2 Supabase 간이라도 cold start 시 3~6초의 커넥션 확립 비용이 매 API 요청마다 발생. dev 모드 + Next.js HMR로 모듈이 재평가될 때마다 PrismaClient가 재생성되어 더욱 악화.
- **2순위 (증폭 요인):** `.env.local`에 **`DIRECT_URL` 누락**. `prisma/schema.prisma`가 `directUrl = env("DIRECT_URL")`을 요구한다면 Prisma engine 부팅 시 fallback 경로/경고가 추가됨. 더 큰 문제는 `.env.local`의 DATABASE_URL이 이미 5432(direct) 포트를 가리키므로 풀링 자체가 작동하지 않음.
- **3순위:** `src/lib/mobile-home.ts`의 4-depth 중첩 `include`(familyMember → family → members→user, projects → sprints) + 본문에 추가 2개 issue 쿼리 = **단일 API에서 최소 3 round-trip + 카르테시안 JOIN**.
- **영향 범위:** 전체 API 라우트 (`/api/m/home`, `/api/my-tasks`, 그 외 모든 prisma 사용 라우트). `m/dashboard`, `m/my-tasks`, `m/sprint` 등 모바일 페이지 진입 시 동시 다발 발생.

---

## 병목 목록 (우선순위 순)

| 순위 | 위치 | 문제 | 예상 절감 |
|------|------|------|----------|
| 1 | `.env.local` DATABASE_URL | 포트 5432 + `pgbouncer=true` 없음 + `connection_limit=1` 없음 → 매 요청 새 커넥션 | **3~5s** |
| 2 | `.env.local` DIRECT_URL 누락 | `.env`에는 있으나 `.env.local`이 override 하면서 `DIRECT_URL`이 undefined → schema.prisma의 directUrl 요구와 불일치 | startup warning + migration 위험 |
| 3 | `src/lib/prisma.ts` | `datasources: { db: { url: process.env.DATABASE_URL } }` 명시적 오버라이드 (불필요, 풀러 URL을 강제 고정시켜 직접 연결 회피 어렵게 만듦) | 미세 (제거 권장) |
| 4 | `src/lib/mobile-home.ts` L6-21 | family → members→user, projects → sprints 4-depth include 단일 쿼리. 한 가족에 멤버 N명·프로젝트 M개·스프린트 K개 → N×M×K 행 카르테시안. `select` 미사용으로 모든 컬럼 로드 | 200~800ms |
| 5 | `src/lib/mobile-home.ts` L31-46 | 2번째 쿼리(issues/backlogIssues)는 `Promise.all`로 잘 묶였으나 1번 쿼리와는 직렬. 첫 쿼리 결과(activeSprint id)에 의존하기 때문에 어쩔 수 없으나, 1번 쿼리를 가볍게 만들면 전체 단축 | 100~300ms |
| 6 | `src/app/(dashboard)/layout.tsx`, `src/app/m/layout.tsx`, `src/app/page.tsx` | `getServerSession(authOptions)`을 그대로 사용. NextAuth v4의 getServerSession은 req 없이 호출되면 내부적으로 cookies()를 거쳐 session callback을 실행. session callback은 DB 조회는 없지만(이미 수정됨), layout이 매 네비게이션마다 호출되므로 JWT 디코드 비용 누적. `getToken` 기반으로 교체 가능 | 50~150ms |
| 7 | `src/components/providers.tsx` | `refetchOnWindowFocus` 기본값(true) 그대로. 사용자가 탭 전환할 때마다 모든 활성 쿼리가 다시 fetch → 5초 지연이 더 자주 노출됨 | UX 체감 큰 폭 개선 |
| 8 | `src/app/m/sprint/page.tsx` L91-95 | `sprintDetail` 쿼리가 `enabled: !!projectId && !!expandedSprintId`로 `m-home` 쿼리 결과를 기다림 → **워터폴**. 첫 진입 시 home(5s) → sprintDetail(5s) = 10s | 5s |
| 9 | `src/app/m/dashboard/page.tsx` L142-154 | `m-home`, `my-tasks` 두 쿼리 모두 `enabled: !!session?.user`. session이 준비되기 전엔 둘 다 대기. session 준비 후엔 둘이 병렬로 가지만, 동일 페이지에서 두 별개 API 호출(둘 다 ~5s) → 둘이 끝나야 첫 렌더 가능 | (병렬이므로 추가 5s 없음, 단 두 API 각각 단축 필요) |
| 10 | `src/app/api/my-tasks/route.ts` GET | OR 조건 3개 + 두 include(assignee/owner). PG에서 OR는 인덱스 미적용 가능. ownerId/assigneeId 복합 인덱스 점검 필요 | 100~400ms |

---

## 즉시 수정 가능 항목

- [ ] **(P0)** `.env.local`의 `DATABASE_URL`을 풀러 형식으로 교체:
  ```
  DATABASE_URL="postgresql://postgres.xidpokrkdvwrdjdnvjfd:cjk710027691%21@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1&connect_timeout=15"
  ```
  - 포트 `5432` → `6543` (PgBouncer transaction pooler)
  - `pgbouncer=true` 추가 (Prisma가 prepared statement 비활성화)
  - `connection_limit=1` (serverless / Next.js dev HMR에서 커넥션 누수 방지)
- [ ] **(P0)** `.env.local`에 `DIRECT_URL` 추가 (`.env`의 값 그대로):
  ```
  DIRECT_URL="postgresql://postgres.xidpokrkdvwrdjdnvjfd:cjk710027691%21@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require"
  ```
- [ ] **(P1)** `src/lib/prisma.ts`의 `datasources` 명시 블록 제거 (디폴트가 env 사용이며, 명시는 오버라이드 트랩만 만듦):
  ```ts
  export const prisma = globalForPrisma.prisma || new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });
  ```
- [ ] **(P1)** `src/components/providers.tsx`에 `refetchOnWindowFocus: false` 추가.
- [ ] **(P2)** `src/lib/mobile-home.ts`의 include를 `select`로 좁히고, members/projects/sprints 필요 필드만 가져오기.
- [ ] **(P2)** `getServerSession`을 사용하는 layout/page 3곳을 `getToken`으로 교체 또는 middleware로 통합.

---

## 검증 절차 (사용자가 수행 권장)

1. `.env.local` 수정 후 `rm -rf .next && npm run dev` 재시작.
2. 첫 요청은 여전히 느릴 수 있음(콜드 스타트). 2번째 요청부터 측정.
3. `src/lib/prisma.ts`에 `log: ["query"]` 임시 활성화 후 `/api/m/home` 호출하여 쿼리 수/시간 확인.
4. `curl -w "TTFB:%{time_starttransfer}s TOT:%{time_total}s\n" -o /dev/null -s http://localhost:3001/api/m/home -H "Cookie: ..."` 로 측정.
5. 기대값: 1번 수정만으로 5s → 200~500ms.

---

## db-optimizer 전달 사항

1. **DATABASE_URL 포트/파라미터 교체 (P0)** — `.env.local`이 최우선. 위 "즉시 수정" 1번 항목 그대로 적용.
2. **prisma.ts datasources 오버라이드 제거 (P1)** — Prisma가 환경별 URL을 자연스럽게 읽도록.
3. **`fetchMobileHomeData` 쿼리 재설계 (P2)**:
   - 1번 쿼리는 family/project id만 가져오고, members/projects/sprints는 별도 쿼리로 분리하여 `Promise.all`로 병렬화.
   - 전부 `select`로 명시(특히 `User.image` 같이 큰 필드 회피).
4. **MyTask GET 인덱스 점검** — `(ownerId, assigneeId, acceptStatus)` 복합 인덱스 또는 두 개 단일 인덱스 + OR → UNION ALL 분해 검토.
5. **DIRECT_URL을 .env.local에도 명시** — schema.prisma가 `directUrl`을 요구하면 마이그레이션 실행 시 필요.

---

## frontend-optimizer 전달 사항

1. **`providers.tsx`에 `refetchOnWindowFocus: false`** (P1). 추가로 `refetchOnReconnect: false`, 글로벌 `gcTime` 명시 검토.
2. **`src/app/m/sprint/page.tsx`의 sprintDetail 워터폴 해소 (P2)**:
   - `m-home` 응답에 sprint 기본 정보(issues 포함)를 함께 담아 별도 호출 제거 가능.
   - 또는 `useQueries`로 묶고 placeholderData를 home 응답에서 채우기.
3. **`m-home` 응답 캐시 강화** — 현재 `Cache-Control: private, no-store`. TanStack의 `staleTime: 5min`은 있지만 새로고침/탭전환 후엔 무력. `private, max-age=0, must-revalidate` + ETag 또는 SWR 패턴 검토.
4. **dashboard 페이지의 my-tasks/m-home 두 쿼리는 이미 병렬** — 추가 워터폴 없음. 단, 두 API 자체가 5s면 의미 없음 → P0 수정이 선행되어야 효과 측정 가능.
5. **`getServerSession`을 호출하는 m/layout.tsx**가 모든 m/* 페이지 진입마다 실행됨 → 가능하면 client-side `useSession`만으로 게이팅하고 layout의 서버 세션 체크는 middleware로 이관.

---

## 부록: grep 결과 요약

- `getServerSession` 사용처: 4곳 (`app/page.tsx`, `(dashboard)/layout.tsx`, `m/layout.tsx`, `lib/get-session.ts` fallback). API 라우트는 모두 `getSessionUser(req)` 경유 → JWT 디코딩만 수행, DB 조회 없음. **세션 검증은 5s 원인 아님**.
- `mobile-home.ts`의 `await prisma`: 1곳(L6)만 직접 await. 나머지는 Promise.all 내부. **쿼리 패턴 자체는 양호**, include 깊이가 문제.
- `enabled:` 사용처 7곳 중 워터폴 발생: `m/sprint/page.tsx`의 sprintDetail(`!!projectId && !!expandedSprintId`), IssueModal의 `enabled: isEdit`. 그 외는 session gating(병렬 무관).

## 결론

**5초 지연의 결정적 원인은 `.env.local`의 DATABASE_URL이 풀러를 통과하지 않는 직접 연결(5432)이며 `connection_limit`도 없는 것.** 이 한 줄 수정만으로 ~80% 회복이 예상된다. 나머지 항목은 그 다음 단계에서 ms 단위 최적화를 위한 것이다.
