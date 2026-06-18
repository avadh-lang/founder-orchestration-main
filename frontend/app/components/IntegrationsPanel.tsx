"use client";
/**
 * IntegrationsPanel.tsx
 * Owner: PoorvaJawale
 *
 * Displays GitHub and Notion integration status in the dashboard.
 * Fetches /api/integrations/verify on mount and renders live badges.
 */

import { useEffect, useState } from "react";

type IntegrationStatus = {
  connected: boolean;
  username?: string;
  error?: string;
};

type IntegrationsData = {
  github: IntegrationStatus;
  notion: IntegrationStatus;
};

function Badge({ name, status }: { name: string; status: IntegrationStatus }) {
  const connected = status.connected;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 16px",
        borderRadius: "10px",
        background: connected
          ? "rgba(34,197,94,0.08)"
          : "rgba(239,68,68,0.08)",
        border: `1px solid ${connected ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Status dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: connected ? "#22c55e" : "#ef4444",
          flexShrink: 0,
          boxShadow: connected
            ? "0 0 8px rgba(34,197,94,0.7)"
            : "0 0 8px rgba(239,68,68,0.5)",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.78rem",
          color: "var(--text-secondary, #a1a1aa)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {name}
      </span>
      <span
        style={{
          marginLeft: "auto",
          fontSize: "0.75rem",
          fontWeight: 600,
          color: connected ? "#4ade80" : "#f87171",
        }}
      >
        {connected
          ? status.username
            ? `@${status.username}`
            : "CONNECTED"
          : "DISCONNECTED"}
      </span>
    </div>
  );
}

export function IntegrationsPanel() {
  const [data, setData] = useState<IntegrationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("clerk-db-jwt") || ""
        : "";

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/integrations/verify`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "14px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          color: "var(--text-secondary, #a1a1aa)",
          fontSize: "0.82rem",
        }}
      >
        Checking integrations…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "14px",
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.2)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          color: "#f87171",
          fontSize: "0.82rem",
        }}
      >
        ◆ Could not reach integration service
        {error ? ` — ${error}` : ""}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "16px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <p
        style={{
          margin: "0 0 8px 0",
          fontSize: "0.72rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-secondary, #a1a1aa)",
          fontWeight: 600,
        }}
      >
        ■ Integrations
      </p>
      <Badge name="GitHub" status={data.github} />
      <Badge name="Notion" status={data.notion} />
    </div>
  );
}
