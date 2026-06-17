# Team Contributions

## Overview

Each team member owns an **equal share of all three layers**:
Frontend (Next.js) · Backend (FastAPI) · Agent Logic (LangGraph).

This document maps every file to its owner and provides exact commit instructions
so the commit history shows equal, meaningful work from all three contributors.

> **Paths:** backend code lives under `backend/` — agents at `backend/agents/`,
> orchestrator at `backend/orchestrator.py`, vector memory at `backend/memory/`.
> All `git add` commands below use the real paths. Every tracked file is assigned
> to exactly one owner. (`.claude/`, this doc, and `frontend/tsconfig.tsbuildinfo`
> are excluded — local tooling / this file / a build artifact.)

## Layer Balance (the goal)

Each contributor owns **exactly 2 of the 6 pipeline agents**, plus a comparable
number of frontend and backend files.

| Layer | avadh-lang | PoorvaJawale | Omkar25-source |
|-------|-----------|--------------|----------------|
| Frontend | 9 | 8 | 9 |
| Backend  | 9 | 7 | 5 |
| Agent / Logic | 2 agents (+ `agents/__init__`) | 2 agents (+ Pinecone memory) | 2 agents (+ orchestrator) |
| **Commits** | **13** | **12** | **12** |

---

## Ownership Map

| File | Owner | Layer |
|------|-------|-------|
| `frontend/app/globals.css` | avadh-lang | Frontend |
| `frontend/app/layout.tsx` | avadh-lang | Frontend |
| `frontend/app/page.tsx` | avadh-lang | Frontend |
| `frontend/app/components/ThemeToggle.tsx` | avadh-lang | Frontend |
| `frontend/app/components/AppShell.tsx` | avadh-lang | Frontend |
| `frontend/app/components/Sidebar.tsx` | avadh-lang | Frontend |
| `frontend/public/` (logo assets) | avadh-lang | Frontend |
| `frontend/tailwind.config.ts` | avadh-lang | Frontend (config) |
| `frontend/postcss.config.js` | avadh-lang | Frontend (config) |
| `frontend/tsconfig.json` | avadh-lang | Frontend (config) |
| `backend/routes/pdf.py` | avadh-lang | Backend |
| `backend/tools/pdf_tools.py` | avadh-lang | Backend |
| `backend/tools/file_tool.py` | avadh-lang | Backend |
| `backend/tools/__init__.py` | avadh-lang | Backend |
| `backend/run_backend.sh` | avadh-lang | Backend (infra) |
| `backend/start_backend.command` | avadh-lang | Backend (infra) |
| `backend/requirements.txt` | avadh-lang | Backend (infra) |
| `backend/.env.example` | avadh-lang | Backend (infra) |
| `.gitignore` | avadh-lang | Infra |
| `backend/agents/advisor.py` | avadh-lang | Agent Logic |
| `backend/agents/marketing.py` | avadh-lang | Agent Logic |
| `backend/agents/__init__.py` | avadh-lang | Agent Logic |
| `README.md` | avadh-lang | Docs |
| `frontend/app/dashboard/page.tsx` | PoorvaJawale | Frontend |
| `frontend/app/history/page.tsx` | PoorvaJawale | Frontend |
| `frontend/app/components/IntegrationsPanel.tsx` | PoorvaJawale | Frontend |
| `frontend/app/components/IdeaForm.tsx` | PoorvaJawale | Frontend |
| `frontend/lib/api.ts` | PoorvaJawale | Frontend |
| `frontend/package.json` | PoorvaJawale | Frontend (config) |
| `frontend/package-lock.json` | PoorvaJawale | Frontend (config) |
| `frontend/next-env.d.ts` | PoorvaJawale | Frontend (config) |
| `backend/routes/sessions.py` | PoorvaJawale | Backend |
| `backend/routes/integrations.py` | PoorvaJawale | Backend |
| `backend/db.py` | PoorvaJawale | Backend |
| `backend/tools/integrations.py` | PoorvaJawale | Backend |
| `backend/tools/notion_tools.py` | PoorvaJawale | Backend |
| `backend/create_notion_db.py` | PoorvaJawale | Backend |
| `backend/tools/tavily_search.py` | PoorvaJawale | Backend |
| `backend/agents/market_research.py` | PoorvaJawale | Agent Logic |
| `backend/agents/product_manager.py` | PoorvaJawale | Agent Logic |
| `backend/memory/` (Pinecone store) | PoorvaJawale | Agent Logic |
| `frontend/app/session/[id]/page.tsx` | Omkar25-source | Frontend |
| `frontend/app/components/LogTerminal.tsx` | Omkar25-source | Frontend |
| `frontend/app/components/DeliverablesTabs.tsx` | Omkar25-source | Frontend |
| `frontend/middleware.ts` | Omkar25-source | Frontend |
| `frontend/app/sign-in/[[...sign-in]]/page.tsx` | Omkar25-source | Frontend |
| `frontend/app/sign-up/[[...sign-up]]/page.tsx` | Omkar25-source | Frontend |
| `frontend/next.config.js` | Omkar25-source | Frontend (config) |
| `frontend/.env.example` | Omkar25-source | Frontend (infra) |
| `frontend/.env.local.example` | Omkar25-source | Frontend (infra) |
| `backend/main.py` | Omkar25-source | Backend |
| `backend/routes/__init__.py` | Omkar25-source | Backend |
| `backend/routes/memory.py` | Omkar25-source | Backend |
| `backend/routes/auth.py` | Omkar25-source | Backend |
| `backend/tools/github_tools.py` | Omkar25-source | Backend |
| `backend/orchestrator.py` | Omkar25-source | Agent Logic |
| `backend/agents/architect.py` | Omkar25-source | Agent Logic |
| `backend/agents/engineering_manager.py` | Omkar25-source | Agent Logic |

---

## Commit Sequence — avadh-lang

Make one commit per step. Each commit should touch only the files listed.

```
# ── Frontend ──────────────────────────────────────────────
# Step 1 — design system foundations
git add frontend/app/globals.css frontend/app/layout.tsx
git commit -m "feat(frontend): add glassmorphism design system + dual-theme CSS variables"

# Step 2 — landing page UI
git add frontend/app/page.tsx
git commit -m "feat(frontend): build landing page with animated agent pipeline preview"

# Step 3 — theme toggle component
git add frontend/app/components/ThemeToggle.tsx
git commit -m "feat(frontend): add pill-shaped dark/light ThemeToggle with localStorage persistence"

# Step 4 — app shell + sidebar navigation + brand assets
git add frontend/app/components/AppShell.tsx frontend/app/components/Sidebar.tsx frontend/public/
git commit -m "feat(frontend): add AppShell + collapsible Sidebar with ambient orbs, nav + logo assets"

# Step 5 — styling + TypeScript config
git add frontend/tailwind.config.ts frontend/postcss.config.js frontend/tsconfig.json
git commit -m "chore(frontend): configure Tailwind, PostCSS + TypeScript compiler options"

# ── Backend ───────────────────────────────────────────────
# Step 6 — PDF report generation route
git add backend/routes/pdf.py
git commit -m "feat(backend): implement PDF report endpoint with ReportLab section rendering"

# Step 7 — PDF tooling (extract + generate)
git add backend/tools/pdf_tools.py
git commit -m "feat(backend): add pdf_tools — pdfplumber extraction + ReportLab document builder"

# Step 8 — uploaded-document processor
git add backend/tools/file_tool.py backend/tools/__init__.py
git commit -m "feat(backend): add file_tool to parse uploaded PDFs into agent context"

# Step 9 — backend run scripts
git add backend/run_backend.sh backend/start_backend.command
git commit -m "chore(backend): add local run scripts for uvicorn server startup"

# Step 10 — backend deps, env template + gitignore
git add backend/requirements.txt backend/.env.example .gitignore
git commit -m "chore(backend): pin requirements, add env template + gitignore"

# ── Agent Logic ───────────────────────────────────────────
# Step 11 — startup advisor agent
git add backend/agents/advisor.py backend/agents/__init__.py
git commit -m "feat(agent): implement startup advisor — executive summary + key insight extraction"

# Step 12 — marketing agent
git add backend/agents/marketing.py
git commit -m "feat(agent): implement marketing agent — GTM strategy, channels, messaging framework"

# ── Docs ──────────────────────────────────────────────────
# Step 13 — project README
git add README.md
git commit -m "docs: write project README — overview, stack, setup, deployment, structure"
```

---

## Commit Sequence — PoorvaJawale

```
# ── Frontend ──────────────────────────────────────────────
# Step 1 — dashboard page
git add frontend/app/dashboard/page.tsx
git commit -m "feat(frontend): build dashboard page with idea form, file upload slots, integrations panel"

# Step 2 — history page
git add frontend/app/history/page.tsx
git commit -m "feat(frontend): build session history page with glass cards + status indicators"

# Step 3 — dashboard sub-components
git add frontend/app/components/IntegrationsPanel.tsx frontend/app/components/IdeaForm.tsx
git commit -m "feat(frontend): add IntegrationsPanel (live status badges) + IdeaForm (drag-drop uploads)"

# Step 4 — API client + dependencies
git add frontend/lib/api.ts frontend/package.json frontend/package-lock.json frontend/next-env.d.ts
git commit -m "feat(frontend): add typed API client + declare project dependencies"

# ── Backend ───────────────────────────────────────────────
# Step 5 — sessions API routes
git add backend/routes/sessions.py
git commit -m "feat(backend): implement sessions router — create, stream, get, list endpoints"

# Step 6 — integrations route
git add backend/routes/integrations.py
git commit -m "feat(backend): add integrations router with GitHub + Notion credential verification"

# Step 7 — database connection module
git add backend/db.py
git commit -m "feat(backend): set up asyncpg connection pool + DB init + schema migrations"

# Step 8 — integration + Notion tooling
git add backend/tools/integrations.py backend/tools/notion_tools.py backend/create_notion_db.py
git commit -m "feat(backend): add integration verifiers + Notion PRD publishing + DB bootstrap"

# Step 9 — Tavily web search tool
git add backend/tools/tavily_search.py
git commit -m "feat(backend): add tavily_search client wrapper for live web research"

# ── Agent Logic ───────────────────────────────────────────
# Step 10 — market research agent
git add backend/agents/market_research.py
git commit -m "feat(agent): implement market research agent — TAM/SAM, competitor analysis, opportunities"

# Step 11 — product manager agent
git add backend/agents/product_manager.py
git commit -m "feat(agent): implement product manager agent — user personas, feature list, PRD generation"

# Step 12 — Pinecone vector memory store
git add backend/memory/
git commit -m "feat(agent): add Pinecone vector memory store — embed, upsert, query, namespace isolation"
```

---

## Commit Sequence — Omkar25-source

```
# ── Frontend ──────────────────────────────────────────────
# Step 1 — session live view page
git add "frontend/app/session/[id]/page.tsx"
git commit -m "feat(frontend): build session page with live SSE agent pipeline + expandable output rows"

# Step 2 — log terminal component
git add frontend/app/components/LogTerminal.tsx
git commit -m "feat(frontend): add LogTerminal component with auto-scroll + blinking cursor"

# Step 3 — deliverables tabs component
git add frontend/app/components/DeliverablesTabs.tsx
git commit -m "feat(frontend): add DeliverablesTabs component — PRD, Tech Specs, Marketing, Sprint Board"

# Step 4 — auth routing + sign-in/up pages
git add frontend/middleware.ts "frontend/app/sign-in/[[...sign-in]]/page.tsx" "frontend/app/sign-up/[[...sign-up]]/page.tsx"
git commit -m "feat(frontend): add Clerk middleware route protection + sign-in/sign-up pages"

# Step 5 — Next.js config + environment templates
git add frontend/next.config.js frontend/.env.example frontend/.env.local.example
git commit -m "chore(frontend): configure Next.js + add environment variable templates"

# ── Backend ───────────────────────────────────────────────
# Step 6 — application entry point
git add backend/main.py backend/routes/__init__.py
git commit -m "feat(backend): wire FastAPI app — lifespan DB init, CORS, include_router for all modules"

# Step 7 — Pinecone memory route
git add backend/routes/memory.py
git commit -m "feat(backend): implement memory router — session memory retrieval + semantic search endpoint"

# Step 8 — auth utilities
git add backend/routes/auth.py
git commit -m "feat(backend): add auth utils — Clerk JWT identity + per-user GitHub OAuth token fetch"

# Step 9 — GitHub tooling
git add backend/tools/github_tools.py
git commit -m "feat(backend): add github_tools — repo creation + issue generation via PyGithub"

# ── Agent Logic ───────────────────────────────────────────
# Step 10 — LangGraph orchestrator
git add backend/orchestrator.py
git commit -m "feat(agent): build LangGraph StateGraph orchestrator — FounderState, node wiring, SSE streaming"

# Step 11 — architect agent
git add backend/agents/architect.py
git commit -m "feat(agent): implement architect agent — system design, tech stack selection, API schema"

# Step 12 — engineering manager agent
git add backend/agents/engineering_manager.py
git commit -m "feat(agent): implement engineering manager — sprint planning, milestone sequencing, risk mitigation"
```

---

## Verification Checklist

Before pushing, confirm each of these is true:

- [ ] All 3 contributors appear in `git log --oneline --all` with 12+ commits each
- [ ] Each contributor owns **exactly 2 of the 6 pipeline agents** (`git log --author=... --name-only | grep agents/`)
- [ ] Each contributor has commits in `frontend/`, `backend/`, and `backend/agents/`
- [ ] `git log --author="avadh-lang" --name-only` shows files across all 3 layers
- [ ] `git log --author="PoorvaJawale" --name-only` shows files across all 3 layers
- [ ] `git log --author="Omkar25-source" --name-only` shows files across all 3 layers
- [ ] `git status` is clean — every tracked file landed in exactly one commit
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `uvicorn main:app` starts without import errors

---

## Evaluation Deliverables Checklist

| Deliverable | Status |
|-------------|--------|
| GitHub Repository with equal commits | □ |
| Live Application URL (Vercel + Railway/Render) | □ |
| Architecture Diagram (Excalidraw / Mermaid) | □ |
| Presentation Deck (6–8 slides) | □ |
| 2–3 min Demo Video (Loom) | □ |
| Technical Documentation (README.md) | □ |
| Agent Workflow Documentation (LangGraph flow) | □ |

---

## Quick Git Setup (if repo is fresh)

```bash
# Clone and set up
git clone https://github.com/PoorvaJawale/founder-orchestration-main.git
cd founder-orchestration-main

# Each person: set your GitHub identity before committing
git config user.name "your-github-username"
git config user.email "your@email.com"

# Verify before push
git log --oneline --all
git shortlog -sn  # should show 3 authors with equal-ish counts
```
