import json
import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from tools.notion_tools import create_notion_page

SYSTEM_PROMPT = """You are a senior Product Manager who writes clear, actionable PRDs.
Given the startup idea and market research, produce a JSON object with exactly these fields:
{
  "overview": "2-3 sentence overview of the product",
  "problem": "2-3 sentence problem statement",
  "goals": ["goal 1", "goal 2", "goal 3"],
  "core_features": [
    {"name": "...", "description": "full sentence description", "priority": "must-have|should-have|nice-to-have"}
  ],
  "user_stories": [
    {"persona": "...", "action": "...", "benefit": "..."}
  ],
  "mvp_scope": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "out_of_scope": ["feature to cut 1", "feature to cut 2"],
  "success_metrics": ["metric 1", "metric 2", "metric 3"],
  "roadmap": [
    {"phase": "e.g. Phase 1: MVP Core", "duration": "e.g. Weeks 1-4", "deliverables": ["deliverable 1", "deliverable 2"]}
  ]
}
Be thorough and complete — every field must be fully written out. Return ONLY the JSON."""

def run_product_manager(advisor_output: dict, market_research: dict) -> dict:
    llm = ChatOpenAI(model="gpt-4o", temperature=0.3, api_key=os.environ["OPENAI_API_KEY"])

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""
Startup idea: {advisor_output.get('refined_idea', '')}
Target audience: {advisor_output.get('target_audience', '')}
Value proposition: {advisor_output.get('value_proposition', '')}

Market gaps: {json.dumps(market_research.get('gaps', []))}
Competitors: {json.dumps(market_research.get('competitors', [])[:3])}
Trends: {json.dumps(market_research.get('trends', []))}
"""),
    ]
    response = llm.invoke(messages)
    content = response.content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    result = json.loads(content.strip())

    # Build complete PRD markdown from structured fields
    startup_name = advisor_output.get("startup_name", "Startup")
    prd_lines = [
        f"# PRD: {startup_name}",
        "",
        "## Overview",
        result.get("overview", ""),
        "",
        "## Problem",
        result.get("problem", ""),
        "",
        "## Goals",
    ]
    for goal in result.get("goals", []):
        prd_lines.append(f"- {goal}")
    prd_lines += ["", "## Features"]
    for feat in result.get("core_features", []):
        prd_lines.append(f"- {feat['name']} ({feat.get('priority','must-have')}): {feat.get('description','')}")
    prd_lines += ["", "## User Stories"]
    for us in result.get("user_stories", []):
        prd_lines.append(f"- As a {us.get('persona','User')}, I want to {us.get('action','')} so that {us.get('benefit','')}")
    prd_lines += ["", "## Success Metrics"]
    for m in result.get("success_metrics", []):
        prd_lines.append(f"- {m}")
    prd_lines += ["", "## Roadmap"]
    for phase in result.get("roadmap", []):
        prd_lines.append(f"- {phase.get('phase','')} ({phase.get('duration','')})")
        for d in phase.get("deliverables", []):
            prd_lines.append(f"  - {d}")

    prd_md = "\n".join(prd_lines)
    result["prd_markdown"] = prd_md

    # Write PRD to Notion
    try:
        notion_result = create_notion_page(
            title=f"PRD: {startup_name}",
            content=prd_md,
        )
        result["notion_url"] = notion_result["url"]
    except Exception as e:
        result["notion_url"] = None
        result["notion_error"] = str(e)

    return result
