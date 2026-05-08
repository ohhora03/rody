import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import BottomNav from "./_components/BottomNav";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

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
    </div>
  );
}
