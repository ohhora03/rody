import { prisma } from "@/lib/prisma";
import type { FamilyRole } from "@/types";

/**
 * 프로젝트 멤버십 검증을 단일 쿼리로 수행한다.
 *
 * 기존 패턴은 `project.findUnique` → `familyMember.findUnique` 직렬 2 RTT였다.
 * `family.projects.some` 관계 필터를 사용해 한 번의 쿼리로
 * - 멤버십 존재 여부(= 접근 권한)
 * - 멤버의 role
 * - 프로젝트가 속한 familyId
 * 를 모두 획득한다.
 *
 * @returns 멤버이면 `{ role, familyId }`, 아니면 `null`.
 *   `null`은 "프로젝트 없음" 또는 "멤버 아님"을 구분하지 않는다(둘 다 접근 불가).
 *   404/403을 구분해야 하는 호출부는 `assertProjectMember`를 사용하라.
 */
export async function getProjectMembership(
  userId: string,
  projectId: string
): Promise<{ role: FamilyRole; familyId: string } | null> {
  const member = await prisma.familyMember.findFirst({
    where: { userId, family: { projects: { some: { id: projectId } } } },
    select: { role: true, familyId: true },
  });
  return member;
}

/**
 * 이슈 ID 기준으로 멤버십을 검증한다(issue → project → family 경유).
 * 이슈가 없거나 멤버가 아니면 `null`.
 */
export async function getIssueMembership(
  userId: string,
  issueId: string
): Promise<{ role: FamilyRole } | null> {
  const member = await prisma.familyMember.findFirst({
    where: {
      userId,
      family: { projects: { some: { issues: { some: { id: issueId } } } } },
    },
    select: { role: true },
  });
  return member;
}
