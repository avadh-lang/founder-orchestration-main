"use client";
/**
 * dashboard/page.tsx
 * Owner: PoorvaJawale
 *
 * Full-viewport two-column layout:
 *   Left  — Idea form + optional PDF uploads + submit
 *   Right — Agent pipeline preview cards
 *
 * Nav and integrations status now live in the Sidebar (AppShell).
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { createSession, verifyIntegrations } from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────
const EXAMPLE_IDEAS = [
  "An AI-powered personal finance app that analyzes spending patterns and gives real-time coaching",
  "A marketplace connecting freelance developers with early-stage startups for equity-based work",
  "A B2B SaaS tool that auto-generates ISO compliance documentation from codebase analysis",
];

const AGENTS = [
  { num: "01", label: "Startup Advisor",    desc: "Validates your idea, surfaces risks, confirms market fit",                  color: "var(--accent)"  },
  { num: "02", label: "Market Research",    desc: "Live web search, TAM/SAM sizing, SWOT, competitor mapping",                color: "var(--cyan)"    },
  { num: "03", label: "Product Manager",    desc: "User personas, PRD, sprint roadmap — published to Notion",                 color: "var(--accent)"  },
  { num: "04", label: "Architect",          desc: "Tech stack selection, system design, scaffolds GitHub repo",               color: "var(--cyan)"    },
  { num: "05", label: "Engineering Mgr",   desc: "Sprint plan, story points, issues created on GitHub",                      color: "var(--amber)"   },
  { num: "06", label: "Marketing",          desc: "Tagline, landing copy, GTM strategy, email sequence, LinkedIn post",      color: "var(--amber)"   },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [idea,            setIdea]            = useState("");
  const [businessPlan,    setBusinessPlan]    = useState<File | null>(null);
  const [competitorReport,setCompetitorReport]= useState<File | null>(null);
  const [prdFile,         setPrdFile]         = useState<File | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");
  const [integrations,    setIntegrations]    = useState<{ github: { valid: boolean; username?: string }; notion: { valid: boolean } } | null>(null);
  const [checkingInt,     setCheckingInt]     = useState(true);

  const bpRef  = useRef<HTMLInputElement>(null);
  const crRef  = useRef<HTMLInputElement>(null);
  const prdRef = useRef<HTMLInputElement>(null);

  const router    = useRouter();
  const { getToken } = useAuth();

  useEffect(() => {
    getToken()
      .then(token => verifyIntegrations(token ?? undefined))
      .then(setIntegrations)
      .catch(console.error)
      .finally(() => setCheckingInt(false));
  }, [getToken]);

  const isBlocked = !integrations || !integrations.github.valid || !integrations.notion.valid;

  const handleSubmit = async () => {
    if (!idea.trim() || loading || checkingInt || isBlocked) return;
    setError("");
    setLoading(true);
    try {
      const token = await getToken();
      const { session_id } = await createSession(
        idea,
        { businessPlan: businessPlan || undefined, competitorReport: competitorReport || undefined, prdFile: prdFile || undefined },
        token ?? undefined,
      );
      router.push(`/session/${session_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start session");
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-grid">

      {/* ══════════ LEFT: Idea Form ══════════════ */}
      <div className="dashboard-left">
        {/* Header */}
        <div style={{
          padding: "28px 32px 20px",
          borderBottom: "1px solid var(--glass-border)",
          flexShrink: 0,
          background: "var(--nav-bg)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}>
          <div className="label-accent" style={{ marginBottom: "4px" }}>◆ New Session</div>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: "22px",
            letterSpacing: "-0.02em",
            marginBottom: "4px",
          }}>
            What's your startup idea?
          </h1>
          <p style={{ fontSize: "12px", color: "var(--muted)" }}>
            Describe it in 1–3 sentences. Six AI agents build your complete founder package.
          </p>
        </div>

        {/* Scrollable form body */}
        <div style={{ flex: 1, padding: "24px 32px 32px", display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Integrations status strip */}
          {!checkingInt && integrations && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <IntegChip valid={integrations.github.valid} label={`GitHub${integrations.github.username ? " @" + integrations.github.username : ""}`} />
              <IntegChip valid={integrations.notion.valid} label="Notion" />
              {isBlocked && (
                <span style={{ fontSize: "11px", color: "var(--muted)", marginLeft: "4px" }}>
                  ← connect both to run
                </span>
              )}
            </div>
          )}

          {/* Textarea */}
          <div
            className="glass"
            style={{ overflow: "hidden", transition: "box-shadow 0.2s" }}
            onFocusCapture={e => (e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-dim)")}
            onBlurCapture={e  => (e.currentTarget.style.boxShadow = "none")}
          >
            <textarea
              value={idea}
              onChange={e => setIdea(e.target.value)}
              placeholder="e.g. An AI tool that reads job descriptions and auto-tailors resumes for each application…"
              rows={7}
              onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleSubmit(); }}
              style={{
                width: "100%",
                padding: "18px",
                background: "transparent",
                color: "var(--text)",
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "14px",
                lineHeight: 1.65,
                resize: "none",
                outline: "none",
                border: "none",
              }}
            />
            <div style={{
              padding: "8px 18px 14px",
              display: "flex",
              justifyContent: "space-between",
              borderTop: "1px solid var(--glass-border)",
            }}>
              <span className="label">{idea.length} chars</span>
              <span className="label mono">⌘↵ to run</span>
            </div>
          </div>

          {/* Supporting docs */}
          <div className="glass" style={{ padding: "16px 18px" }}>
            <div className="label" style={{ marginBottom: "12px" }}>□ Supporting Documents (PDF · optional)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              {[
                { label: "Business Plan",     file: businessPlan,      ref: bpRef,  set: setBusinessPlan },
                { label: "Competitor Report", file: competitorReport,  ref: crRef,  set: setCompetitorReport },
                { label: "PRD Document",      file: prdFile,           ref: prdRef, set: setPrdFile },
              ].map(({ label, file, ref, set }) => (
                <div key={label}>
                  <div className="label" style={{ marginBottom: "5px" }}>{label}</div>
                  <button
                    type="button"
                    onClick={() => ref.current?.click()}
                    className="glass-inner"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: file ? "var(--text)" : "var(--muted)",
                      background: "none",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {file ? file.name : "Select PDF"}
                    </span>
                    {file && (
                      <span
                        onClick={e => { e.stopPropagation(); set(null); }}
                        style={{ color: "var(--error)", fontWeight: 700, marginLeft: "6px", flexShrink: 0 }}
                      >
                        ×
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>
            <input ref={bpRef}  type="file" accept=".pdf" style={{ display: "none" }} onChange={e => setBusinessPlan(e.target.files?.[0] ?? null)} />
            <input ref={crRef}  type="file" accept=".pdf" style={{ display: "none" }} onChange={e => setCompetitorReport(e.target.files?.[0] ?? null)} />
            <input ref={prdRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => setPrdFile(e.target.files?.[0] ?? null)} />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "12px 16px",
              background: "var(--error-dim)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: "10px",
              color: "var(--error)",
              fontSize: "13px",
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            className="btn-primary"
            style={{ width: "100%", padding: "16px", fontSize: "14px", borderRadius: "12px" }}
            onClick={handleSubmit}
            disabled={!idea.trim() || loading || checkingInt || isBlocked}
          >
            {loading
              ? "Starting orchestration…"
              : isBlocked && !checkingInt
              ? "Connect integrations first"
              : "Run Orchestration →"}
          </button>

          {/* Example ideas */}
          <div>
            <div className="label" style={{ marginBottom: "10px" }}>Example ideas</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {EXAMPLE_IDEAS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setIdea(ex)}
                  className="glass"
                  style={{
                    textAlign: "left",
                    padding: "12px 16px",
                    fontSize: "12px",
                    color: "var(--muted)",
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                    lineHeight: 1.55,
                    transition: "background 0.15s, color 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-hover)"; e.currentTarget.style.color = "var(--text)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--glass)"; e.currentTarget.style.color = "var(--muted)"; }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ RIGHT: Agent Preview ═════════ */}
      <div className="dashboard-right">
        {/* Header */}
        <div style={{
          padding: "28px 32px 20px",
          borderBottom: "1px solid var(--glass-border)",
          flexShrink: 0,
          background: "var(--nav-bg)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}>
          <div className="label-accent" style={{ marginBottom: "4px" }}>■ Agent Pipeline</div>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: "22px",
            letterSpacing: "-0.02em",
            marginBottom: "4px",
          }}>
            What agents will build
          </h2>
          <p style={{ fontSize: "12px", color: "var(--muted)" }}>
            Six specialists run in sequence. Results appear as each one completes.
          </p>
        </div>

        {/* Agent cards */}
        <div style={{ flex: 1, padding: "20px 28px 32px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {AGENTS.map((a, i) => (
            <div
              key={a.num}
              className="glass"
              style={{
                padding: "16px 18px",
                display: "grid",
                gridTemplateColumns: "44px 1fr",
                alignItems: "flex-start",
                gap: "12px",
                transition: "background 0.15s, border-color 0.15s",
                cursor: "default",
                animation: `fade-up 0.3s ease ${i * 0.05}s both`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--glass)"; }}
            >
              <div style={{
                fontFamily: "Space Mono, monospace",
                fontSize: "10px",
                fontWeight: 700,
                color: a.color,
                letterSpacing: "0.08em",
                paddingTop: "2px",
                textShadow: `0 0 14px ${a.color}`,
              }}>
                {a.num}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "4px", color: "var(--text)" }}>
                  {a.label}
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.6 }}>
                  {a.desc}
                </div>
              </div>
            </div>
          ))}

          {/* Output pills */}
          <div style={{ marginTop: "8px" }}>
            <div className="label" style={{ marginBottom: "12px" }}>Deliverables you receive</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
              {["GitHub Repository", "Notion PRD", "Sprint Board", "PDF Report", "GTM Strategy", "Email Sequence", "LinkedIn Post"].map(o => (
                <span
                  key={o}
                  className="glass"
                  style={{
                    padding: "6px 12px",
                    fontSize: "11px",
                    color: "var(--muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    borderRadius: "99px",
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, boxShadow: "0 0 5px var(--accent)" }} />
                  {o}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IntegChip({ valid, label }: { valid: boolean; label: string }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "4px 10px",
      borderRadius: "99px",
      fontSize: "10px",
      fontFamily: "Space Mono, monospace",
      fontWeight: 700,
      letterSpacing: "0.06em",
      background: valid ? "var(--success-dim)" : "var(--error-dim)",
      border: `1px solid ${valid ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
      color: valid ? "var(--success)" : "var(--error)",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: valid ? "var(--success)" : "var(--error)", flexShrink: 0 }} />
      {label}
    </span>
  );
}
