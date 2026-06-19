const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function createSession(
  idea: string,
  files?: { businessPlan?: File; competitorReport?: File; prdFile?: File },
  token?: string
) {
  const form = new FormData();
  form.append("startup_idea", idea);
  if (files?.businessPlan) form.append("business_plan", files.businessPlan);
  if (files?.competitorReport) form.append("competitor_report", files.competitorReport);
  if (files?.prdFile) form.append("prd_file", files.prdFile);

  const res = await fetch(`${API}/api/sessions`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ session_id: string }>;
}

export function streamSession(sessionId: string, token?: string) {
  const url = `${API}/api/sessions/${sessionId}/stream`;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new EventSource(url);
}

export async function getSession(sessionId: string, token?: string) {
  const res = await fetch(`${API}/api/sessions/${sessionId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listSessions(token?: string) {
  const res = await fetch(`${API}/api/sessions`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function getPdfUrl(sessionId: string) {
  return `${API}/api/sessions/${sessionId}/pdf`;
}

export async function getMemory(sessionId: string, token?: string) {
  const res = await fetch(`${API}/api/sessions/${sessionId}/memory`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    session_id: string;
    startupName: string;
    idea: string;
    roadmaps: any[];
    documents: any[];
    created_at: string;
  }>;
}

export async function deleteSession(sessionId: string, token?: string) {
  const res = await fetch(`${API}/api/sessions/${sessionId}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteAllSessions(token?: string) {
  const res = await fetch(`${API}/api/sessions`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function verifyIntegrations(token?: string) {
  const res = await fetch(`${API}/api/integrations/verify`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    github: { valid: boolean; username?: string; error?: string };
    notion: { valid: boolean; error?: string };
  }>;
}
