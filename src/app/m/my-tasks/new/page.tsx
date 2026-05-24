"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";
import TaskForm, {
  type MyTask,
  type TaskFormValues,
  type FamilyMemberOption,
} from "../_components/TaskForm";

interface HomeCache {
  families?: Array<{
    members?: Array<{ user: { id: string; name: string } }>;
  }>;
}

export default function NewMyTaskPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const home = queryClient.getQueryData<HomeCache>(["m-home"]);
  const familyMembers: FamilyMemberOption[] = (home?.families?.[0]?.members ?? []).map(
    (m) => ({ id: m.user.id, name: m.user.name }),
  );

  const createMutation = useMutation({
    mutationFn: async (values: TaskFormValues): Promise<MyTask> => {
      const res = await fetch("/api/my-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "등록에 실패했어요");
      }
      const json = await res.json();
      return json.data as MyTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      router.push("/m/my-tasks");
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  return (
    <div style={{ background: "#f8fafc", minHeight: "100%" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 12px 12px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6b7280",
            display: "flex",
            alignItems: "center",
            padding: 6,
          }}
          aria-label="뒤로"
        >
          <ChevronLeft size={24} />
        </button>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>새 할 일</span>
      </div>

      <div style={{ padding: "8px 20px 24px" }}>
        <TaskForm
          submitLabel="등록"
          submitting={createMutation.isPending}
          currentUserId={currentUserId}
          familyMembers={familyMembers}
          onSubmit={(values) => createMutation.mutate(values)}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}
