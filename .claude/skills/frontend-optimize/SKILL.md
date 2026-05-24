---
name: frontend-optimize
description: "FamilySync 프론트엔드 성능 최적화. TanStack Query 캐싱 전략, API 호출 병렬화, 로딩 UX 개선, 불필요한 리페치 제거. '느린 화면 전환', '탭 이동 시 로딩', 'staleTime', '캐시 설정' 요청 시 이 스킬을 사용할 것."
---

## TanStack Query 최적화 전략

### 전역 설정 (providers.tsx)
```tsx
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // 30s → 60s: 탭 전환 시 refetch 감소
      gcTime: 5 * 60 * 1000,      // 5분: 캐시 보존
      refetchOnWindowFocus: false, // 앱 복귀 시 불필요한 refetch 방지
      retry: 1,                   // 실패 시 1회만 재시도
    },
  },
})
```

**`refetchOnWindowFocus: false`가 중요한 이유:**
PWA에서는 사용자가 다른 앱을 보다가 돌아올 때마다 refetch가 트리거됨.
5초 걸리는 API가 있으면 매번 5초 대기하게 됨.

### 페이지별 캐시 전략

| 쿼리 키 | 권장 staleTime | 이유 |
|---------|--------------|------|
| `["m-home"]` | 10분 | 가족/프로젝트 구조는 자주 안 바뀜 |
| `["my-tasks"]` | 60s | 개인 할 일은 자주 바뀜 |
| `["m-sprint-detail"]` | 30s | 스프린트 이슈는 협업 중 변동 |
| `["m-backlog"]` | 2분 | 백로그는 변동 빈도 낮음 |

### useQuery 워터폴 방지
```tsx
// 나쁨: homeData 로드 후 tasks 로드 (순차)
const { data: homeData } = useQuery({ queryKey: ["m-home"] });
const { data: tasks } = useQuery({
  queryKey: ["my-tasks"],
  enabled: !!homeData,  // homeData 결과를 기다림
});

// 좋음: tasks가 homeData에 의존하지 않으면 동시에 실행
const { data: homeData } = useQuery({ queryKey: ["m-home"] });
const { data: tasks } = useQuery({
  queryKey: ["my-tasks"],
  enabled: !!session?.user,  // session만 있으면 즉시 시작
});
```

### 낙관적 업데이트 패턴
mutation 후 `invalidateQueries` 대신 `setQueryData`로 캐시 직접 업데이트:
```tsx
onMutate: async (newTask) => {
  await queryClient.cancelQueries({ queryKey: ["my-tasks"] });
  const prev = queryClient.getQueryData(["my-tasks"]);
  queryClient.setQueryData(["my-tasks"], (old) => [...old, newTask]);
  return { prev };
},
onError: (_, __, ctx) => queryClient.setQueryData(["my-tasks"], ctx?.prev),
onSettled: () => queryClient.invalidateQueries({ queryKey: ["my-tasks"] }),
```

### keepPreviousData (페이지 이동 시 깜빡임 방지)
```tsx
const { data } = useQuery({
  queryKey: ["m-sprint-detail", sprintId],
  placeholderData: keepPreviousData,
});
```

## 로딩 UX 개선

### Skeleton UI 패턴
5초 지연이 있을 때 빈 화면보다 스켈레톤이 훨씬 낫다:
```tsx
if (isLoading) return <SkeletonList count={5} />;
```

기존 Spinner 컴포넌트 대신 content-aware skeleton 도입 검토.

## 수정 순서
1. `providers.tsx` — 전역 QueryClient 설정
2. `src/app/m/dashboard/page.tsx` — staleTime + enabled 조건
3. `src/app/m/sprint/page.tsx` — staleTime + enabled 조건
4. `src/app/m/my-tasks/page.tsx` — staleTime + enabled 조건
5. `npx tsc --noEmit` 확인
