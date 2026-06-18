"use client";
/**
 * AppShell.tsx
 * Owner: avadh-lang
 *
 * Persistent full-viewport shell: collapsible sidebar + scrollable main area.
 * Ambient background orbs live here so they cover the whole viewport once.
 * Sidebar state is persisted in localStorage.
 */

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";

type Props = { children: React.ReactNode };

export function AppShell({ children }: Props) {
  const [open, setOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) { setOpen(false); return; }
    const stored = localStorage.getItem("sidebar");
    if (stored === "closed") setOpen(false);
  }, [isMobile]);

  const toggle = (next: boolean) => {
    setOpen(next);
    if (!isMobile) localStorage.setItem("sidebar", next ? "open" : "closed");
  };

  return (
    <div className="app-shell">

      {/* ── Ambient background orbs ─────────────── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-15%", left: "8%", width: "700px", height: "700px", borderRadius: "50%", background: "radial-gradient(circle, var(--body-orb-1) 0%, transparent 65%)", filter: "blur(48px)" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "3%", width: "550px", height: "550px", borderRadius: "50%", background: "radial-gradient(circle, var(--body-orb-2) 0%, transparent 65%)", filter: "blur(48px)" }} />
        <div style={{ position: "absolute", top: "45%", left: "55%", width: "380px", height: "380px", borderRadius: "50%", background: "radial-gradient(circle, var(--body-orb-3) 0%, transparent 65%)", filter: "blur(48px)" }} />
      </div>

      {/* ── Mobile overlay backdrop ──────────────── */}
      {isMobile && open && (
        <div className="sidebar-overlay" onClick={() => toggle(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────── */}
      <Sidebar open={open} onClose={() => toggle(false)} isMobile={isMobile} />

      {/* ── Main content area ───────────────────── */}
      <div className="app-main">

        {!open && (
          <div style={{ position: "absolute", top: "16px", left: "16px", zIndex: 30 }}>
            <button
              onClick={() => toggle(true)}
              title="Open sidebar"
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "7px 12px", borderRadius: "8px",
                background: "var(--glass)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                border: "1px solid var(--glass-border)", color: "var(--muted)",
                fontSize: "12px", cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
                fontFamily: "Space Mono, monospace", letterSpacing: "0.04em",
              }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "var(--text)"; b.style.borderColor = "var(--glass-border-hover)"; }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "var(--muted)"; b.style.borderColor = "var(--glass-border)"; }}
            >
              ▶ Menu
            </button>
          </div>
        )}

        <div className="app-main-scroll" style={{ position: "relative", zIndex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
