"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import IssueModal from "./IssueModal";

interface Member { id: string; name: string; color: string }

// FamilyMember 형식 (dashboard에서 넘겨주는 { user: {...} } 구조도 허용)
interface FamilyMember { id: string; role?: string; user: { id: string; name: string; color: string } }

interface Props {
  projectId: string;
  sprintId?: string | null;
  members?: Member[] | FamilyMember[];
}

function normalizeMembers(members: Member[] | FamilyMember[]): Member[] {
  return members.map((m) => {
    if ("user" in m) return { id: m.user.id, name: m.user.name, color: m.user.color };
    return m as Member;
  });
}

export default function CreateIssueFAB({ projectId, sprintId, members = [] }: Props) {
  const [open, setOpen] = useState(false);
  const normalized = normalizeMembers(members);

  return (
    <>
      {/* FAB 버튼 */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 76,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: "50%",
          backgroundColor: "#6366f1",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(99,102,241,0.45)",
          zIndex: 100,
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.93)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* 과제 생성 모달 */}
      {open && (
        <IssueModal
          projectId={projectId}
          sprintId={sprintId}
          members={normalized}
          onClose={() => setOpen(false)}
          onSave={() => {}}
        />
      )}
    </>
  );
}
