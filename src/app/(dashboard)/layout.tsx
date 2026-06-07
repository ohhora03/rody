import { redirect } from "next/navigation";
import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  // getToken을 서버 컴포넌트에서 사용하려면 request 객체가 필요 — headers로 모의 생성
  const req = new NextRequest("http://localhost", { headers: headersList });
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! });

  if (!token?.id) redirect("/login");

  const userId = token.id as string;

  const [member, dbUser] = await Promise.all([
    prisma.familyMember.findFirst({
      where: { userId },
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
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { color: true } }),
  ]);

  if (!member) redirect("/onboarding");

  const project = member.family.projects[0];
  const activeSprint = project?.sprints[0] ?? null;

  return (
    <div className="flex min-h-screen bg-[#f8f7ff]">
      <Sidebar
        projectId={project?.id ?? ""}
        familyId={member.familyId}
        familyName={member.family.name}
        isMaster={member.role === "MASTER"}
        activeSprint={activeSprint ? { id: activeSprint.id, name: activeSprint.name } : null}
        user={{ name: token.name as string, email: token.email as string, color: dbUser?.color }}
      />
      <div className="flex-1 min-w-0 overflow-hidden md:pt-0 pt-16">{children}</div>
    </div>
  );
}
