"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, X, LogOut } from "lucide-react";
import { mApi } from "../_lib/api";
import Avatar from "../_components/Avatar";

interface User {
  id: string;
  name: string;
  email: string;
  color: string;
}

interface FamilyMember {
  id: string;
  role: "MASTER" | "MEMBER";
  user: User;
}

interface Family {
  id: string;
  name: string;
  inviteCode: string;
  members: FamilyMember[];
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid #e0e7ff",
          borderTopColor: "#6366f1",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#9ca3af",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "20px 20px 8px",
      }}
    >
      {title}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        marginBottom: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function Row({
  children,
  isLast,
}: {
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "13px 16px",
        borderBottom: isLast ? "none" : "1px solid #f8fafc",
      }}
    >
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [nickname, setNickname] = useState("");

  const { data: families, isLoading } = useQuery<Family[]>({
    queryKey: ["m-families"],
    queryFn: mApi.families,
    enabled: !!session?.user,
  });

  const family = families?.[0];

  const joinMutation = useMutation({
    mutationFn: () => mApi.joinFamily({ inviteCode, nickname }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["m-families"] });
      setShowJoinModal(false);
      setInviteCode("");
      setNickname("");
    },
  });

  const handleCopyCode = async () => {
    if (!family?.inviteCode) return;
    await navigator.clipboard.writeText(family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const user = session?.user;

  if (isLoading) return <Spinner />;

  return (
    <div style={{ background: "#f8fafc", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ padding: "24px 20px 4px" }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>설정</span>
      </div>

      {/* Profile */}
      <SectionHeader title="프로필" />
      <div style={{ padding: "0 16px" }}>
        <Card>
          <Row isLast>
            <Avatar
              name={user?.name ?? "?"}
              color={(user as { color?: string })?.color ?? "#6366f1"}
              size={52}
            />
            <div style={{ marginLeft: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                {user?.name ?? "-"}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                {user?.email ?? "-"}
              </div>
            </div>
          </Row>
        </Card>
      </div>

      {/* Family group */}
      {family && (
        <>
          <SectionHeader title="가족 그룹" />
          <div style={{ padding: "0 16px" }}>
            <Card>
              <Row>
                <span style={{ flex: 1, fontSize: 14, color: "#374151", fontWeight: 500 }}>
                  그룹 이름
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                  {family.name}
                </span>
              </Row>
              <Row isLast>
                <span style={{ flex: 1, fontSize: 14, color: "#374151", fontWeight: 500 }}>
                  초대 코드
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <code
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#6366f1",
                      backgroundColor: "#eef2ff",
                      padding: "3px 8px",
                      borderRadius: 6,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {family.inviteCode}
                  </code>
                  <button
                    onClick={handleCopyCode}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: copied ? "#16a34a" : "#6b7280",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </Row>
            </Card>
          </div>

          {/* Members */}
          <SectionHeader title="멤버" />
          <div style={{ padding: "0 16px" }}>
            <Card>
              {family.members.map((member, idx) => (
                <Row key={member.id} isLast={idx === family.members.length - 1}>
                  <Avatar
                    name={member.user.name ?? "?"}
                    color={member.user.color ?? "#6366f1"}
                    size={36}
                  />
                  <div style={{ flex: 1, marginLeft: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                      {member.user.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{member.user.email}</div>
                  </div>
                  {member.role === "MASTER" && (
                    <span
                      style={{
                        backgroundColor: "#eef2ff",
                        color: "#6366f1",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 20,
                      }}
                    >
                      관리자
                    </span>
                  )}
                </Row>
              ))}
            </Card>
          </div>
        </>
      )}

      {/* Join family */}
      <SectionHeader title="가족 참여" />
      <div style={{ padding: "0 16px" }}>
        <Card>
          <Row isLast>
            <button
              onClick={() => setShowJoinModal(true)}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                color: "#6366f1",
                textAlign: "left",
                padding: 0,
              }}
            >
              초대 코드로 가족 참여
            </button>
          </Row>
        </Card>
      </div>

      {/* Account */}
      <SectionHeader title="계정" />
      <div style={{ padding: "0 16px" }}>
        <Card>
          <Row isLast>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 0,
                color: "#ef4444",
              }}
            >
              <LogOut size={17} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>로그아웃</span>
            </button>
          </Row>
        </Card>
      </div>

      {/* Version */}
      <div
        style={{
          textAlign: "center",
          fontSize: 12,
          color: "#9ca3af",
          padding: "20px 0 8px",
        }}
      >
        ARC v1.0.0
      </div>

      <div style={{ height: 16 }} />

      {/* Join Modal */}
      {showJoinModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowJoinModal(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 430,
              backgroundColor: "#fff",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px",
              paddingBottom: "max(24px, env(safe-area-inset-bottom))",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>
                가족 참여
              </span>
              <button
                onClick={() => setShowJoinModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
              >
                <X size={20} />
              </button>
            </div>

            <label style={{ display: "block", marginBottom: 14 }}>
              <div
                style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}
              >
                초대 코드 *
              </div>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="초대 코드를 입력하세요"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 10,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                  letterSpacing: "0.05em",
                }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 24 }}>
              <div
                style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}
              >
                닉네임 *
              </div>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임을 입력하세요"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 10,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </label>

            <button
              onClick={() => joinMutation.mutate()}
              disabled={!inviteCode.trim() || !nickname.trim() || joinMutation.isPending}
              style={{
                width: "100%",
                padding: "13px",
                backgroundColor:
                  !inviteCode.trim() || !nickname.trim() ? "#e0e7ff" : "#6366f1",
                color: !inviteCode.trim() || !nickname.trim() ? "#9ca3af" : "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                cursor:
                  inviteCode.trim() && nickname.trim() ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
            >
              {joinMutation.isPending ? "참여 중..." : "참여하기"}
            </button>

            {joinMutation.isError && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: "#ef4444",
                  textAlign: "center",
                }}
              >
                참여에 실패했어요. 코드를 확인해주세요.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
