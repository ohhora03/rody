import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import BottomNav from "./_components/BottomNav";
import OnboardingGuide from "./_components/OnboardingGuide";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // 서버사이드 prefetch 제거: DB 쿼리가 느릴 때 모든 페이지 진입을 막는 문제 해결
  // 클라이언트 TanStack Query가 캐시(staleTime: 10분)로 관리 → 첫 로드 후 탭 이동은 즉시
  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: "#f8fafc",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: 80,
        }}
      >
        {children}
      </main>
      <BottomNav />
      <OnboardingGuide />
    </div>
  );
}
