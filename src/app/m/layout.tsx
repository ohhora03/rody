import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { fetchMobileHomeData } from "@/lib/mobile-home";
import BottomNav from "./_components/BottomNav";
import OnboardingGuide from "./_components/OnboardingGuide";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // 서버에서 직접 DB 조회 → cold start 없음, 클라이언트에 즉시 주입
  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: ["m-home"],
      queryFn: () => fetchMobileHomeData(session.user.id),
    });
  } catch {
    // prefetch 실패해도 클라이언트가 정상 fetch
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
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
    </HydrationBoundary>
  );
}
