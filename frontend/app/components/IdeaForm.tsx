"use client";
/**
 * IdeaForm.tsx
 * Owner: PoorvaJawale
 *
 * The startup idea submission form on the dashboard.
 * Handles file uploads (PDF drag-drop slots), form validation,
 * and POST to /api/sessions — then redirects to the session page.
 */

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type FileSlot = {
  key: "business_plan" | "competitor_report" | "prd_file";
  label: string;
  hint: string;
};

const FILE_SLOTS: FileSlot[] = [
  { key: "business_plan",    label: "Business Plan",      hint: "PDF · optional" },
  { key: "competitor_report",label: "Competitor Report",  hint: "PDF · optional" },
  { key: "prd_file",         label: "PRD",                hint: "PDF · optional" },
];

export function IdeaForm() {
  const router  = useRouter();
  const [idea,  setIdea]  = useState("");
  const [files, setFiles] = useState<Record<string, File | null>>({
    business_plan: null, competitor_report: null, prd_file: null,
  });
  const [dragging, setDragging] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── drag-drop helpers ────────────────────────────────────────────────────
  const handleDrop = (key: string, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(null);
    const file = e.dataTransfer.files[0];
    if (file) setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handleFileInput = (key: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const removeFile = (key: string) => {
    setFiles((prev) => ({ ...prev, [key]: null }));
    if (fileRefs.current[key]) fileRefs.current[key]!.value = "";
  };

  // ── submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) { setError("Please describe your startup idea."); return; }
    setError(null);
    setLoading(true);

    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("clerk-db-jwt") || ""
          : "";

      const fd = new FormData();
      fd.append("startup_idea", idea.trim());
      for (const slot of FILE_SLOTS) {
        const f = files[slot.key];
        if (f) fd.append(slot.key, f);
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const { session_id } = await res.json();
      router.push(`/session/${session_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setLoading(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Idea textarea */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label
          htmlFor="startup_idea"
          style={{
            fontSize: "0.72rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-secondary, #a1a1aa)",
            fontWeight: 600,
          }}
        >
          ■ Startup Idea
        </label>
        <textarea
          id="startup_idea"
          className="input-field"
          rows={5}
          placeholder="Describe the problem you're solving, your target market, and your solution…"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          style={{
            resize: "vertical",
            minHeight: "120px",
            fontFamily: "var(--font-sans, sans-serif)",
            fontSize: "0.93rem",
            lineHeight: 1.6,
          }}
        />
      </div>

      {/* File slots */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.72rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-secondary, #a1a1aa)",
            fontWeight: 600,
          }}
        >
          □ Supporting Documents
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
          {FILE_SLOTS.map((slot) => {
            const file = files[slot.key];
            const isDragging = dragging === slot.key;
            return (
              <div
                key={slot.key}
                className="glass-inner"
                onDragOver={(e) => { e.preventDefault(); setDragging(slot.key); }}
                onDragLeave={() => setDragging(null)}
                onDrop={(e) => handleDrop(slot.key, e)}
                onClick={() => fileRefs.current[slot.key]?.click()}
                style={{
                  padding: "14px 12px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  border: isDragging
                    ? "1.5px dashed var(--accent)"
                    : file
                    ? "1.5px solid rgba(167,139,250,0.4)"
                    : "1.5px dashed rgba(255,255,255,0.12)",
                  transition: "border-color 0.2s, background 0.2s",
                  textAlign: "center",
                  userSelect: "none",
                }}
              >
                <input
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  ref={(el) => { fileRefs.current[slot.key] = el; }}
                  onChange={(e) => handleFileInput(slot.key, e)}
                />
                {file ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 600 }}>
                      ◆ {file.name.length > 18 ? `${file.name.slice(0, 15)}…` : file.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(slot.key); }}
                      style={{
                        marginTop: "4px",
                        fontSize: "0.7rem",
                        color: "var(--text-secondary, #a1a1aa)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      × remove
                    </button>
                  </div>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-primary, #e2e8f0)", fontWeight: 500 }}>
                      {slot.label}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: "0.68rem", color: "var(--text-secondary, #a1a1aa)" }}>
                      {slot.hint}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#f87171" }}>
          ◆ {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="btn-primary"
        disabled={loading}
        style={{ alignSelf: "flex-start", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? "Launching agents…" : "Run Orchestration →"}
      </button>
    </form>
  );
}
