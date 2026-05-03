import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

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
