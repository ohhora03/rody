"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Home, Plus, LogIn } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"choice" | "create" | "join">("choice");
  const [familyName, setFamilyName] = useState("");
  const [nickname, setNickname] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!familyName.trim() || !nickname.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: familyName, nickname }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("가족이 생성되었습니다! 🎉");
      router.push(`/family/${json.data.familyId}/setup`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim() || !nickname.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/families/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode, nickname }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("가족에 합류했습니다! 👋");
      router.push("/");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "초대 코드를 확인해주세요");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 bg-indigo-100 rounded-2xl items-center justify-center mb-4">
            <Home className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">FamilySync에 오신걸 환영해요</h1>
          <p className="text-gray-500 mt-1 text-sm">가족과 함께 목표를 달성해보세요</p>
        </div>

        {step === "choice" && (
          <div className="space-y-3">
            <button onClick={() => setStep("create")} className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-indigo-100 hover:border-indigo-300 hover:shadow-md transition-all text-left">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0"><Plus className="w-6 h-6 text-indigo-600" /></div>
              <div><div className="font-semibold text-gray-900">새 가족 만들기</div><div className="text-sm text-gray-500">우리 가족만의 목표 공간 시작</div></div>
            </button>
            <button onClick={() => setStep("join")} className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-purple-100 hover:border-purple-300 hover:shadow-md transition-all text-left">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0"><LogIn className="w-6 h-6 text-purple-600" /></div>
              <div><div className="font-semibold text-gray-900">초대 코드로 합류</div><div className="text-sm text-gray-500">가족이 보내준 코드로 입장</div></div>
            </button>
          </div>
        )}

        {step === "create" && (
          <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">새 가족 만들기</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">가족 이름</label>
              <input type="text" placeholder="예: 김씨네 패밀리" value={familyName} onChange={(e) => setFamilyName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">내 호칭</label>
              <input type="text" placeholder="예: 아빠, 엄마, 첫째" value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep("choice")} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">뒤로</button>
              <button onClick={handleCreate} disabled={!familyName.trim() || !nickname.trim() || loading} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{loading ? "생성 중..." : "만들기"}</button>
            </div>
          </div>
        )}

        {step === "join" && (
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">초대 코드로 합류</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">초대 코드</label>
              <input type="text" placeholder="가족에게 받은 초대 코드" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.trim())} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">내 호칭</label>
              <input type="text" placeholder="예: 아빠, 엄마, 첫째" value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep("choice")} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">뒤로</button>
              <button onClick={handleJoin} disabled={!inviteCode.trim() || !nickname.trim() || loading} className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50">{loading ? "합류 중..." : "합류하기"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
