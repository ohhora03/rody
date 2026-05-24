---
name: my-task-ui
description: "MyTask 모바일 UI 구현. /src/app/m/my-tasks/ 페이지와 컴포넌트 생성, 하단 네비게이션 탭 추가. '내 할 일 UI', 'MyTask 화면', '모바일 할 일 탭' 요청 시 이 스킬을 사용할 것."
---

## 목표
PWA 모바일 앱에 "내 할 일" 탭과 화면을 추가한다.

## 패턴 파악 (필수 선행)
다음 파일들을 읽어 기존 패턴을 파악한다:
- `/src/app/m/sprint/page.tsx` — TanStack Query 사용법, 컴포넌트 구조
- `/src/app/m/layout.tsx` — 네비게이션 구조, HydrationBoundary 패턴
- `/src/app/m/_components/` — 공통 컴포넌트 목록

## 구현 목록

### 1. 목록 페이지 `/src/app/m/my-tasks/page.tsx`
```tsx
// 쿼리
const { data: tasks = [] } = useQuery({
  queryKey: ["my-tasks"],
  queryFn: () => fetch("/api/my-tasks").then(r => r.json()).then(r => r.data),
  staleTime: 60_000,
});

// 클라이언트 정렬: 미완료 먼저, 그 안에서 dueDate → priority
const sorted = [...tasks].sort(sortTasks);

// 필터 탭: 전체 | 오늘 | 완료
```

### 2. 과제 카드 `_components/TaskCard.tsx`
- 체크박스: 완료 토글 (낙관적 업데이트)
- 제목 + dueDate + priority 배지
- repeat !== NONE이면 🔄 아이콘 표시
- 탭으로 상세/수정 bottom sheet 열기

### 3. 등록/수정 폼 `_components/TaskForm.tsx`
필드: title(필수), memo, priority(선택, 기본 MEDIUM), dueDate(선택), repeat(선택, 기본 NONE)

### 4. 새 과제 페이지 `/src/app/m/my-tasks/new/page.tsx`
TaskForm을 감싸는 페이지. POST 성공 시 목록으로 이동.

### 5. 네비게이션 탭 추가
`/src/app/m/layout.tsx`의 하단 네비게이션에 "내 할 일" 탭 추가:
- 아이콘: CheckSquare 또는 ClipboardList (lucide-react)
- 경로: `/m/my-tasks`
- 레이블: "내 할 일"

## 낙관적 업데이트 패턴
```tsx
const toggleMutation = useMutation({
  mutationFn: (id: string) =>
    fetch(`/api/my-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "DONE" }),
    }),
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: ["my-tasks"] });
    const prev = queryClient.getQueryData(["my-tasks"]);
    queryClient.setQueryData(["my-tasks"], (old: Task[]) =>
      old.map(t => t.id === id ? { ...t, status: "DONE" } : t)
    );
    return { prev };
  },
  onError: (_, __, ctx) => queryClient.setQueryData(["my-tasks"], ctx?.prev),
});
```

## 정렬 로직
```ts
function sortTasks(a: Task, b: Task) {
  // 완료된 과제는 뒤로
  if (a.status !== b.status) return a.status === "DONE" ? 1 : -1;
  // dueDate 없으면 맨 뒤
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  // dueDate 오름차순
  const dateDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  if (dateDiff !== 0) return dateDiff;
  // 같은 날이면 priority: HIGH > MEDIUM > LOW
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
}
```

## 빈 상태
```tsx
<div className="text-center py-16 text-gray-400">
  <p>할 일이 없어요 🎉</p>
  <button onClick={() => router.push("/m/my-tasks/new")}>+ 추가하기</button>
</div>
```

## 산출물
`_workspace/03_ui_done.md`에 구현된 컴포넌트 목록과 라우트 경로를 기록한다.
