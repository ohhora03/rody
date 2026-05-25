---
name: sprint-ui
description: "FamilySync 스프린트 UI 구현. 실패 이관 모달, 이관/복사 선택, 스프린트 삭제, 가족명 편집, 대시보드 스프린트 필터. 모바일(/m/)과 웹((dashboard)/) 양쪽 적용."
---

## 공통 UX 원칙
- 파괴적 액션(삭제, 이관)은 반드시 확인 단계 거침
- 모바일: 바텀시트 / 인라인 버튼 패턴 유지
- 웹: 모달 다이얼로그 / 드롭다운 패턴 유지
- FAILED 상태 색상: 빨간계열 (`#ef4444`, `bg-red-50`, `text-red-600`)

## FAILED 상태 뱃지

### 모바일 (StatusBadge.tsx)
```tsx
const STATUS = {
  ...기존,
  FAILED: { label: "실패", bg: "#fef2f2", color: "#dc2626" },
};
```

### 웹 (src/lib/utils.ts - STATUS_CONFIG)
```ts
FAILED: { label: "실패", bg: "bg-red-50", text: "text-red-600", color: "#dc2626", icon: XCircle },
```

## 스프린트 완료 → 이관 모달 패턴

### 흐름
1. 완료 버튼 클릭
2. API 호출: `POST .../complete` (failedAction 없이 먼저 호출)
3. 응답의 `failedIssues.length > 0` 이면 이관 선택 모달 표시
4. 사용자가 선택하면 다시 API 호출 (failedAction 포함)

### 모달 UI (모바일)
```tsx
{showFailedModal && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50 }}>
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#fff", borderRadius: "20px 20px 0 0", padding: 24 }}>
      <h3>실패한 과제 {failedIssues.length}개를 어떻게 할까요?</h3>
      <button onClick={() => handleTransfer("next-sprint")}>다음 스프린트로 이관</button>
      <button onClick={() => handleTransfer("backlog")}>백로그로 이동</button>
      <button onClick={() => handleTransfer(null)}>그대로 두기</button>
    </div>
  </div>
)}
```

## 이관 vs 복사 선택 UI

다른 스프린트로 과제를 이동할 때:
```tsx
// 선택 모달
<dialog>
  <h3>"{issue.title}" 이동 방법 선택</h3>
  <button onClick={() => transfer("copy")}>
    📋 복사 — 새 과제로 추가 (포인트 새로 적립)
  </button>
  <button onClick={() => transfer("transfer")}>
    ↗️ 이관 — 기존 과제 이동
  </button>
</dialog>
```

## 스프린트 삭제 버튼

PLANNING 상태에만 노출:
```tsx
{sprint.status === "PLANNING" && (
  <button onClick={() => confirmDelete(sprint.id)} style={{ color: "#ef4444" }}>
    삭제
  </button>
)}
```

## 가족명 편집

### 모바일 (settings/page.tsx)
```tsx
// 기존 가족 정보 섹션에 추가
<div>
  <span>가족 이름</span>
  {isEditingName ? (
    <input value={familyName} onChange={e => setFamilyName(e.target.value)} />
  ) : (
    <span>{family.name}</span>
  )}
  <button onClick={() => setIsEditingName(!isEditingName)}>편집</button>
</div>
```

### 웹 (sidebar.tsx)
```tsx
// 가족명 표시 + MASTER면 편집 버튼
<div>
  <span className="font-semibold">{family?.name}</span>
  {isMaster && <button onClick={openNameEdit}>✏️</button>}
</div>
```

## 대시보드 스프린트 필터

```tsx
const [selectedSprint, setSelectedSprint] = useState<string>("active"); // "active" | "all" | sprintId

// 필터에 따라 통계 계산
const filteredIssues = selectedSprint === "active"
  ? issues.filter(i => i.sprintId === activeSprint?.id)
  : selectedSprint === "all"
  ? issues // 전체
  : issues.filter(i => i.sprintId === selectedSprint);

// 드롭다운 UI
<select value={selectedSprint} onChange={e => setSelectedSprint(e.target.value)}>
  <option value="active">활성 스프린트</option>
  <option value="all">전체 누적</option>
  {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
</select>
```
