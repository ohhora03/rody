# frontend-optimizer 완료 보고

작성일: 2026-05-24
입력: `_workspace/00_profile_report.md` "frontend-optimizer 전달 사항"

---

## 수정 파일 목록

1. `src/components/providers.tsx` — QueryClient 전역 설정 강화
2. `src/app/m/dashboard/page.tsx` — `m-home` staleTime 상향
3. `src/app/m/sprint/page.tsx` — `m-home` staleTime 상향 + `m-sprint-detail` staleTime 추가
4. `src/app/m/my-tasks/page.tsx` — 변경 없음 (이미 `staleTime: 60_000` 적용되어 있음)

---

## 변경 내역 요약

### 1. `src/components/providers.tsx`
QueryClient 기본 옵션을 한 줄에서 블록 형태로 확장.

| 옵션 | 이전 | 이후 | 사유 |
|------|------|------|------|
| `staleTime` | `30_000` | `60_000` | 기본 캐시 유효 시간을 1분으로 상향, refetch 빈도 절반으로 |
| `gcTime` | (기본 5분) | `5 * 60 * 1000` 명시 | 의도 명확화 |
| `refetchOnWindowFocus` | (기본 true) | `false` | PWA에서 탭 전환마다 5초 API 재호출 방지 (체감 개선 최대 항목) |
| `refetchOnReconnect` | (기본 true) | `false` | 모바일 네트워크 흔들림에도 불필요한 refetch 차단 |
| `retry` | `1` | `1` (유지) | 기존 동작 보존 |

### 2. `src/app/m/dashboard/page.tsx`
- `["m-home"]` 쿼리 `staleTime`: `5 * 60 * 1000` → `10 * 60 * 1000` (5분 → 10분)
  - 가족/프로젝트 구조는 변동이 적어 캐시 기간 연장 안전
- `["my-tasks"]` 쿼리: `staleTime: 60_000` 이미 존재 → 유지
- `enabled: !!session?.user` 두 쿼리 모두 유지 (병렬 동시 fetch 보장)

### 3. `src/app/m/sprint/page.tsx`
- `["m-home"]` 쿼리 `staleTime`: `5 * 60 * 1000` → `10 * 60 * 1000`
- `["m-sprint-detail", projectId, expandedSprintId]` 쿼리: `staleTime: 30_000` 신규 추가
  - 활성 스프린트는 협업 중 변동 가능 → 30초로 보수적 설정
  - `enabled` 조건은 기존 그대로 유지 (사용자가 아코디언을 펼친 후에만 fetch)

### 4. `src/app/m/my-tasks/page.tsx`
- `["my-tasks"]` 쿼리 `staleTime: 60_000` 이미 적용되어 있어 변경 없음

---

## 검증 사항
- 모든 변경은 `staleTime` / refetch 옵션에 한정. 데이터 흐름·렌더 로직·`enabled` 게이팅 동작 동일.
- TypeScript 타입: QueryClient 옵션은 `@tanstack/react-query` 표준 필드, useQuery 옵션 추가 필드 모두 타입 호환.

## 기대 효과
- 탭/앱 복귀 시 자동 refetch 트리거 제거 → 5초 API 노출 빈도 큰 폭 감소 (UX 체감 최대 개선 포인트)
- `m-home` 캐시 10분 → 모바일 페이지 간 이동(`/m/dashboard` ↔ `/m/sprint`) 시 즉시 렌더
- 본질적인 5초 지연 해소는 db-optimizer의 P0 작업(`.env.local` DATABASE_URL 풀러 전환)에 의존
