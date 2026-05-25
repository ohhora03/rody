# sprint-web-ui-agent

## 핵심 역할
스프린트 기능 확장의 웹 UI를 담당한다. `/src/app/(dashboard)/` 및 `/src/components/` 하위 파일만 수정한다.

## 작업 원칙

### 이번 구현 범위 (웹)
1. **스프린트 완료 모달 개선** (`src/app/(dashboard)/projects/[projectId]/sprints/page.tsx`)
   - 완료 버튼 클릭 시: FAILED 과제 있으면 이관 선택 모달
   - "다음 스프린트로 이관" / "백로그로 이동" 옵션

2. **과제 이관 vs 복사** (`src/app/(dashboard)/projects/[projectId]/sprint/[sprintId]/page.tsx`)
   - 완료/실패 과제를 다른 스프린트에 넣을 때 선택 다이얼로그
   - "이관" vs "복사" 구분 UI

3. **스프린트 삭제** (`src/app/(dashboard)/projects/[projectId]/sprints/page.tsx`)
   - PLANNING 스프린트 카드에 삭제 버튼(휴지통 아이콘)
   - 삭제 확인 모달

4. **가족명 설정** 
   - `src/components/layout/sidebar.tsx`: 가족명 표시 + 편집 버튼
   - 편집 시 인라인 또는 모달로 이름 변경

5. **대시보드 스프린트 필터** (`src/app/(dashboard)/projects/[projectId]/dashboard/page.tsx`)
   - 상단에 스프린트 선택 드롭다운 추가
   - 기본: 활성 스프린트 통계
   - 전체: 모든 스프린트 누적 포인트/과제 수 합산

6. **FAILED 상태** (`src/lib/utils.ts`)
   - STATUS_CONFIG에 FAILED 항목 추가 (색상, 라벨, 아이콘)

7. **task-modal.tsx** 이관/복사 UI 추가
   - 과제 상세에서 스프린트 이동 시 이관/복사 선택

### 코딩 규칙
- 기존 TailwindCSS 클래스 방식 유지
- React 상태 관리 기존 패턴 유지
- lucide-react 아이콘 사용
- 수정 전 해당 파일 반드시 Read

## 입력/출력
- **입력**: `_workspace/02_api_done.md`
- **출력**: `_workspace/04_web_done.md`

## 에러 핸들링
- TypeScript 오류: 즉시 수정
- 기존 기능 깨짐: 변경 범위 최소화

## 협업
- sprint-api-agent의 `02_api_done.md` 읽고 시작
- sprint-mobile-ui-agent와 병렬 작업 (파일 겹침 없음)
- 완료 후 `04_web_done.md` 작성
