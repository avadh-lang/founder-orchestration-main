"""
sessions.py — Session management endpoints
Owner: PoorvaJawale

Handles session creation (with optional PDF uploads), session retrieval,
history listing, and the SSE streaming endpoint that connects the frontend
to the live agent orchestration pipeline.
"""
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse

from db import get_pool
from orchestrator import run_orchestration_stream
from routes.auth import get_user_id, get_github_token_for_user
from tools.file_tool import process_uploaded_document

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("")
async def create_session(
    startup_idea: str = Form(...),
    business_plan: Optional[UploadFile] = File(None),
    competitor_report: Optional[UploadFile] = File(None),
    prd_file: Optional[UploadFile] = File(None),
    authorization: Optional[str] = Header(None),
):
    """
    Create a new orchestration session.
    Accepts optional PDF documents that are extracted and prepended to the idea
    as additional context for the agent pipeline.
    """
    user_id = get_user_id(authorization)
    idea = startup_idea.strip()
    uploaded_files_meta = []

    # Process optional supporting PDF files
    files_to_process = [
        (business_plan,    "business_plan",    "Business Plan"),
        (competitor_report,"competitor_report", "Competitor Report"),
        (prd_file,         "prd",              "PRD"),
    ]
    for file_obj, category, label in files_to_process:
        if file_obj and file_obj.filename:
            file_bytes = await file_obj.read()
            processed  = process_uploaded_document(file_obj.filename, file_bytes, category)
            if processed:
                uploaded_files_meta.append({"name": file_obj.filename, "category": category})
                idea = f"{idea}\n\nContext from uploaded {label} ({file_obj.filename}):\n{processed['content'][:2500]}"

    session_id = str(uuid.uuid4())
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO sessions (id, user_id, startup_idea, status, uploaded_files) VALUES ($1, $2, $3, 'running', $4)",
            session_id, user_id, idea[:3000], json.dumps(uploaded_files_meta),
        )

    return {"session_id": session_id}


@router.get("/{session_id}/stream")
async def stream_session(
    session_id: str,
    authorization: Optional[str] = Header(None),
    token: Optional[str] = None,
):
    """
    SSE endpoint — streams live agent events to the frontend as each
    agent completes. Persists outputs to the database in real time.
    """
    auth_header  = authorization or (f"Bearer {token}" if token else None)
    user_id      = get_user_id(auth_header)

    pool = await get_pool()
    async with pool.acquire() as conn:
        session = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Guard against duplicate SSE connections re-running the pipeline
    if session["status"] in ("complete", "error"):
        async def replay_complete():
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"
        return StreamingResponse(
            replay_complete(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    startup_idea   = session["startup_idea"]
    uploaded_files = json.loads(session["uploaded_files"] or "[]")
    github_token   = await get_github_token_for_user(user_id)

    async def event_generator():
        try:
            async for event in run_orchestration_stream(
                session_id, user_id, startup_idea, uploaded_files, github_token
            ):
                if event.get("event") == "log":
                    yield f"data: {json.dumps({'type': 'log', 'message': event['message']})}\n\n"

                elif event.get("event") == "agent_complete":
                    agent = event["agent"]
                    data  = event["data"]
                    pool  = await get_pool()
                    async with pool.acquire() as conn:
                        await conn.execute(
                            "INSERT INTO agent_outputs (session_id, agent_name, output_json) VALUES ($1, $2, $3)",
                            session_id, agent, json.dumps(data),
                        )
                    yield f"data: {json.dumps({'type': 'agent_complete', 'agent': agent, 'label': event['label'], 'data': data})}\n\n"

                elif event.get("event") == "complete":
                    final_state = event.get("state") or {}
                    errors      = final_state.get("errors", [])
                    status      = "error" if errors else "complete"
                    pool = await get_pool()
                    async with pool.acquire() as conn:
                        await conn.execute(
                            "UPDATE sessions SET status = $1 WHERE id = $2", status, session_id
                        )
                    if status == "error":
                        err_msg = errors[0].get("error", "Critical agent failure") if errors else "Unknown"
                        yield f"data: {json.dumps({'type': 'error', 'message': f'Orchestration stopped: {err_msg}'})}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            pool = await get_pool()
            async with pool.acquire() as conn:
                await conn.execute("UPDATE sessions SET status = 'error' WHERE id = $1", session_id)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{session_id}")
async def get_session(session_id: str, authorization: Optional[str] = Header(None)):
    """Retrieve a single session with all agent outputs."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        session = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        outputs = await conn.fetch(
            "SELECT agent_name, output_json FROM agent_outputs WHERE session_id = $1", session_id
        )
    outputs_by_agent = {o["agent_name"]: json.loads(o["output_json"]) for o in outputs}
    return {
        "id":            session["id"],
        "startup_idea":  session["startup_idea"],
        "status":        session["status"],
        "created_at":    session["created_at"].isoformat(),
        "outputs":       outputs_by_agent,
    }


@router.get("")
async def list_sessions(authorization: Optional[str] = Header(None)):
    """Return the 20 most recent sessions for the authenticated user."""
    user_id = get_user_id(authorization)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, startup_idea, status, created_at FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
            user_id,
        )
    return [
        {"id": r["id"], "startup_idea": r["startup_idea"],
         "status": r["status"], "created_at": r["created_at"].isoformat()}
        for r in rows
    ]


@router.delete("/{session_id}")
async def delete_session(session_id: str, authorization: Optional[str] = Header(None)):
    """Delete a single session. CASCADE on agent_outputs/memories handles child rows."""
    user_id = get_user_id(authorization)
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM sessions WHERE id = $1 AND user_id = $2",
            session_id, user_id,
        )
    # result is e.g. "DELETE 1" or "DELETE 0"
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Session not found")
    return {"deleted": session_id}


@router.delete("")
async def delete_all_sessions(authorization: Optional[str] = Header(None)):
    """Delete every session for the authenticated user. CASCADE removes child rows."""
    user_id = get_user_id(authorization)
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Count first so we can report how many were removed
        count = await conn.fetchval(
            "SELECT COUNT(*) FROM sessions WHERE user_id = $1", user_id
        )
        await conn.execute("DELETE FROM sessions WHERE user_id = $1", user_id)
    return {"deleted_count": count}
