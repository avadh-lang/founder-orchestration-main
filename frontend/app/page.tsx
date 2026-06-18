"use client";
/**
 * page.tsx — Landing / Home
 * Owner: avadh-lang
 *
 * Full-viewport hero for unauthenticated visitors.
 * Signed-in users are redirected to /dashboard immediately.
 */

import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const AGENTS = [
  { num: "01", label: "Startup Advisor",    desc: "Idea validation, risks, market fit" },
  { num: "02", label: "Market Research",    desc: "Live web search, SWOT, competitor map" },
  { num: "03", label: "Product Manager",    desc: "PRD, user stories, roadmap → Notion" },
  { num: "04", label: "Architect",          desc: "Tech stack, system design, GitHub repo" },
  { num: "05", label: "Engineering Mgr",   desc: "Sprint plan, story points, GitHub issues" },
  { num: "06", label: "Marketing",          desc: "GTM, landing copy, email sequence" },
];

const OUTPUTS = ["GitHub Repo", "Notion PRD", "Sprint Board", "PDF Report", "GTM Strategy", "Email Sequence"];

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) router.replace("/dashboard");
  }, [isSignedIn, router]);

  // Show nothing while checking auth (avoids flash of landing for signed-in users)
  if (!isLoaded || isSignedIn) return null;

  return (
    <div style={{
      height: "100%",
      overflowY: "auto",
      display: "grid",
      gridTemplateRows: "1fr auto",
      padding: "0 0 0 0",
    }}>

      {/* ── Hero + pipeline ──────────────────────── */}
      <div className="landing-grid" style={{
        display: "grid",
        gridTemplateColumns: "1fr 420px",
        gap: "0",
        minHeight: "calc(100vh - 56px)",
      }}>

        {/* Left: hero text */}
        <div className="landing-hero" style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 48px 60px 48px",
          borderRight: "1px solid var(--glass-border)",
        }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "5px 14px",
            marginBottom: "32px",
            background: "var(--glass-accent)",
            border: "1px solid var(--glass-accent-border)",
            borderRadius: "99px",
            fontSize: "10px",
            fontFamily: "Space Mono, monospace",
            letterSpacing: "0.12em",
            color: "var(--accent)",
            textTransform: "uppercase" as const,
            alignSelf: "flex-start",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block", boxShadow: "0 0 8px var(--accent)" }} />
            Multi-Agent AI Platform
          </div>

          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(36px, 5vw, 62px)",
            lineHeight: 1.06,
            letterSpacing: "-0.025em",
            color: "var(--text)",
            marginBottom: "24px",
            maxWidth: "600px",
          }}>
            Your startup,{" "}
            <span style={{ color: "var(--accent)", textShadow: "0 0 40px var(--accent-glow)" }}>
              orchestrated.
            </span>
          </h1>

          <p style={{
            color: "var(--muted)",
            fontSize: "16px",
            lineHeight: 1.75,
            maxWidth: "480px",
            marginBottom: "44px",
          }}>
            Describe your idea. Six specialized AI agents produce your complete
            founder package — research, PRD, architecture, sprints, and GTM —
            in under five minutes.
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" as const, marginBottom: "52px" }}>
            <SignUpButton>
              <button className="btn-primary" style={{ padding: "14px 32px", fontSize: "14px" }}>
                Start Building →
              </button>
            </SignUpButton>
            <SignInButton>
              <button className="btn-ghost" style={{ padding: "14px 28px", fontSize: "14px" }}>
                Sign In
              </button>
            </SignInButton>
          </div>

          {/* Output pills */}
          <div>
            <div className="label" style={{ marginBottom: "14px" }}>What you receive</div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "8px" }}>
              {OUTPUTS.map(o => (
                <span
                  key={o}
                  className="glass"
                  style={{
                    padding: "6px 14px",
                    fontSize: "11px",
                    color: "var(--muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    borderRadius: "99px",
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, boxShadow: "0 0 6px var(--accent)" }} />
                  {o}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: agent pipeline card */}
        <div className="landing-pipeline" style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "40px 24px",
          background: "rgba(0,0,0,0.12)",
        }}>
          <div className="label-accent" style={{ marginBottom: "4px", paddingLeft: "4px" }}>Agent Pipeline</div>
          <div className="label" style={{ marginBottom: "20px", paddingLeft: "4px" }}>Sequential Execution</div>

          <div className="glass" style={{ overflow: "hidden" }}>
            {AGENTS.map((a, i) => (
              <div
                key={a.num}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr 8px",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderBottom: i < AGENTS.length - 1 ? "1px solid var(--glass-border)" : "none",
                  gap: "12px",
                  transition: "background 0.15s",
                  cursor: "default",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--glass-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div className="mono" style={{ fontSize: "10px", color: "var(--accent)", fontWeight: 700, letterSpacing: "0.06em" }}>
                  {a.num}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "12px", marginBottom: "2px" }}>{a.label}</div>
                  <div style={{ fontSize: "10px", color: "var(--muted)" }}>{a.desc}</div>
                </div>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--glass-border-hover)", flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="landing-footer" style={{
        borderTop: "1px solid var(--glass-border)",
        padding: "18px 48px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "var(--nav-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}>
        <span className="site-logo" style={{ fontSize: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
          <img src="/maestro-logo.jpeg" alt="" width={18} height={18} style={{ borderRadius: "3px", objectFit: "contain" }} />
          Maestro.ai
        </span>
        <span className="label">AI-Powered Startup Infrastructure</span>
      </footer>
    </div>
  );
}
