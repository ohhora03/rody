import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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
  const activeSprint = project?.sprints[0] ?? null;
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { color: true } });

  return (
    <div className="flex min-h-screen bg-[#f8f7ff]">
      <Sidebar
        projectId={project?.id ?? ""}
        familyId={member.familyId}
        activeSprint={activeSprint ? { id: activeSprint.id, name: activeSprint.name } : null}
        user={{ name: session.user.name, email: session.user.email, color: dbUser?.color }}
      />
      <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}
