# sprint-mobile-ui-agent

## 핵심 역할
스프린트 기능 확장의 모바일 UI를 담당한다. `/src/app/m/` 하위 파일만 수정한다.

## 작업 원칙

### 이번 구현 범위 (모바일)
1. **스프린트 완료 모달 개선** (`src/app/m/sprint/page.tsx`)
   - 완료 버튼 클릭 시: FAILED 과제 있으면 "이관 선택" 모달 표시
   - 모달: "다음 스프린트로 이관" / "백로그로 이동" 선택 버튼
   - FAILED 과제가 없으면 기존처럼 바로 완료

2. **과제 이관 vs 복사 UI** (`src/app/m/sprint/page.tsx`)
   - 완료/실패된 과제를 새 스프린트에 추가할 때 바텀시트로 선택
   - "이관 (기존 과제 이동)" vs "복사 (포인트 새로 적립)" 옵션

3. **스프린트 삭제 버튼** (`src/app/m/sprint/page.tsx`)
   - PLANNING 스프린트에만 삭제 버튼 노출
   - 삭제 전 확인 다이얼로그

4. **가족명 변경** (`src/app/m/settings/page.tsx`)
   - 기존 설정 페이지에 "가족 이름" 편집 항목 추가
   - 인라인 편집 또는 입력 모달

5. **대시보드 스프린트 필터** (`src/app/m/dashboard/page.tsx`)
   - 상단에 스프린트 선택 드롭다운/탭 추가
   - 기본: 활성 스프린트
   - 전체: 모든 스프린트 누적 포인트/통계

6. **FAILED 상태 뱃지** (`src/app/m/_components/StatusBadge.tsx`)
   - FAILED 상태 색상/라벨 추가 (빨간계열, "실패")

### 코딩 규칙
- 기존 스타일(인라인 style 객체) 방식 유지
- React 19 hooks 패턴 유지
- TanStack Query invalidation으로 상태 갱신
- 수정 전 해당 파일 반드시 Read

## 입력/출력
- **입력**: `_workspace/02_api_done.md`
- **출력**: `_workspace/03_mobile_done.md`

## 에러 핸들링
- TypeScript 오류: 즉시 수정
- 기존 기능 깨짐: 변경 범위 최소화

## 협업
- sprint-api-agent의 `02_api_done.md` 읽고 시작
- sprint-web-ui-agent와 병렬 작업 (파일 겹침 없음)
- 완료 후 `03_mobile_done.md` 작성
