# 03 — UI 구현 완료

## 상태
- MyTask 모바일 UI 구현 완료
- 하단 네비게이션에 "내 할 일" 탭 추가 완료
- 패턴: `/src/app/m/sprint/page.tsx`, `/src/app/m/backlog/page.tsx`와 동일한 스타일 사용 (inline style + lucide-react)

## 생성된 파일

| 경로 | 역할 |
|------|------|
| `/src/app/m/my-tasks/page.tsx` | 내 할 일 목록 페이지 (필터/정렬/FAB) |
| `/src/app/m/my-tasks/new/page.tsx` | 새 과제 등록 페이지 |
| `/src/app/m/my-tasks/_components/TaskCard.tsx` | 과제 카드 (낙관적 완료 토글) |
| `/src/app/m/my-tasks/_components/TaskForm.tsx` | 등록/수정 공통 폼 + 타입 정의 export |

## 수정된 파일

| 경로 | 변경 내용 |
|------|----------|
| `/src/app/m/_components/BottomNav.tsx` | TABS 배열에 `{ href: "/m/my-tasks", label: "내 할 일", Icon: CheckSquare }` 추가 |

## 라우트

- `GET /m/my-tasks` — 목록 페이지
- `GET /m/my-tasks/new` — 등록 페이지

## TanStack Query 키

- `["my-tasks"]` — 전체 목록 캐시 (staleTime 60s)
- 완료 토글 시 `onMutate`에서 `setQueryData`로 낙관적 업데이트, `onError`에서 롤백
- 반복 과제가 자동 생성될 수 있으므로 `onSettled`에서 invalidate

## 컴포넌트 Props 요약

### `TaskCard`
```ts
interface Props {
  task: MyTask;
  onTap?: (task: MyTask) => void;  // 카드 본문 클릭 시 (현재 페이지에선 미사용, 향후 편집용)
}
```

### `TaskForm`
```ts
interface Props {
  initial?: Partial<TaskFormValues>;       // 수정 시 초기값
  submitLabel?: string;                    // 기본 "저장"
  submitting?: boolean;                    // pending 상태 표시
  onSubmit: (values: TaskFormValues) => void;
  onCancel?: () => void;
}

interface TaskFormValues {
  title: string;                  // trim된 비어있지 않은 문자열만 submit
  memo: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  dueDate: string | null;         // ISO 8601 (date input → toISOString)
  repeat: "NONE" | "DAILY" | "WEEKLY";
}
```

## 동작 요약

### 목록 페이지 (`/m/my-tasks`)
- 필터 탭: **전체 / 오늘 / 완료**
  - "오늘": `dueDate`의 local 연/월/일이 오늘과 일치하는 과제만 (시간 무시)
  - "완료": `status === "DONE"`
- 정렬: 미완료 우선 → `dueDate` 오름차순(없으면 뒤) → 같은 날짜면 priority HIGH > MEDIUM > LOW
- 빈 상태: 🎉 + "할 일이 없어요" + "+ 추가하기" 버튼 (`/m/my-tasks/new`로 이동)
- 우측 하단 FAB(원형 + 버튼): `/m/my-tasks/new`로 이동, `BottomNav`(80px) 위에 위치
- 헤더에 전체 과제 수 배지 표시

### 등록 페이지 (`/m/my-tasks/new`)
- 상단 뒤로가기 버튼 + 제목
- `TaskForm`에 빈 상태로 마운트
- 성공 시 `queryClient.invalidateQueries({ queryKey: ["my-tasks"] })` 후 `router.push("/m/my-tasks")`
- 실패 시 `alert()` (앱에 토스트 시스템 없음)

### TaskCard 동작
- 좌측 체크박스 클릭 → `PATCH /api/my-tasks/{id}` with `{ status: "DONE" | "PENDING" }`
- 낙관적 업데이트: `onMutate`에서 즉시 캐시 갱신, 실패 시 `prev`로 롤백
- 완료된 과제: 텍스트 line-through, opacity 0.6
- 표시: priority 배지 (HIGH=red/MEDIUM=amber/LOW=green), `MM/DD` 날짜 배지, `repeat !== NONE`이면 🔄(Repeat 아이콘) + "매일"/"매주" 라벨

## BottomNav 탭 순서
홈 → 백로그 → 스프린트 → **내 할 일** → 설정 (총 5개)

## 다음 단계 (qa-validator)
- API 응답 shape이 `{ data: MyTask[] }` / `{ data: MyTask }` 인 것 확인 필요
- TypeScript strict 통과 확인: `npm run build` 또는 `tsc --noEmit`
- "오늘" 필터의 시간대 처리(local date 비교)가 의도와 맞는지 검증
- 반복 과제 완료 시 새 과제 자동 생성 → invalidate로 목록에 즉시 반영되는지 확인
