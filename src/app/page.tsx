import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isMobile(ua: string) {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // 모바일이면 바로 /m/dashboard로
  const headersList = await headers();
  const ua = headersList.get("user-agent") ?? "";
  if (isMobile(ua)) redirect("/m/dashboard");

  const member = await prisma.familyMember.findFirst({
    where: { userId: session.user.id },
    include: {
      family: {
        include: {
          projects: {
            include: { sprints: { where: { status: "ACTIVE" }, take: 1 } },
            take: 1,
          },
        },
      },
    },
  });

  if (!member) redirect("/onboarding");

  const project = member.family.projects[0];
  if (!project) redirect(`/family/${member.familyId}/setup`);

  const activeSprint = project.sprints[0];
  if (activeSprint) redirect(`/projects/${project.id}/sprint/${activeSprint.id}`);

  redirect(`/projects/${project.id}/backlog`);
}
