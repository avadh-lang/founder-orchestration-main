"use client";
/**
 * Sidebar.tsx
 * Owner: avadh-lang
 *
 * Collapsible left-panel: logo, nav links, integration status,
 * recent session history, ThemeToggle, and user button.
 * Adapts to auth state via Clerk hooks.
 */

import { useEffect, useState } from "react";
import { useUser, useAuth, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

// ── Types ─────────────────────────────────────────────────────────────────────
type IntegrationStatus = { valid: boolean; username?: string };
type Integrations = { github: IntegrationStatus; notion: IntegrationStatus } | null;
type SessionItem   = { id: string; startup_idea: string; status: string; created_at: string };

// ── Status color helpers ───────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  complete: "var(--success)",
  running:  "var(--accent)",
  error:    "var(--error)",
  pending:  "var(--muted)",
};

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// ── Sidebar component ─────────────────────────────────────────────────────────
type Props = {
  open: boolean;
  onClose: () => void;
  isMobile?: boolean;
};

export function Sidebar({ open, onClose, isMobile }: Props) {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken }             = useAuth();
  const pathname                 = usePathname();
  const router                   = useRouter();

  const [integrations, setIntegrations] = useState<Integrations>(null);
  const [sessions,     setSessions]     = useState<SessionItem[]>([]);
  const [loadingInt,   setLoadingInt]   = useState(false);
  const [loadingSess,  setLoadingSess]  = useState(false);

  // Fetch integrations and history when user is signed in
  useEffect(() => {
    if (!isSignedIn) return;

    setLoadingInt(true);
    getToken()
      .then(token =>
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/integrations/verify`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then(r => r.json())
      )
      .then(setIntegrations)
      .catch(console.error)
      .finally(() => setLoadingInt(false));

    setLoadingSess(true);
    getToken()
      .then(token =>
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/sessions`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then(r => r.json())
      )
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoadingSess(false));
  }, [isSignedIn, getToken]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <aside
      className={`app-sidebar${isMobile ? (open ? " sidebar-open" : "") : ""}`}
      style={isMobile ? undefined : { width: open ? 260 : 0 }}
      aria-label="Sidebar"
    >
      <div className="app-sidebar-inner">

        {/* ── Header ──────────────────────────────── */}
        <div style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid var(--glass-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <Link href={isSignedIn ? "/dashboard" : "/"} style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}>
            <img src="/maestro-logo.jpeg" alt="Maestro.ai" width={32} height={32} style={{ borderRadius: "6px", flexShrink: 0, objectFit: "contain" }} />
            <span style={{
              fontFamily: "Space Mono, monospace",
              fontWeight: 700,
              fontSize: "11px",
              letterSpacing: "0.14em",
              color: "var(--accent)",
              textTransform: "uppercase",
              textShadow: "0 0 20px var(--accent-glow)",
            }}>Maestro.ai</span>
          </Link>
          <button
            onClick={onClose}
            title="Collapse sidebar"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              padding: "4px 6px",
              borderRadius: "6px",
              fontSize: "14px",
              lineHeight: 1,
              transition: "color 0.15s, background 0.15s",
              flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--glass-inner)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
          >
            ◀
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0" }}>

          {/* ── Auth: not signed in ─────────────── */}
          {isLoaded && !isSignedIn && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "4px 0 16px" }}>
              <SignInButton>
                <button className="btn-ghost" style={{ width: "100%", justifyContent: "center" }}>
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                  Get Access →
                </button>
              </SignUpButton>
            </div>
          )}

          {/* ── Nav ─────────────────────────────── */}
          {isSignedIn && (
            <nav style={{ marginBottom: "8px" }}>
              <NavItem href="/dashboard"  label="◆ New Session"  active={pathname === "/dashboard"} />
              <NavItem href="/history"    label="◆ History"      active={pathname === "/history"} />
            </nav>
          )}

          {/* ── Integrations ────────────────────── */}
          {isSignedIn && (
            <section style={{ marginBottom: "8px" }}>
              <SectionLabel>Integrations</SectionLabel>
              {loadingInt ? (
                <div className="label animate-pulse-accent" style={{ padding: "6px 4px", color: "var(--accent)" }}>Checking…</div>
              ) : integrations ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <IntegRow
                    label="GitHub"
                    valid={integrations.github.valid}
                    sub={integrations.github.username}
                  />
                  <IntegRow label="Notion" valid={integrations.notion.valid} />
                </div>
              ) : (
                <div className="label" style={{ padding: "6px 4px", color: "var(--muted)" }}>Unavailable</div>
              )}
            </section>
          )}

          {/* ── Recent Sessions ─────────────────── */}
          {isSignedIn && (
            <section style={{ marginBottom: "8px" }}>
              <SectionLabel>Recent Sessions</SectionLabel>
              {loadingSess ? (
                <div className="label animate-pulse-accent" style={{ padding: "6px 4px", color: "var(--accent)" }}>Loading…</div>
              ) : sessions.length === 0 ? (
                <div className="label" style={{ padding: "6px 4px", color: "var(--muted)" }}>No sessions yet</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {sessions.slice(0, 12).map(s => (
                    <button
                      key={s.id}
                      onClick={() => router.push(`/session/${s.id}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        background: pathname === `/session/${s.id}` ? "var(--glass-hover)" : "none",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => { if (pathname !== `/session/${s.id}`) (e.currentTarget as HTMLButtonElement).style.background = "var(--glass-inner)"; }}
                      onMouseLeave={e => { if (pathname !== `/session/${s.id}`) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                    >
                      <span
                        className="dot-sm"
                        style={{
                          background: STATUS_DOT[s.status] || "var(--muted)",
                          boxShadow: s.status === "running" ? `0 0 6px ${STATUS_DOT.running}` : "none",
                        }}
                      />
                      <span style={{
                        fontSize: "12px",
                        color: pathname === `/session/${s.id}` ? "var(--text)" : "var(--muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        lineHeight: 1.4,
                      }}>
                        {truncate(s.startup_idea, 36)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Footer ──────────────────────────────── */}
        <div style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--glass-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <ThemeToggle />
          {isSignedIn && <UserButton afterSignOutUrl="/" />}
        </div>

      </div>
    </aside>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`sidebar-nav-item${active ? " active" : ""}`}
    >
      {label}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "Space Mono, monospace",
      fontSize: "9px",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "var(--faint)",
      padding: "6px 10px 4px",
      fontWeight: 700,
    }}>
      {children}
    </div>
  );
}

function IntegRow({ label, valid, sub }: { label: string; valid: boolean; sub?: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "7px 10px",
      borderRadius: "8px",
      background: valid ? "rgba(74,222,128,0.05)" : "rgba(248,113,113,0.05)",
      border: `1px solid ${valid ? "rgba(74,222,128,0.14)" : "rgba(248,113,113,0.14)"}`,
      marginBottom: "3px",
    }}>
      <span
        className="dot-sm"
        style={{
          background: valid ? "var(--success)" : "var(--error)",
          boxShadow: `0 0 6px ${valid ? "var(--success)" : "var(--error)"}`,
        }}
      />
      <span style={{ fontSize: "12px", color: "var(--muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}{sub ? ` @${sub}` : ""}
      </span>
      <span style={{
        fontFamily: "Space Mono, monospace",
        fontSize: "8px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: valid ? "var(--success)" : "var(--error)",
        flexShrink: 0,
      }}>
        {valid ? "OK" : "OFF"}
      </span>
    </div>
  );
}
