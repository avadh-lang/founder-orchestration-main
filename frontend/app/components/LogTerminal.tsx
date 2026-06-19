"use client";
/**
 * LogTerminal.tsx
 * Owner: Omkar25-source
 *
 * Scrolling terminal-style log view that displays live SSE log messages
 * during an agent orchestration run. Auto-scrolls to the latest entry.
 */

import { useEffect, useRef } from "react";

export type LogEntry = {
  id: string;        // unique key (use crypto.randomUUID() or Date.now())
  message: string;
  ts: number;        // timestamp ms
};

type Props = {
  logs: LogEntry[];
  /** Optional max height — defaults to 260px */
  maxHeight?: string | number;
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export function LogTerminal({ logs, maxHeight = 260 }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div
      style={{
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Terminal header bar */}
      <div
        style={{
          padding: "8px 14px",
          background: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {/* Fake traffic lights */}
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span
            key={c}
            style={{ width: 10, height: 10, borderRadius: "50%", background: c, flexShrink: 0 }}
          />
        ))}
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.68rem",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          agent log
        </span>
      </div>

      {/* Log body */}
      <div
        style={{
          maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
          overflowY: "auto",
          padding: "12px 14px",
          fontFamily: "var(--font-mono, 'Space Mono', monospace)",
          fontSize: "0.76rem",
          lineHeight: 1.7,
        }}
      >
        {logs.length === 0 ? (
          <span style={{ color: "rgba(110,231,183,0.35)" }}>
            Waiting for agents to start…
          </span>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "rgba(110,231,183,0.4)", flexShrink: 0, userSelect: "none" }}>
                {formatTime(entry.ts)}
              </span>
              <span style={{ color: "#6ee7b7", wordBreak: "break-word" }}>
                {entry.message}
              </span>
            </div>
          ))
        )}
        {/* Blinking cursor */}
        <span
          style={{
            display: "inline-block",
            width: "7px",
            height: "13px",
            background: "#6ee7b7",
            marginLeft: "2px",
            verticalAlign: "middle",
            animation: "blink 1.1s step-end infinite",
          }}
        />
        <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
