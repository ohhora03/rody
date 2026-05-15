"use client";

import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "arc-onboarding-v1";

interface Slide {
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  items?: { icon: string; text: string }[];
}

const SLIDES: Slide[] = [
  {
    emoji: "👋",
    title: "ARC에 오신 걸 환영해요!",
    subtitle: "가족과 함께하는 목표 관리",
    description: "ARC는 가족이 함께 목표를 세우고, 역할을 나눠 달성해나가는 도구예요. 핵심 개념 3가지만 알면 바로 시작할 수 있어요.",
    color: "#6366f1",
    items: [
      { icon: "📋", text: "과제 — 해야 할 일 하나하나" },
      { icon: "📦", text: "백로그 — 모든 과제의 보관함" },
      { icon: "⚡", text: "스프린트 — 기간을 정한 실행 단위" },
    ],
  },
  {
    emoji: "📋",
    title: "과제",
    subtitle: "할 일의 가장 작은 단위",
    description: "가족이 함께 해야 할 일 하나하나를 과제로 만들어요. 담당자를 지정하고 우선순위와 점수를 매겨서 관리할 수 있어요.",
    color: "#8b5cf6",
    items: [
      { icon: "👤", text: "담당자를 지정해 책임을 명확하게" },
      { icon: "🔴", text: "우선순위로 중요도 표시 (높음/보통/낮음)" },
      { icon: "⭐", text: "스토리 포인트로 난이도/규모 표현" },
      { icon: "🔄", text: "상태로 진행 흐름 추적 (준비→진행중→해결→종료)" },
    ],
  },
  {
    emoji: "📦",
    title: "백로그",
    subtitle: "모든 과제가 모이는 곳",
    description: "아직 스프린트에 넣지 않은 과제들이 여기에 모여 있어요. 새로운 아이디어나 앞으로 해야 할 일을 미리 쌓아두는 공간이에요.",
    color: "#06b6d4",
    items: [
      { icon: "✏️", text: "언제든 새 과제를 추가할 수 있어요" },
      { icon: "📌", text: "스프린트 시작 전 여기서 과제를 선별해요" },
      { icon: "🔍", text: "상태별 필터로 원하는 과제만 볼 수 있어요" },
    ],
  },
  {
    emoji: "⚡",
    title: "스프린트",
    subtitle: "기간을 정하고 함께 달려요",
    description: "1~2주 단위로 기간을 정해 과제를 집중적으로 달성하는 단위예요. 스프린트를 반복할수록 가족의 실행력이 쌓여요.",
    color: "#f59e0b",
    items: [
      { icon: "📅", text: "기간을 정해 목표를 구체화해요" },
      { icon: "🎯", text: "백로그에서 이번에 할 과제를 선택해요" },
      { icon: "📊", text: "진행률이 자동으로 계산돼요" },
      { icon: "✅", text: "완료 후 다음 스프린트로 이어가요" },
    ],
  },
  {
    emoji: "🚀",
    title: "이제 시작해볼까요?",
    subtitle: "권장 시작 순서",
    description: "처음이라면 이 순서대로 해보세요. 금방 익숙해질 거예요!",
    color: "#10b981",
    items: [
      { icon: "1️⃣", text: "백로그에서 + 버튼으로 과제를 만들어요" },
      { icon: "2️⃣", text: "스프린트 탭에서 새 스프린트를 만들어요" },
      { icon: "3️⃣", text: "과제를 스프린트에 배정하고 시작해요" },
      { icon: "4️⃣", text: "홈에서 진행 상황을 함께 확인해요" },
    ],
  },
];

export default function OnboardingGuide() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);
  const [exiting, setExiting] = useState(false);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setVisible(true);
  }, []);

  function dismiss() {
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
      setExiting(false);
    }, 300);
  }

  function next() {
    if (current < SLIDES.length - 1) setCurrent((c) => c + 1);
    else dismiss();
  }

  function prev() {
    if (current > 0) setCurrent((c) => c - 1);
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (dx < -50) next();
    else if (dx > 50) prev();
    startX.current = null;
  }

  if (!visible) return null;

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  return (
    <>
      {/* 딤 배경 */}
      <div
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.55)",
          zIndex: 500,
          opacity: exiting ? 0 : 1,
          transition: "opacity 0.3s ease",
        }}
        onClick={dismiss}
      />

      {/* 가이드 카드 */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: "fixed", left: 20, right: 20,
          top: "50%", transform: exiting ? "translate(0, -40%) scale(0.9)" : "translate(0, -50%)",
          zIndex: 501,
          backgroundColor: "#fff",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          opacity: exiting ? 0 : 1,
          transition: "all 0.3s ease",
        }}
      >
        {/* 컬러 헤더 */}
        <div style={{
          backgroundColor: slide.color,
          padding: "32px 24px 28px",
          textAlign: "center",
          position: "relative",
        }}>
          {/* 닫기 버튼 */}
          <button
            onClick={dismiss}
            style={{
              position: "absolute", top: 14, right: 14,
              background: "rgba(255,255,255,0.25)", border: "none", cursor: "pointer",
              borderRadius: "50%", width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 16, lineHeight: 1,
            }}
          >
            ×
          </button>

          <div style={{ fontSize: 52, marginBottom: 12, lineHeight: 1 }}>{slide.emoji}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
            {slide.title}
          </div>
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500,
            background: "rgba(255,255,255,0.15)", borderRadius: 20,
            display: "inline-block", padding: "4px 12px",
          }}>
            {slide.subtitle}
          </div>
        </div>

        {/* 본문 */}
        <div style={{ padding: "20px 24px 24px" }}>
          <p style={{
            fontSize: 14, color: "#4b5563", lineHeight: 1.65,
            margin: "0 0 18px", textAlign: "center",
          }}>
            {slide.description}
          </p>

          {slide.items && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {slide.items.map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  backgroundColor: "#f8fafc", borderRadius: 12, padding: "10px 14px",
                }}>
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{item.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* 인디케이터 + 버튼 */}
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
            {/* 점 인디케이터 */}
            <div style={{ display: "flex", gap: 5, flex: 1 }}>
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  style={{
                    width: i === current ? 20 : 6, height: 6,
                    borderRadius: 3, border: "none", cursor: "pointer",
                    backgroundColor: i === current ? slide.color : "#d1d5db",
                    transition: "all 0.25s ease",
                    padding: 0,
                  }}
                />
              ))}
            </div>

            {/* 이전 버튼 */}
            {current > 0 && (
              <button
                onClick={prev}
                style={{
                  padding: "10px 16px", borderRadius: 12, border: "1.5px solid #e5e7eb",
                  background: "#fff", color: "#6b7280", fontSize: 13, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                이전
              </button>
            )}

            {/* 다음/시작 버튼 */}
            <button
              onClick={next}
              style={{
                padding: "10px 20px", borderRadius: 12, border: "none",
                backgroundColor: slide.color, color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                flex: current === 0 ? 1 : "unset",
              }}
            >
              {isLast ? "시작하기 🚀" : "다음"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
