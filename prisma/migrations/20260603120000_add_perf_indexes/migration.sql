-- perf 진단 권장 인덱스 추가 (병목: Sprint/Comment FK 조회, Issue order 정렬)
-- IF NOT EXISTS 로 멱등 적용 (db push 운영 환경에서 직접 실행 가능).
-- 대량 데이터 환경에서 락 최소화를 원하면 CONCURRENTLY 사용 권장(트랜잭션 밖에서 실행).

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_issueId_idx" ON "Comment"("issueId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Issue_projectId_sprintId_order_idx" ON "Issue"("projectId", "sprintId", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Sprint_projectId_idx" ON "Sprint"("projectId");
