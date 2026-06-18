"use client";
/**
 * session/[id]/page.tsx
 * Owner: Omkar25-source
 *
 * Full-viewport two-column layout:
 *   Left  — Live agent pipeline rows + execution log
 *   Right — Deliverables tabs (PRD, Tech, Marketing, Sprint Board)
 */

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { getPdfUrl, getMemory, getSession, deleteSession } from "@/lib/api";

// ── PDF download helper (fetch → blob → click, avoids new-tab navigation) ────
async function triggerPdfDownload(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch PDF");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (e) {
    console.error("PDF download failed:", e);
  }
}

// ── Agent metadata ────────────────────────────────────────────────────────────
const AGENT_META: Record<string, { num: string; label: string; desc: string }> = {
  startup_advisor:     { num: "01", label: "Startup Advisor",     desc: "Idea validation, risk analysis" },
  market_research:     { num: "02", label: "Market Research",     desc: "Live search, SWOT, competitors" },
  product_manager:     { num: "03", label: "Product Manager",     desc: "PRD, user stories → Notion" },
  architect:           { num: "04", label: "Architect",           desc: "Tech stack, GitHub repo" },
  engineering_manager: { num: "05", label: "Engineering Manager", desc: "Sprint plan, GitHub issues" },
  marketing:           { num: "06", label: "Marketing",           desc: "GTM, copy, email sequence" },
};

const AGENT_ORDER = ["startup_advisor","market_research","product_manager","architect","engineering_manager","marketing"];

type AgentStatus = "pending" | "running" | "done" | "error";
interface AgentState { status: AgentStatus; data: any; }

function statusStyle(s: AgentStatus) {
  return {
    pending: { color: "var(--muted)",   bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", dot: "rgba(255,255,255,0.15)", label: "Waiting" },
    running: { color: "var(--accent)",  bg: "var(--glass-accent)",    border: "var(--glass-accent-border)", dot: "var(--accent)", label: "Active" },
    done:    { color: "var(--success)", bg: "var(--success-dim)",      border: "rgba(74,222,128,0.2)",  dot: "var(--success)", label: "Done" },
    error:   { color: "var(--error)",   bg: "var(--error-dim)",        border: "rgba(248,113,113,0.2)", dot: "var(--error)",   label: "Failed" },
  }[s];
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SessionPage() {
  const { id }       = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const router       = useRouter();

  const [agents, setAgents] = useState<Record<string, AgentState>>(() =>
    Object.fromEntries(AGENT_ORDER.map(k => [k, { status: "pending", data: null }]))
  );
  const [done,          setDone]          = useState(false);
  const [error,         setError]         = useState("");
  const [logs,          setLogs]          = useState<string[]>([]);
  const [activeTab,     setActiveTab]     = useState<"prd"|"tech"|"marketing"|"sprints">("prd");
  const [memory,        setMemory]        = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const completedRef  = useRef<Set<string>>(new Set());
  const logsEndRef    = useRef<HTMLDivElement>(null);

  // ── Resizable split ──────────────────────────────────────────────────────────
  const [leftPct, setLeftPct]   = useState(50);          // % width of left column
  const isDragging              = useRef(false);
  const containerRef            = useRef<HTMLDivElement>(null);

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor    = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const { left, width } = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - left) / width) * 100;
      setLeftPct(Math.min(72, Math.max(28, pct)));   // clamp 28%–72%
    };

    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor    = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  };

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  useEffect(() => {
    let es: EventSource;
    const init = async () => {
      const token = await getToken();
      try {
        const session = await getSession(id as string, token ?? undefined);
        if (session.status === "complete") {
          const out: Record<string,any> = session.outputs || {};
          setAgents(Object.fromEntries(AGENT_ORDER.map(k => [k, { status: out[k] ? "done" : "pending", data: out[k] || null }])));
          setDone(true); return;
        }
        if (session.status === "error") {
          const out: Record<string,any> = session.outputs || {};
          setAgents(Object.fromEntries(AGENT_ORDER.map(k => [k, { status: out[k] ? "done" : "pending", data: out[k] || null }])));
          setError("This run encountered an error."); return;
        }
      } catch {}

      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const url = new URL(`${API}/api/sessions/${id}/stream`);
      if (token) url.searchParams.set("token", token);
      es = new EventSource(url.toString());

      setAgents(prev => ({ ...prev, [AGENT_ORDER[0]]: { ...prev[AGENT_ORDER[0]], status: "running" } }));

      es.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "log") setLogs(prev => [...prev, msg.message]);
        if (msg.type === "agent_complete") {
          const { agent, data } = msg;
          completedRef.current.add(agent);
          const hasError = data && data.error;
          setAgents(prev => ({ ...prev, [agent]: { status: hasError ? "error" : "done", data } }));
          if (!hasError) {
            const idx = AGENT_ORDER.indexOf(agent);
            if (idx < AGENT_ORDER.length - 1) {
              const next = AGENT_ORDER[idx + 1];
              setAgents(prev => ({ ...prev, [next]: { ...prev[next], status: "running" } }));
            }
          }
        }
        if (msg.type === "complete") { setDone(true); es.close(); }
        if (msg.type === "error")    { setError(msg.message); es.close(); }
      };
      es.onerror = () => { if (!done) setError("Connection lost. Refresh to retry."); es.close(); };
    };
    init();
    return () => { es?.close(); };
  }, [id]);

  useEffect(() => {
    if (!done) return;
    getToken().then(token => getMemory(id as string, token ?? undefined)).then(setMemory).catch(console.error);
  }, [done, id]);

  const statusDot = error ? "var(--error)" : done ? "var(--success)" : "var(--accent)";

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const token = await getToken();
      await deleteSession(id as string, token ?? undefined);
      router.replace("/history");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div ref={containerRef} className="session-layout" style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* ══════════ LEFT: Pipeline + Log ═══════════════ */}
      <div className="session-left" style={{
        width: `${leftPct}%`,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--glass-border)",
          flexShrink: 0,
          background: "var(--nav-bg)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: statusDot,
              boxShadow: `0 0 10px ${statusDot}`,
              ...(!done && !error ? { animation: "pulse-glow 1.4s ease-in-out infinite" } : {}),
            }} />
            <div className="label">
              {!done && !error ? "Executing" : done ? "Complete" : "Failed"}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
              {done && (
                <button
                  onClick={() => triggerPdfDownload(getPdfUrl(id), `founder-report-${id.slice(0,8)}.pdf`)}
                  className="btn-primary"
                  style={{ padding: "5px 14px", fontSize: "11px" }}
                >
                  ↓ PDF
                </button>
              )}
              {/* Delete session */}
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  title="Delete this session"
                  style={{
                    padding: "5px 12px", borderRadius: "7px", fontSize: "11px",
                    border: "1px solid rgba(248,113,113,0.3)",
                    background: "var(--error-dim)", color: "var(--error)",
                    cursor: "pointer", fontFamily: "Space Mono, monospace",
                  }}
                >
                  🗑
                </button>
              ) : (
                <>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      padding: "5px 12px", borderRadius: "7px", fontSize: "10px",
                      border: "1px solid rgba(248,113,113,0.5)",
                      background: "rgba(248,113,113,0.2)", color: "var(--error)",
                      cursor: deleting ? "default" : "pointer", fontFamily: "Space Mono, monospace",
                      opacity: deleting ? 0.6 : 1,
                    }}
                  >
                    {deleting ? "…" : "Confirm delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      padding: "5px 10px", borderRadius: "7px", fontSize: "10px",
                      border: "1px solid var(--glass-border)",
                      background: "var(--glass)", color: "var(--muted)",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: "18px",
            letterSpacing: "-0.02em",
            marginBottom: "2px",
          }}>
            {error ? "Orchestration Stopped" : done ? "Founder Package Ready" : "Running Agents…"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "11px" }}>
            {error ? "Pipeline halted on a critical failure." : done ? "All agents complete. GitHub + Notion updated." : "Agents run in sequence. Results appear live."}
          </p>
        </div>

        {/* Scrollable pipeline + log */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>

          {error && (
            <div className="glass" style={{
              margin: "16px",
              padding: "12px 16px",
              borderColor: "rgba(248,113,113,0.2)",
              background: "var(--error-dim)",
              color: "var(--error)",
              fontSize: "12px",
            }}>
              {error}
            </div>
          )}

          {/* Agent rows */}
          <div style={{ margin: "16px", borderRadius: "14px", overflow: "hidden", border: "1px solid var(--glass-border)" }}>
            {AGENT_ORDER.map((key, idx) => (
              <AgentRow
                key={key}
                agentKey={key}
                meta={AGENT_META[key]}
                state={agents[key]}
                isLast={idx === AGENT_ORDER.length - 1}
              />
            ))}
          </div>

          {/* Execution log */}
          <div style={{ margin: "0 16px 16px", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--glass-border)" }}>
            <div style={{
              padding: "8px 14px",
              borderBottom: "1px solid var(--glass-border)",
              display: "flex",
              justifyContent: "space-between",
              background: "rgba(255,255,255,0.03)",
            }}>
              <div className="label">Execution Log</div>
              {!done && !error && (
                <div className="label animate-pulse-accent" style={{ color: "var(--accent)" }}>● live</div>
              )}
            </div>
            <div style={{
              fontFamily: "Space Mono, monospace",
              fontSize: "11px",
              lineHeight: 1.7,
              padding: "12px 14px",
              maxHeight: "180px",
              overflowY: "auto",
              color: "var(--log-color)",
              background: "rgba(0,0,0,0.3)",
            }}>
              {logs.length === 0
                ? <span style={{ color: "var(--faint)" }}>_ Initializing agent stream…</span>
                : logs.map((log, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "10px" }}>
                      <span style={{ color: "var(--faint)", flexShrink: 0 }}>{String(idx + 1).padStart(3, "0")}</span>
                      <span>{log}</span>
                    </div>
                  ))
              }
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Memory block */}
          {done && memory && (
            <div className="glass" style={{ margin: "0 16px 16px", overflow: "hidden", borderColor: "rgba(74,222,128,0.2)" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 7px var(--success)", flexShrink: 0 }} />
                <div className="label" style={{ color: "var(--success)" }}>Stored in Founder Memory</div>
              </div>
              {/* Scrollable memory content — capped so it doesn't push CTA offscreen */}
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px", maxHeight: "220px", overflowY: "auto" }}>
                <OField label="Startup Name" value={memory.startupName} accent />
                <OField label="Base Idea"    value={memory.idea} />
                {memory.roadmaps?.length > 0 && (
                  <div>
                    <div className="label" style={{ marginBottom: "6px" }}>Roadmap</div>
                    {memory.roadmaps.map((r: any, idx: number) => (
                      <div key={idx} className="glass-inner" style={{ padding: "8px 12px", marginBottom: "4px" }}>
                        <div style={{ fontWeight: 600, fontSize: "11px", color: "var(--accent)", marginBottom: "2px" }}>
                          {r.phase} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({r.duration})</span>
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--muted)" }}>{r.deliverables?.join(" · ")}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CTA when done */}
          {(done || error) && (
            <div className="glass" style={{ margin: "0 16px 16px", padding: "20px", textAlign: "center" }}>
              <div className="label" style={{ marginBottom: "6px" }}>
                {error ? "Orchestration failed" : "Your founder package is ready"}
              </div>
              <p style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "16px" }}>
                {error ? "Review errors and retry." : "GitHub repo created, Notion PRD published, PDF ready."}
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                {!error && (
                  <button
                    onClick={() => triggerPdfDownload(getPdfUrl(id), `founder-report-${id.slice(0,8)}.pdf`)}
                    className="btn-primary"
                    style={{ padding: "10px 20px", fontSize: "12px" }}
                  >
                    ↓ Download PDF
                  </button>
                )}
                <Link href="/dashboard" className="btn-ghost" style={{ padding: "10px 20px", fontSize: "12px" }}>
                  New Idea
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════ DRAG DIVIDER ═══════════════════════ */}
      <div
        className="session-divider"
        onMouseDown={handleDividerMouseDown}
        title="Drag to resize"
        style={{
          width: "5px",
          flexShrink: 0,
          cursor: "col-resize",
          background: "var(--glass-border)",
          transition: "background 0.15s, width 0.1s",
          position: "relative",
          zIndex: 10,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "var(--accent)";
          e.currentTarget.style.width = "5px";
          e.currentTarget.style.boxShadow = "0 0 12px var(--accent-glow)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "var(--glass-border)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Grip dots */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          pointerEvents: "none",
        }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--muted)", opacity: 0.5 }} />
          ))}
        </div>
      </div>

      {/* ══════════ RIGHT: Deliverables ════════════════ */}
      <div className="session-right" style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "rgba(0,0,0,0.08)",
      }}>
        {/* Deliverables tab strip */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--glass-border)",
          background: "var(--nav-bg)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          flexShrink: 0,
          overflowX: "auto",
        }}>
          {([
            { id: "prd",       label: "Product PRD" },
            { id: "tech",      label: "Tech Specs" },
            { id: "marketing", label: "Marketing" },
            { id: "sprints",   label: "Sprint Board" },
          ] as const).map(tab => {
            const hasData = tab.id === "prd"       ? !!agents.product_manager.data
                          : tab.id === "tech"      ? !!agents.architect.data
                          : tab.id === "marketing" ? !!agents.marketing.data
                          : !!agents.engineering_manager.data;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === tab.id ? "var(--accent)" : "transparent"}`,
                  padding: "14px 18px",
                  fontFamily: "Space Mono, monospace",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  color: activeTab === tab.id ? "var(--text)" : "var(--muted)",
                  cursor: "pointer",
                  marginBottom: "-1px",
                  transition: "color 0.15s",
                  whiteSpace: "nowrap" as const,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {tab.label}
                {hasData && (
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 4px var(--success)", flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

          {activeTab === "prd" && (
            agents.product_manager.data?.prd_markdown
              ? renderMarkdown(agents.product_manager.data.prd_markdown)
              : <Waiting label="Product Manager" />
          )}

          {activeTab === "tech" && (
            agents.architect.data?.data_models ? (
              <div>
                <div className="label" style={{ marginBottom: "12px" }}>Database Models</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {agents.architect.data.data_models.map((model: any, mIdx: number) => (
                    <div key={mIdx} className="glass-inner" style={{ padding: "12px 14px", fontFamily: "Space Mono, monospace", fontSize: "11px" }}>
                      <div style={{ color: "var(--accent)", fontWeight: 700, marginBottom: "6px" }}>class {model.name}</div>
                      {model.fields?.map((field: string, fIdx: number) => (
                        <div key={fIdx} style={{ color: "var(--muted)", paddingLeft: "14px" }}>— {field}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : <Waiting label="Architect" />
          )}

          {activeTab === "marketing" && (
            agents.marketing.data ? (() => {
              const md = agents.marketing.data;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* Tagline */}
                  {md.tagline && (
                    <div className="glass-accent" style={{ padding: "20px", textAlign: "center", borderRadius: "12px" }}>
                      <div className="label-accent" style={{ marginBottom: "8px" }}>Tagline</div>
                      <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--text)", lineHeight: 1.4 }}>"{md.tagline}"</div>
                    </div>
                  )}
                  {/* Landing Copy */}
                  {md.landing_page_copy && (
                    <div>
                      <div className="label" style={{ marginBottom: "12px" }}>Landing Page Copy</div>
                      <div className="glass-inner" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <MField label="Hero Headline" value={md.landing_page_copy.hero_headline} />
                        <MField label="Subheadline"   value={md.landing_page_copy.hero_subheadline} />
                        <MField label="CTA Text"      value={md.landing_page_copy.cta_text} />
                      </div>
                    </div>
                  )}
                  {/* GTM Strategy */}
                  {md.gtm_strategy && (
                    <div>
                      <div className="label" style={{ marginBottom: "10px" }}>GTM Strategy</div>
                      <div className="glass-inner" style={{ padding: "14px 18px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                        {md.gtm_strategy}
                      </div>
                    </div>
                  )}
                  {/* Email Sequence */}
                  {md.email_sequence?.length > 0 && (
                    <EmailSequenceEditor emails={md.email_sequence} />
                  )}
                  {/* LinkedIn Post */}
                  {md.linkedin_post && (
                    <LinkedInPostField postText={md.linkedin_post} />
                  )}
                </div>
              );
            })() : <Waiting label="Marketing Agent" />
          )}

          {activeTab === "sprints" && (
            agents.engineering_manager.data ? (() => {
              const em   = agents.engineering_manager.data;
              const arch = agents.architect.data;
              const repoUrl  = em.github_repo_url || arch?.github_repo_url;
              const repoName = arch?.github_repo_name || (repoUrl ? repoUrl.split("/").pop() : null);

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                  {/* Sprint cards */}
                  {em.sprints?.map((sprint: any, sIdx: number) => (
                    <div key={sIdx} className="glass-inner" style={{ padding: "16px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <div>
                          <div className="label-accent" style={{ marginBottom: "3px" }}>Sprint {sprint.sprint}</div>
                          <div style={{ fontWeight: 600, fontSize: "13px" }}>{sprint.goal}</div>
                        </div>
                        <div className="mono" style={{ fontSize: "10px", color: "var(--muted)", background: "rgba(255,255,255,0.06)", padding: "4px 10px", borderRadius: "6px" }}>
                          {sprint.duration_weeks}w
                        </div>
                      </div>
                      {sprint.tasks?.map((task: any, tIdx: number) => (
                        <div key={tIdx} style={{ padding: "8px 0", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", gap: "12px" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "12px", marginBottom: "2px" }}>{task.title}</div>
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>{task.description}</div>
                          </div>
                          <div className="mono" style={{ fontSize: "9px", color: "var(--muted)", background: "rgba(255,255,255,0.05)", padding: "3px 8px", borderRadius: "4px", flexShrink: 0, alignSelf: "flex-start" }}>
                            {task.label} · {task.story_points}pt
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Definition of Done */}
                  {em.definition_of_done && (
                    <div>
                      <div className="label" style={{ marginBottom: "10px" }}>Definition of Done</div>
                      {em.definition_of_done.map((item: string, idx: number) => (
                        <div key={idx} className="glass-inner" style={{ padding: "10px 14px", fontSize: "12px", display: "flex", gap: "10px", marginBottom: "4px" }}>
                          <span style={{ color: "var(--success)", flexShrink: 0 }}>✓</span>
                          <span style={{ color: "var(--text)" }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })() : <Waiting label="Engineering Manager" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Agent Row ─────────────────────────────────────────────────────────────────
function AgentRow({ agentKey, meta, state, isLast }: { agentKey: string; meta: any; state: AgentState; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const st        = statusStyle(state.status);
  const isRunning = state.status === "running";

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "50px 1fr auto",
          alignItems: "center",
          borderBottom: (!isLast || expanded) ? "1px solid var(--glass-border)" : "none",
          background: isRunning ? "var(--glass-accent)" : "transparent",
          cursor: state.status === "done" ? "pointer" : "default",
          transition: "background 0.15s",
        }}
        onClick={() => state.status === "done" && setExpanded(e => !e)}
        onMouseEnter={e => { if (state.status === "done") e.currentTarget.style.background = "var(--glass-hover)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = isRunning ? "var(--glass-accent)" : "transparent"; }}
      >
        <div className="mono" style={{ padding: "16px 0 16px 18px", fontSize: "10px", color: "var(--accent)", fontWeight: 700, letterSpacing: "0.06em" }}>
          {meta.num}
        </div>
        <div style={{ padding: "16px 12px" }}>
          <div style={{ fontWeight: 600, fontSize: "12px", marginBottom: "2px" }}>{meta.label}</div>
          <div style={{ fontSize: "10px", color: "var(--muted)" }}>{meta.desc}</div>
        </div>
        <div style={{ padding: "16px 16px 16px 0", display: "flex", alignItems: "center", gap: "7px" }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: st.dot, flexShrink: 0,
            boxShadow: isRunning ? `0 0 8px ${st.dot}` : "none",
            ...(isRunning ? { animation: "pulse-glow 1.4s ease-in-out infinite" } : {}),
          }} />
          <span className="mono" style={{ fontSize: "9px", color: st.color, letterSpacing: "0.1em" }}>
            {st.label.toUpperCase()}
          </span>
          {state.status === "done" && (
            <span style={{ color: "var(--muted)", fontSize: "10px" }}>{expanded ? "▲" : "▼"}</span>
          )}
        </div>
      </div>

      {expanded && state.data && (
        <div style={{
          padding: "16px 18px 16px 50px",
          borderBottom: !isLast ? "1px solid var(--glass-border)" : "none",
          background: "rgba(0,0,0,0.18)",
        }}>
          <AgentOutput agentKey={agentKey} data={state.data} />
        </div>
      )}
    </>
  );
}

// ── Agent Output ──────────────────────────────────────────────────────────────
function AgentOutput({ agentKey, data }: { agentKey: string; data: any }) {
  if (!data || data.error) return <p style={{ fontSize: "12px", color: "var(--error)" }}>{data?.error || "No output"}</p>;

  if (agentKey === "startup_advisor") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <OField label="Startup Name"      value={data.startup_name} accent />
      <OField label="Refined Idea"      value={data.refined_idea} />
      <OField label="Problem"           value={data.problem_statement} />
      <OField label="Target Audience"   value={data.target_audience} />
      <OField label="Value Proposition" value={data.value_proposition} />
      <OListField label="Risks"         items={data.risks} />
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div className="label">Recommendation</div>
        <span style={{
          fontSize: "10px", fontFamily: "Space Mono, monospace", fontWeight: 700, padding: "3px 10px",
          borderRadius: "99px", letterSpacing: "0.08em",
          background: data.recommendation === "proceed" ? "var(--success-dim)" : "rgba(251,191,36,0.12)",
          color: data.recommendation === "proceed" ? "var(--success)" : "var(--warning)",
          border: `1px solid ${data.recommendation === "proceed" ? "rgba(74,222,128,0.2)" : "rgba(251,191,36,0.2)"}`,
        }}>
          {(data.recommendation || "").toUpperCase()}
        </span>
      </div>
    </div>
  );

  if (agentKey === "market_research") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <OField label="Market Size"   value={data.market_size} />
      <OField label="Growth Rate"   value={data.market_growth_rate} />
      <OField label="Positioning"   value={data.recommended_positioning} />
      <OListField label="Competitors" items={data.competitors?.map((c: any) => `${c.name} — ${c.description}`)} />
      <OListField label="Market Gaps" items={data.gaps} />
      <OListField label="Trends"      items={data.trends} />
    </div>
  );

  if (agentKey === "product_manager") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {data.notion_url && (
        <a href={data.notion_url} target="_blank" rel="noreferrer" className="btn-ghost" style={{ alignSelf: "flex-start" }}>
          Open in Notion →
        </a>
      )}
      <OListField label="MVP Scope"       items={data.mvp_scope} />
      <OListField label="Success Metrics" items={data.success_metrics} />
      {/* Product Roadmap — backend returns field as "roadmap" */}
      {(data.roadmap || data.product_roadmap) && Array.isArray(data.roadmap || data.product_roadmap) && (data.roadmap || data.product_roadmap).length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: "6px" }}>Product Roadmap</div>
          {(data.roadmap || data.product_roadmap).map((phase: any, i: number) => (
            <div key={i} className="glass-inner" style={{ padding: "9px 12px", marginBottom: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)" }}>
                  {phase.phase || phase.name || `Phase ${i + 1}`}
                </span>
                {phase.duration && (
                  <span className="mono" style={{ fontSize: "9px", color: "var(--muted)", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: "4px" }}>
                    {phase.duration}
                  </span>
                )}
              </div>
              {phase.deliverables?.length > 0 && (
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>{phase.deliverables.join(" · ")}</div>
              )}
              {phase.description && !phase.deliverables && (
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>{phase.description}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (agentKey === "architect") {
    const hasContent = data.system_design || (data.tech_stack && Object.keys(data.tech_stack).length > 0);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {hasContent ? (
          <>
            <OField label="System Design" value={data.system_design} />
            {data.tech_stack && Object.keys(data.tech_stack).length > 0 && (
              <div>
                <div className="label" style={{ marginBottom: "5px" }}>Tech Stack</div>
                <div className="glass-inner" style={{ padding: "10px 12px" }}>
                  {Object.entries(data.tech_stack).map(([k, v]: any) => (
                    <div key={k} style={{ fontSize: "11px", display: "flex", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ color: "var(--muted)", minWidth: "80px", textTransform: "capitalize", flexShrink: 0 }}>{k}</span>
                      <span style={{ color: "var(--text)", fontWeight: 500 }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: "12px", color: "var(--muted)", fontStyle: "italic" }}>
            This session was generated before the latest update. Run a new session to see System Design and Tech Stack here.
          </p>
        )}
      </div>
    );
  }

  if (agentKey === "engineering_manager") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Stats row — Duration + Sprints only */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {[{ val: `${data.total_weeks}w`, label: "Duration" }, { val: data.sprints?.length, label: "Sprints" }].map(stat => (
          <div key={stat.label} className="glass-inner" style={{ padding: "12px", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: "20px", color: "var(--accent)" }}>{stat.val}</div>
            <div className="label" style={{ marginTop: "2px" }}>{stat.label}</div>
          </div>
        ))}
      </div>
      {/* GitHub Repo link */}
      {data.github_repo_url && (
        <a href={data.github_repo_url} target="_blank" rel="noreferrer" className="btn-ghost" style={{ alignSelf: "flex-start", fontSize: "11px" }}>
          GitHub Repo Created →
        </a>
      )}
      {/* Sprints summary */}
      {data.sprints?.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: "5px" }}>Sprints</div>
          {data.sprints.map((sprint: any, sIdx: number) => (
            <div key={sIdx} className="glass-inner" style={{ padding: "9px 12px", marginBottom: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)" }}>Sprint {sprint.sprint}: {sprint.goal}</span>
                <span className="mono" style={{ fontSize: "9px", color: "var(--muted)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px" }}>{sprint.duration_weeks}w</span>
              </div>
              {sprint.tasks?.length > 0 && <SprintTaskList tasks={sprint.tasks} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (agentKey === "marketing") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {data.tagline && (
        <div className="glass-accent" style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "var(--accent)", fontSize: "12px", borderRadius: "10px" }}>
          "{data.tagline}"
        </div>
      )}
      <OField label="GTM Strategy" value={data.gtm_strategy} />
      {/* Launch Channels — backend returns [{channel, tactic, expected_reach}] */}
      {data.launch_channels && data.launch_channels.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: "6px" }}>Launch Channels</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {data.launch_channels.map((ch: any, i: number) => {
              const name   = typeof ch === "string" ? ch : ch.channel || ch.name;
              const tactic = typeof ch !== "string" ? ch.tactic : null;
              const reach  = typeof ch !== "string" ? ch.expected_reach : null;
              return (
                <div key={i} className="glass-inner" style={{ padding: "8px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--cyan)" }}>{name}</span>
                    {reach && <span className="mono" style={{ fontSize: "9px", color: "var(--muted)", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: "4px" }}>{reach}</span>}
                  </div>
                  {tactic && <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "3px" }}>{tactic}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Pricing — backend returns pricing_recommendation.tiers */}
      {(data.pricing_recommendation?.tiers || data.pricing_models) && (
        <div>
          <div className="label" style={{ marginBottom: "6px" }}>Pricing Models</div>
          {(data.pricing_recommendation?.tiers || data.pricing_models || []).map((tier: any, i: number) => (
            <div key={i} className="glass-inner" style={{ padding: "10px 12px", marginBottom: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent)" }}>{tier.name || tier.tier}</span>
                {tier.price && <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--success)", fontFamily: "Space Mono, monospace" }}>{tier.price}</span>}
              </div>
              {tier.features?.length > 0 && (
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>{tier.features.join(" · ")}</div>
              )}
            </div>
          ))}
          {data.pricing_recommendation?.model && (
            <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "4px", fontFamily: "Space Mono, monospace" }}>
              Model: {data.pricing_recommendation.model}
            </div>
          )}
        </div>
      )}
      {/* 90-Day Plan — backend returns "90_day_plan" as string array */}
      {(data["90_day_plan"] || data.execution_plan_90_days || data.plan_90_day) && (
        <div>
          <div className="label" style={{ marginBottom: "6px" }}>90-Day Execution Plan</div>
          {Array.isArray(data["90_day_plan"] || data.execution_plan_90_days)
            ? (data["90_day_plan"] || data.execution_plan_90_days).map((item: string, i: number) => (
                <div key={i} className="glass-inner" style={{ padding: "8px 12px", marginBottom: "4px", display: "flex", gap: "8px" }}>
                  <span style={{ color: "var(--accent)", flexShrink: 0, fontWeight: 700, fontSize: "10px", fontFamily: "Space Mono, monospace" }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: "11px", color: "var(--text)" }}>{item}</span>
                </div>
              ))
            : <OField label="" value={data["90_day_plan"] || data.plan_90_day} />
          }
        </div>
      )}
    </div>
  );

  return <pre style={{ fontSize: "10px", color: "var(--muted)", overflow: "auto", fontFamily: "Space Mono, monospace" }}>{JSON.stringify(data, null, 2)}</pre>;
}

// ── Helper components ─────────────────────────────────────────────────────────

function SprintTaskList({ tasks }: { tasks: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? tasks : tasks.slice(0, 3);
  const hidden  = tasks.length - 3;
  return (
    <>
      {visible.map((t: any, tIdx: number) => (
        <div key={tIdx} style={{ fontSize: "10px", color: "var(--muted)", paddingLeft: "8px", marginBottom: "1px" }}>— {t.title}</div>
      ))}
      {hidden > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          style={{
            fontSize: "10px", color: "var(--accent)", paddingLeft: "8px", marginTop: "2px",
            background: "none", border: "none", cursor: "pointer", padding: "0 0 0 8px",
            textDecoration: "underline", textAlign: "left",
          }}
        >
          {expanded ? "▲ show less" : `+${hidden} more tasks`}
        </button>
      )}
    </>
  );
}

function Waiting({ label }: { label: string }) {
  return (
    <div style={{ padding: "40px 0", textAlign: "center" }}>
      <div style={{ fontSize: "24px", opacity: 0.15, marginBottom: "12px" }}>□</div>
      <div className="label">Waiting for {label}</div>
    </div>
  );
}

function OField({ label, value, accent }: { label: string; value?: string; accent?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div className="label" style={{ marginBottom: "3px" }}>{label}</div>
      <p style={{ fontSize: "12px", lineHeight: 1.6, color: accent ? "var(--accent)" : "var(--text)", fontWeight: accent ? 700 : 400 }}>{value}</p>
    </div>
  );
}

function MField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="label" style={{ marginBottom: "3px" }}>{label}</div>
      <p style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--text)" }}>{value}</p>
    </div>
  );
}

function OListField({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="label" style={{ marginBottom: "5px" }}>{label}</div>
      {items.map((item, i) => (
        <div key={i} style={{ fontSize: "12px", color: "var(--muted)", display: "flex", gap: "8px", marginBottom: "3px" }}>
          <span style={{ color: "rgba(255,255,255,0.15)", flexShrink: 0 }}>—</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function EmailSequenceEditor({ emails }: { emails: any[] }) {
  const [activeIdx,    setActiveIdx]    = useState(0);
  const [copiedIdx,    setCopiedIdx]    = useState<number | null>(null);
  const [editedBodies, setEditedBodies] = useState<Record<number, string>>(() =>
    Object.fromEntries(emails.map((e, i) => [i, e.body || e.body_preview || ""]))
  );
  const handleCopy = (idx: number) => {
    navigator.clipboard.writeText(editedBodies[idx] || "");
    setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000);
  };
  const active = emails[activeIdx];
  return (
    <div>
      <div className="label" style={{ marginBottom: "10px" }}>Email Campaign Sequence</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
        {emails.map((email: any, i: number) => (
          <button key={i} onClick={() => setActiveIdx(i)} className="mono" style={{
            fontSize: "9px", padding: "4px 10px", letterSpacing: "0.08em",
            border: `1px solid ${activeIdx === i ? "var(--accent)" : "var(--glass-border)"}`,
            background: activeIdx === i ? "var(--glass-accent)" : "var(--glass)",
            color: activeIdx === i ? "var(--accent)" : "var(--muted)",
            borderRadius: "6px", cursor: "pointer",
          }}>
            Email {email.email} · {email.send_time}
          </button>
        ))}
      </div>
      <div className="glass-inner" style={{ overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600 }}>{active.subject}</div>
            {active.goal && <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>Goal: {active.goal}</div>}
          </div>
          <button onClick={() => handleCopy(activeIdx)} className="btn-ghost" style={{ padding: "4px 10px", fontSize: "10px" }}>
            {copiedIdx === activeIdx ? "Copied!" : "Copy"}
          </button>
        </div>
        <textarea
          value={editedBodies[activeIdx]}
          onChange={e => setEditedBodies(prev => ({ ...prev, [activeIdx]: e.target.value }))}
          rows={8}
          style={{ width: "100%", padding: "12px 14px", fontSize: "12px", lineHeight: 1.7, resize: "none", outline: "none", border: "none", background: "rgba(0,0,0,0.2)", color: "var(--text)", fontFamily: "'Space Grotesk', sans-serif" }}
        />
      </div>
    </div>
  );
}

function LinkedInPostField({ postText }: { postText: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div className="label">LinkedIn Launch Post</div>
        <button onClick={() => { navigator.clipboard.writeText(postText); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="btn-ghost" style={{ padding: "4px 10px", fontSize: "10px" }}>
          {copied ? "Copied!" : "Copy Post"}
        </button>
      </div>
      <pre className="glass-inner" style={{ padding: "14px 16px", fontSize: "12px", whiteSpace: "pre-wrap", fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.7, color: "var(--text)" }}>
        {postText}
      </pre>
    </div>
  );
}

function renderMarkdown(md: string) {
  if (!md) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {md.split("\n").map((line, idx) => {
        const t = line.trim();
        if (t.startsWith("# "))   return <h1  key={idx} style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "15px", color: "var(--accent)", borderBottom: "1px solid var(--glass-border)", paddingBottom: "6px", marginTop: "14px" }}>{t.substring(2)}</h1>;
        if (t.startsWith("## "))  return <h2  key={idx} style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "13px", color: "var(--text)", marginTop: "10px" }}>{t.substring(3)}</h2>;
        if (t.startsWith("### ")) return <h3  key={idx} style={{ fontFamily: "Space Mono, monospace", fontSize: "10px", letterSpacing: "0.1em", color: "var(--muted)", marginTop: "8px", textTransform: "uppercase" as const }}>{t.substring(4)}</h3>;
        if (t.startsWith("- ") || t.startsWith("* ")) return <div key={idx} style={{ fontSize: "12px", color: "var(--muted)", paddingLeft: "12px", display: "flex", gap: "8px" }}><span style={{ color: "rgba(255,255,255,0.15)" }}>—</span><span>{t.substring(2)}</span></div>;
        if (t) return <p key={idx} style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.65 }}>{t}</p>;
        return <div key={idx} style={{ height: "4px" }} />;
      })}
    </div>
  );
}
