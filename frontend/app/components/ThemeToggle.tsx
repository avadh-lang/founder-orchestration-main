"use client";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "dark" | "light" | null;
    const initial = stored || "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        padding: "6px 12px",
        background: "var(--glass)",
        border: "1px solid var(--glass-border)",
        borderRadius: "99px",
        cursor: "pointer",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        transition: "border-color 0.15s, background 0.15s",
        fontFamily: "Space Mono, monospace",
        fontSize: "10px",
        letterSpacing: "0.08em",
        color: "var(--muted)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "var(--glass-border-hover)";
        e.currentTarget.style.color = "var(--text)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--glass-border)";
        e.currentTarget.style.color = "var(--muted)";
      }}
    >
      {/* Track */}
      <span style={{
        position: "relative",
        width: "28px",
        height: "16px",
        borderRadius: "99px",
        background: theme === "dark"
          ? "rgba(167,139,250,0.20)"
          : "rgba(124,58,237,0.20)",
        border: `1px solid ${theme === "dark" ? "rgba(167,139,250,0.35)" : "rgba(124,58,237,0.35)"}`,
        display: "inline-block",
        flexShrink: 0,
        transition: "background 0.25s, border-color 0.25s",
      }}>
        {/* Thumb */}
        <span style={{
          position: "absolute",
          top: "2px",
          left: theme === "dark" ? "2px" : "12px",
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: "var(--accent)",
          boxShadow: "0 0 6px var(--accent-glow)",
          transition: "left 0.22s cubic-bezier(0.34,1.56,0.64,1), background 0.25s",
          display: "block",
        }} />
      </span>

      <span style={{ userSelect: "none" }}>
        {theme === "dark" ? "Dark" : "Light"}
      </span>
    </button>
  );
}
