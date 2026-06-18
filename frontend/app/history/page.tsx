"use client";
/**
 * history/page.tsx
 * Owner: PoorvaJawale
 *
 * Full-page history view — session list with delete controls.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { deleteSession, deleteAllSessions } from "@/lib/api";

interface Session {
  id: string;
  startup_idea: string;
  status: string;
  created_at: string;
}

const STATUS: Record<string, { bg: string; border: string; color: string; dot: string; label: string }> = {
  complete: { bg: "var(--success-dim)",  border: "rgba(74,222,128,0.2)",  color: "var(--success)", dot: "var(--success)", label: "Complete" },
  running:  { bg: "var(--glass-accent)", border: "var(--glass-accent-border)", color: "var(--accent)", dot: "var(--accent)", label: "Running" },
  error:    { bg: "var(--error-dim)",    border: "rgba(248,113,113,0.2)", color: "var(--error)",   dot: "var(--error)",   label: "Error" },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function HistoryPage() {
  const [sessions,       setSessions]       = useState<Session[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);
  const [deletingAll,    setDeletingAll]    = useState(false);
  const [confirmAll,     setConfirmAll]     = useState(false);
  const { getToken } = useAuth();

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    getToken()
      .then(token =>
        fetch(`${API}/api/sessions`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then(r => r.json())
      )
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [getToken]);

  const handleDeleteOne = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      const token = await getToken();
      await deleteSession(id, token ?? undefined);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    setConfirmAll(false);
    try {
      const token = await getToken();
      await deleteAllSessions(token ?? undefined);
      setSessions([]);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>

      {/* ── Page header ────────────────────────── */}
      <div className="history-header" style={{
        padding: "24px 32px 20px",
        borderBottom: "1px solid var(--glass-border)",
        flexShrink: 0,
        background: "var(--nav-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "16px",
      }}>
        <div>
          <div className="label-accent" style={{ marginBottom: "4px" }}>◆ Session History</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "22px", letterSpacing: "-0.02em", marginBottom: "4px" }}>
            All Runs
          </h1>
          <p style={{ fontSize: "12px", color: "var(--muted)" }}>
            Click any session to view its outputs. Delete individual runs or clear all history.
          </p>
        </div>

        {/* Delete All button */}
        {sessions.length > 0 && (
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            {!confirmAll ? (
              <button
                onClick={() => setConfirmAll(true)}
                disabled={deletingAll}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid rgba(248,113,113,0.3)",
                  background: "var(--error-dim)",
                  color: "var(--error)",
                  fontSize: "11px",
                  fontFamily: "Space Mono, monospace",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  opacity: deletingAll ? 0.5 : 1,
                }}
              >
                {deletingAll ? "Deleting…" : "🗑 Delete All History"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--error)", fontFamily: "Space Mono, monospace" }}>Sure?</span>
                <button
                  onClick={handleDeleteAll}
                  style={{
                    padding: "6px 14px", borderRadius: "6px",
                    border: "1px solid rgba(248,113,113,0.5)",
                    background: "rgba(248,113,113,0.2)", color: "var(--error)",
                    fontSize: "11px", cursor: "pointer", fontFamily: "Space Mono, monospace",
                  }}
                >
                  Yes, delete all
                </button>
                <button
                  onClick={() => setConfirmAll(false)}
                  style={{
                    padding: "6px 14px", borderRadius: "6px",
                    border: "1px solid var(--glass-border)",
                    background: "var(--glass)", color: "var(--muted)",
                    fontSize: "11px", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Session list ───────────────────────── */}
      <div className="history-list" style={{ flex: 1, overflowY: "auto", padding: "20px 32px" }}>

        {loading && (
          <div className="label animate-pulse-accent" style={{ color: "var(--accent)", padding: "20px 0" }}>
            Loading sessions…
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", gap: "16px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", opacity: 0.25 }}>□</div>
            <div className="label">No sessions yet</div>
            <p style={{ fontSize: "13px", color: "var(--muted)", maxWidth: "280px" }}>
              Run your first orchestration from the Dashboard to see results here.
            </p>
            <Link href="/dashboard" className="btn-primary" style={{ marginTop: "8px", textDecoration: "none", padding: "11px 24px" }}>
              New Session →
            </Link>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "12px" }}>
            {sessions.map(s => {
              const st = STATUS[s.status] || STATUS.error;
              const isDeleting = deletingId === s.id;
              return (
                <div key={s.id} style={{ position: "relative" }}>
                  <Link href={`/session/${s.id}`} style={{ textDecoration: "none", display: "block" }}>
                    <div
                      className="glass"
                      style={{
                        padding: "18px 20px",
                        paddingRight: "52px",         /* room for delete btn */
                        cursor: "pointer",
                        transition: "background 0.15s, border-color 0.15s, opacity 0.2s",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        opacity: isDeleting ? 0.4 : 1,
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.background = "var(--glass-hover)";
                        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--glass-border-hover)";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.background = "var(--glass)";
                        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--glass-border)";
                      }}
                    >
                      {/* Status badge */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "6px",
                          padding: "3px 10px", borderRadius: "99px",
                          fontSize: "9px", fontFamily: "Space Mono, monospace", fontWeight: 700, letterSpacing: "0.1em",
                          background: st.bg, border: `1px solid ${st.border}`, color: st.color,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: st.dot, flexShrink: 0, boxShadow: `0 0 5px ${st.dot}` }} />
                          {st.label.toUpperCase()}
                        </span>
                        <span className="mono" style={{ fontSize: "10px", color: "var(--faint)" }}>
                          {s.id.slice(0, 8)}
                        </span>
                      </div>

                      {/* Idea */}
                      <p style={{
                        fontSize: "13px", lineHeight: 1.55, color: "var(--text)", fontWeight: 500,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                      }}>
                        {s.startup_idea}
                      </p>

                      {/* Date */}
                      <div className="label" style={{ marginTop: "2px" }}>{fmtDate(s.created_at)}</div>
                    </div>
                  </Link>

                  {/* Delete button — overlays top-right of card */}
                  <button
                    onClick={e => handleDeleteOne(e, s.id)}
                    disabled={isDeleting}
                    title="Delete this session"
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      border: "1px solid rgba(248,113,113,0.25)",
                      background: "var(--error-dim)",
                      color: "var(--error)",
                      fontSize: "13px",
                      cursor: isDeleting ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: isDeleting ? 0.4 : 0.7,
                      transition: "opacity 0.15s, border-color 0.15s",
                      zIndex: 2,
                    }}
                    onMouseEnter={e => { if (!isDeleting) e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={e => { if (!isDeleting) e.currentTarget.style.opacity = "0.7"; }}
                  >
                    {isDeleting ? "…" : "✕"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
