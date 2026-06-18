"""
memory.py — Pinecone vector memory retrieval endpoint
Owner: Omkar25-source

Exposes an API for the frontend to surface semantic memory entries
associated with a session — prior context retrieved by the memory agent
during orchestration and stored in Pinecone + PostgreSQL.
"""
import json
from typing import Optional, List

from fastapi import APIRouter, Header, HTTPException, Query

from db import get_pool
from routes.auth import get_user_id

router = APIRouter(prefix="/api/sessions", tags=["memory"])


@router.get("/{session_id}/memory")
async def get_session_memory(
    session_id: str,
    authorization: Optional[str] = Header(None),
    limit: int = Query(default=10, ge=1, le=50),
    threshold: float = Query(default=0.70, ge=0.0, le=1.0),
):
    """
    Return structured founder memory stored in the memories table.

    Falls back to assembling memory from agent_outputs when no explicit
    memories row exists (e.g. Pinecone write failed but agents completed).
    """
    get_user_id(authorization)  # auth check

    pool = await get_pool()
    async with pool.acquire() as conn:
        session = await conn.fetchrow(
            "SELECT id FROM sessions WHERE id = $1", session_id
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Primary: structured memories table written by orchestrator
        mem = await conn.fetchrow(
            "SELECT * FROM memories WHERE session_id = $1", session_id
        )
        if mem:
            return {
                "session_id":  session_id,
                "startupName": mem["startup_name"],
                "idea":        mem["idea"],
                "roadmaps":    json.loads(mem["roadmaps"])   if isinstance(mem["roadmaps"],   str) else (mem["roadmaps"]   or []),
                "documents":   json.loads(mem["documents"])  if isinstance(mem["documents"],   str) else (mem["documents"]  or []),
                "created_at":  mem["created_at"].isoformat() if mem["created_at"] else None,
            }

        # Fallback: assemble from agent_outputs
        outputs = await conn.fetch(
            "SELECT agent_name, output_json FROM agent_outputs WHERE session_id = $1",
            session_id,
        )
        if not outputs:
            raise HTTPException(status_code=404, detail="No memory found for this session")

        out = {o["agent_name"]: json.loads(o["output_json"]) for o in outputs}
        advisor = out.get("startup_advisor", {})
        pm      = out.get("product_manager", {})
        arch    = out.get("architect", {})

        # Build roadmap list from PM roadmap field
        roadmaps = [
            {"phase": p.get("phase", ""), "duration": p.get("duration", ""), "deliverables": p.get("deliverables", [])}
            for p in (pm.get("roadmap") or [])
        ]

        # Build linked documents from known URLs
        documents = []
        if pm.get("notion_url"):
            documents.append({"title": "Notion PRD", "url": pm["notion_url"], "type": "notion"})
        if arch.get("github_repo_url"):
            documents.append({"title": "GitHub Repo", "url": arch["github_repo_url"], "type": "github"})

        return {
            "session_id":  session_id,
            "startupName": advisor.get("startup_name", "Startup"),
            "idea":        advisor.get("refined_idea", ""),
            "roadmaps":    roadmaps,
            "documents":   documents,
        }


@router.get("/{session_id}/memory/search")
async def search_session_memory(
    session_id: str,
    q: str = Query(..., min_length=3, description="Natural language query to search memory"),
    authorization: Optional[str] = Header(None),
    limit: int = Query(default=5, ge=1, le=20),
):
    """
    Run a semantic search over this session's Pinecone memory namespace.

    Uses the same embedding model the orchestrator uses, so results match
    what the agents would have retrieved for a given query.
    """
    user_id = get_user_id(authorization)

    pool = await get_pool()
    async with pool.acquire() as conn:
        session = await conn.fetchrow("SELECT id FROM sessions WHERE id = $1", session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

    try:
        from memory.pinecone_store import query_memory
        results: List[dict] = await query_memory(
            namespace=session_id,
            query=q,
            top_k=limit,
        )
    except ImportError:
        raise HTTPException(status_code=500, detail="Pinecone memory module not installed")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Memory query failed: {e}")

    return {
        "session_id": session_id,
        "query":      q,
        "count":      len(results),
        "results":    results,
    }
