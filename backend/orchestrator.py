import asyncio
import json
import time
import uuid
from typing import TypedDict, Optional, Any
from langgraph.graph import StateGraph, END

from agents.advisor import run_advisor
from agents.market_research import run_market_research
from agents.product_manager import run_product_manager
from agents.architect import run_architect
from agents.engineering_manager import run_engineering_manager
from agents.marketing import run_marketing
from memory.pinecone_memory import retrieve_similar, store_session
from db import get_pool


class FounderState(TypedDict):
    session_id: str
    user_id: str
    startup_idea: str
    github_token: Optional[str]
    # Agent outputs
    advisor_output: Optional[dict]
    market_research_output: Optional[dict]
    product_manager_output: Optional[dict]
    architect_output: Optional[dict]
    engineering_manager_output: Optional[dict]
    marketing_output: Optional[dict]
    # Metadata
    errors: list
    completed_agents: list
    current_agent: Optional[str]
    uploaded_files: Optional[list]


def _safe_run(fn, *args, agent_name: str, state: dict) -> dict:
    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            return fn(*args)
        except Exception as e:
            if attempt == max_retries:
                state.setdefault("errors", []).append({
                    "agent": agent_name,
                    "error": str(e),
                    "attempt": attempt + 1,
                })
                return {"error": str(e)}
            time.sleep(2 ** attempt)


def node_advisor(state: FounderState, config=None) -> dict:
    state["current_agent"] = "startup_advisor"
    log = config.get("configurable", {}).get("log_callback") if config else None
    
    if log:
        log("Advisor: Analyzing startup idea and validating risks...")
        
    similar = retrieve_similar(state["startup_idea"], state["user_id"])
    
    if log:
        log("Advisor: Querying Pinecone for similar past startup concepts...")
        
    result = _safe_run(run_advisor, state["startup_idea"], similar,
                        agent_name="startup_advisor", state=state)
                        
    if log:
        if "error" in result:
            log(f"Advisor: Error occurred - {result['error']}")
        else:
            log(f"Advisor: Startup name generated - '{result.get('startup_name')}'")
            
    return {**state, "advisor_output": result,
            "completed_agents": state.get("completed_agents", []) + ["startup_advisor"]}


def node_market_research(state: FounderState, config=None) -> dict:
    state["current_agent"] = "market_research"
    log = config.get("configurable", {}).get("log_callback") if config else None
    
    if log:
        log("Market Research: Fetching live web search results via Tavily API...")
        
    result = _safe_run(run_market_research, state["advisor_output"],
                        agent_name="market_research", state=state)
                        
    if log:
        if "error" in result:
            log(f"Market Research: Error occurred - {result['error']}")
        else:
            log("Market Research: SWOT analysis compiled and competitors resolved.")
            
    return {**state, "market_research_output": result,
            "completed_agents": state.get("completed_agents", []) + ["market_research"]}


def node_product_manager(state: FounderState, config=None) -> dict:
    state["current_agent"] = "product_manager"
    log = config.get("configurable", {}).get("log_callback") if config else None
    
    if log:
        log("Product Manager: Drafting PRD user stories and roadmap milestones...")
        
    result = _safe_run(run_product_manager, state["advisor_output"], state["market_research_output"],
                        agent_name="product_manager", state=state)
                        
    if log:
        if "error" in result:
            log(f"Product Manager: Error occurred - {result['error']}")
        else:
            log(f"Product Manager: PRD document successfully published to Notion.")
            
    return {**state, "product_manager_output": result,
            "completed_agents": state.get("completed_agents", []) + ["product_manager"]}


def node_architect(state: FounderState, config=None) -> dict:
    state["current_agent"] = "architect"
    log = config.get("configurable", {}).get("log_callback") if config else None
    
    if log:
        log("Architect: Compiling system architecture, API endpoints, and database models...")
        
    result = _safe_run(run_architect, state["advisor_output"], state["product_manager_output"], state.get("github_token"),
                        agent_name="architect", state=state)
                        
    if log:
        if "error" in result:
            log(f"Architect: Error occurred - {result['error']}")
        else:
            log(f"Architect: GitHub repository created successfully.")
            
    return {**state, "architect_output": result,
            "completed_agents": state.get("completed_agents", []) + ["architect"]}


def node_engineering_manager(state: FounderState, config=None) -> dict:
    state["current_agent"] = "engineering_manager"
    log = config.get("configurable", {}).get("log_callback") if config else None
    
    if log:
        log("Engineering Manager: Formulating sprint plans and story point distributions...")
        
    result = _safe_run(run_engineering_manager, state["product_manager_output"], state["architect_output"], state.get("github_token"),
                        agent_name="engineering_manager", state=state)
                        
    if log:
        if "error" in result:
            log(f"Engineering Manager: Error occurred - {result['error']}")
        else:
            log(f"Engineering Manager: Created GitHub issues for sprint backlog tasks.")
            
    return {**state, "engineering_manager_output": result,
            "completed_agents": state.get("completed_agents", []) + ["engineering_manager"]}


def node_marketing(state: FounderState, config=None) -> dict:
    state["current_agent"] = "marketing"
    log = config.get("configurable", {}).get("log_callback") if config else None
    
    if log:
        log("Marketing: Creating landing page copywriting, email sequence, and LinkedIn launch post...")
        
    result = _safe_run(run_marketing, state["advisor_output"],
                        state["market_research_output"], state["product_manager_output"],
                        agent_name="marketing", state=state)
                        
    if log:
        if "error" in result:
            log(f"Marketing: Error occurred - {result['error']}")
        else:
            log("Marketing: Tagline, landing page headline, and pricing strategy generated.")
            
    return {**state, "marketing_output": result,
            "completed_agents": state.get("completed_agents", []) + ["marketing"],
            "current_agent": "complete"}


# Agents that must succeed for the pipeline to continue; others are non-fatal
_FATAL_AGENTS = {"startup_advisor"}


def route_next(state: FounderState) -> str:
    current = state.get("current_agent")
    output_keys = {
        "startup_advisor": "advisor_output",
        "market_research": "market_research_output",
        "product_manager": "product_manager_output",
        "architect": "architect_output",
        "engineering_manager": "engineering_manager_output",
        "marketing": "marketing_output",
    }

    out_key = output_keys.get(current)
    if out_key:
        out_val = state.get(out_key)
        if isinstance(out_val, dict) and "error" in out_val:
            if current in _FATAL_AGENTS:
                return END
            # Non-fatal: replace error dict with empty dict so downstream agents
            # don't crash on missing keys, then continue the pipeline
            state[out_key] = {}
            
    next_agent = {
        "startup_advisor": "market_research",
        "market_research": "product_manager",
        "product_manager": "architect",
        "architect": "engineering_manager",
        "engineering_manager": "marketing",
        "marketing": END,
    }.get(current, END)
    
    return next_agent


def build_graph():
    graph = StateGraph(FounderState)
    graph.add_node("startup_advisor", node_advisor)
    graph.add_node("market_research", node_market_research)
    graph.add_node("product_manager", node_product_manager)
    graph.add_node("architect", node_architect)
    graph.add_node("engineering_manager", node_engineering_manager)
    graph.add_node("marketing", node_marketing)

    graph.set_entry_point("startup_advisor")
    
    graph.add_conditional_edges(
        "startup_advisor",
        route_next,
        {"market_research": "market_research", END: END}
    )
    graph.add_conditional_edges(
        "market_research",
        route_next,
        {"product_manager": "product_manager", END: END}
    )
    graph.add_conditional_edges(
        "product_manager",
        route_next,
        {"architect": "architect", END: END}
    )
    graph.add_conditional_edges(
        "architect",
        route_next,
        {"engineering_manager": "engineering_manager", END: END}
    )
    graph.add_conditional_edges(
        "engineering_manager",
        route_next,
        {"marketing": "marketing", END: END}
    )
    graph.add_edge("marketing", END)

    return graph.compile()


async def run_orchestration_stream(session_id: str, user_id: str, startup_idea: str, uploaded_files: Optional[list] = None, github_token: Optional[str] = None):
    """Async generator that yields SSE events as each agent completes."""
    graph = build_graph()
    initial_state: FounderState = {
        "session_id": session_id,
        "user_id": user_id,
        "startup_idea": startup_idea,
        "github_token": github_token,
        "advisor_output": None,
        "market_research_output": None,
        "product_manager_output": None,
        "architect_output": None,
        "engineering_manager_output": None,
        "marketing_output": None,
        "errors": [],
        "completed_agents": [],
        "current_agent": None,
        "uploaded_files": uploaded_files or [],
    }

    agent_labels = {
        "startup_advisor": "Startup Advisor",
        "market_research": "Market Research",
        "product_manager": "Product Manager",
        "architect": "Architect",
        "engineering_manager": "Engineering Manager",
        "marketing": "Marketing",
    }

    loop = asyncio.get_event_loop()
    queue = asyncio.Queue()

    def log_callback(message: str):
        loop.call_soon_threadsafe(queue.put_nowait, {"event": "log", "message": message})

    config = {
        "configurable": {
            "log_callback": log_callback
        }
    }

    def run_graph():
        return graph.invoke(initial_state, config=config)

    # Run in thread pool to not block the event loop
    task = loop.run_in_executor(None, run_graph)

    # Poll both task and log queue
    while not task.done() or not queue.empty():
        try:
            item = await asyncio.wait_for(queue.get(), timeout=0.1)
            yield item
        except asyncio.TimeoutError:
            pass

    final_state = await task

    # Check for any errors
    errors = final_state.get("errors", [])
    has_critical_failure = len(errors) > 0

    # Emit completed agent outputs
    for agent_key in ["startup_advisor", "market_research", "product_manager",
                       "architect", "engineering_manager", "marketing"]:
        state_key_map = {
            "startup_advisor": "advisor_output",
            "market_research": "market_research_output",
            "product_manager": "product_manager_output",
            "architect": "architect_output",
            "engineering_manager": "engineering_manager_output",
            "marketing": "marketing_output",
        }
        data = final_state.get(state_key_map[agent_key])
        # Only emit complete status if the agent actually executed and didn't fail
        if data:
            # Architect: expose system_design, tech_stack, data_models for display.
            # Strip api_endpoints/scalability_notes and github_repo_url (moved to engineering_manager).
            if agent_key == "architect" and "error" not in data:
                display_data = {k: data[k] for k in ("system_design", "tech_stack", "data_models") if k in data}
            else:
                display_data = data
            yield {
                "event": "agent_complete",
                "agent": agent_key,
                "label": agent_labels[agent_key],
                "data": display_data,
            }

    # Store in Pinecone if Advisor succeeded
    if final_state.get("advisor_output") and "error" not in final_state["advisor_output"]:
        summary = f"Idea: {startup_idea}. Recommendation: {final_state['advisor_output'].get('recommendation', 'proceed')}"
        try:
            store_session(session_id, user_id, startup_idea, summary)
        except Exception:
            pass

    # Build and store structured memory if no critical failure occurred
    if not has_critical_failure:
        try:
            advisor_out = final_state.get("advisor_output") or {}
            pm_out = final_state.get("product_manager_output") or {}
            arch_out = final_state.get("architect_output") or {}

            startup_name = advisor_out.get("startup_name") or "Untitled Startup"
            roadmaps = pm_out.get("roadmap") or []

            documents = []
            notion_url = pm_out.get("notion_url")
            if notion_url:
                documents.append({"name": "PRD (Notion)", "url": notion_url, "type": "link"})

            github_repo_url = arch_out.get("github_repo_url")
            if github_repo_url:
                documents.append({"name": "Source Repository (GitHub)", "url": github_repo_url, "type": "link"})

            documents.append({"name": "Full Startup Pack (PDF)", "url": f"/api/sessions/{session_id}/pdf", "type": "download"})

            uploaded = final_state.get("uploaded_files") or []
            for f in uploaded:
                documents.append({
                    "name": f.get("name", "Uploaded Document"),
                    "category": f.get("category", "document"),
                    "type": "upload"
                })

            pool = await get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO memories (session_id, startup_name, idea, roadmaps, documents)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (session_id) DO UPDATE
                    SET startup_name = EXCLUDED.startup_name,
                        roadmaps = EXCLUDED.roadmaps,
                        documents = EXCLUDED.documents
                    """,
                    session_id,
                    startup_name,
                    startup_idea,
                    json.dumps(roadmaps),
                    json.dumps(documents)
                )
        except Exception as e:
            print(f"Failed to store memory: {e}")

    # Yield completion state
    yield {"event": "complete", "state": final_state}
