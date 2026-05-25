# 02 — API 구현 완료

## 상태
- MyTask CRUD API 구현 완료
- Push 구독 API 구현 완료
- 패턴: `/src/app/api/issues/*`와 동일 (Response.json, getSessionUser, RouteContext)

## 공통

### 인증
- 모든 엔드포인트는 `getSessionUser(req)`로 인증 확인
- 인증 실패: `401 { "error": "인증이 필요합니다" }`
- 쿠키 기반(NextAuth) 또는 `Authorization: Bearer <token>` 헤더(모바일) 모두 지원

### 에러 응답
| 코드 | 본문 | 의미 |
|------|------|------|
| 400 | `{ "error": "..." }` | 잘못된 요청 (필수 필드 누락 등) |
| 401 | `{ "error": "인증이 필요합니다" }` | 미인증 |
| 404 | `{ "error": "Not found" }` | 리소스 없음 또는 타인 데이터 (존재 자체 숨김) |
| 500 | `{ "error": "서버 오류" }` | Prisma/내부 오류 (상세 메시지 노출 금지) |

### 타입
```ts
type Priority = "HIGH" | "MEDIUM" | "LOW";
type TaskStatus = "PENDING" | "DONE";
type RepeatType = "NONE" | "DAILY" | "WEEKLY";

interface MyTask {
  id: string;
  title: string;
  memo: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;   // ISO 8601
  repeat: RepeatType;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## MyTask

### `GET /api/my-tasks`
본인 과제 전체 반환. **서버 정렬 없음** — 클라이언트(UI)에서 정렬할 것.

**Request**: (없음)

**Response 200**:
```json
{ "data": [MyTask, ...] }
```

---

### `POST /api/my-tasks`
새 과제 생성.

**Request body**:
```json
{
  "title": "string (필수)",
  "memo": "string | null (선택)",
  "priority": "HIGH | MEDIUM | LOW (선택, 기본 MEDIUM)",
  "dueDate": "ISO 8601 string | null (선택)",
  "repeat": "NONE | DAILY | WEEKLY (선택, 기본 NONE)"
}
```

**Response 201**:
```json
{ "data": MyTask }
```

**Validation**:
- `title` 미입력/빈 문자열 → 400
- `ownerId`는 서버에서 세션 사용자로 자동 주입 (클라이언트 입력 무시)

---

### `PATCH /api/my-tasks/[id]`
과제 수정. 본인 과제만 수정 가능 (타인 → 404).

**Request body** (모든 필드 선택):
```json
{
  "title": "string",
  "memo": "string | null",
  "priority": "HIGH | MEDIUM | LOW",
  "dueDate": "ISO 8601 string | null",
  "repeat": "NONE | DAILY | WEEKLY",
  "status": "PENDING | DONE"
}
```

**Response 200**:
```json
{ "data": MyTask }
```

**특별 동작 — 반복 과제 완료 처리**:
- `status === "DONE"`으로 변경되고 기존 `repeat !== "NONE"`이면, 현재 과제는 DONE으로 업데이트되고 **다음 주기의 새 과제가 자동 생성**된다.
- 다음 dueDate 계산:
  - `DAILY`: 기존 dueDate + 1일 (dueDate가 null이면 today + 1일)
  - `WEEKLY`: 기존 dueDate + 7일 (dueDate가 null이면 today + 7일)
- 새 과제는 `title/memo/priority/repeat`을 그대로 복사, `status`는 기본값 `PENDING`.
- 이미 DONE 상태인 과제를 다시 DONE으로 PATCH해도 새 과제는 생성되지 않음 (멱등).

---

### `DELETE /api/my-tasks/[id]`
과제 삭제. 본인 과제만 삭제 가능 (타인 → 404).

**Request**: (body 없음)

**Response 204**: 본문 없음.

---

## Push 구독

### `POST /api/push/subscribe`
브라우저 푸시 구독 등록/갱신. `endpoint` 기준 upsert.

**Request body**:
```json
{
  "endpoint": "string (필수, unique)",
  "p256dh": "string (필수, VAPID 키)",
  "auth": "string (필수, VAPID 키)",
  "reminderHour": "number (선택, 0-23, 기본 21)"
}
```

**Response 201**:
```json
{
  "data": {
    "id": "...",
    "userId": "...",
    "endpoint": "...",
    "p256dh": "...",
    "auth": "...",
    "reminderHour": 21,
    "enabled": true,
    "createdAt": "..."
  }
}
```

**동작**:
- 같은 `endpoint`가 이미 있으면 `p256dh/auth/userId/reminderHour` 갱신 + `enabled: true` 복원 (재구독 케이스).
- 새 endpoint면 신규 생성.

---

### `DELETE /api/push/subscribe`
구독 해제. **실제 삭제하지 않고** `enabled: false`로 표시 (재구독 히스토리 보존).

**Request body**:
```json
{ "endpoint": "string (필수)" }
```

**Response 204**: 본문 없음.

**권한**: 본인 소유 구독이 아니면 404.

---

## UI / Push 엔지니어 참고
- TanStack Query 키 제안:
  - `["my-tasks"]` — GET 전체 목록
  - `["my-tasks", id]` — 개별 (필요 시 클라이언트 캐시에서 derive)
- 낙관적 업데이트 가능 (서버 정렬 없으므로 순서 깨질 걱정 없음)
- 완료 처리 후 반복 과제가 자동 생성되므로, PATCH 응답 후 목록을 invalidate 하여 새 과제를 표시할 것
- DELETE 응답은 204(본문 없음)이므로 `res.json()` 호출하지 말 것
