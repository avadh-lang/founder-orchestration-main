import json
import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from tools.github_tools import create_github_repo

SYSTEM_PROMPT = """You are a Principal Software Architect with expertise across all tech stacks.
Given the startup PRD and market context, design the technical architecture and return a JSON object with exactly these fields:
{
  "tech_stack": {
    "frontend": "framework and reason",
    "backend": "framework and reason",
    "database": "database and reason",
    "cache": "caching solution",
    "auth": "auth solution",
    "hosting": "hosting plan",
    "additional": ["tool 1", "tool 2"]
  },
  "system_design": "paragraph describing the overall architecture and data flow",
  "api_endpoints": [
    {"method": "GET|POST|PUT|DELETE", "path": "/api/...", "description": "..."}
  ],
  "data_models": [
    {"name": "ModelName", "fields": ["field1: type", "field2: type"]}
  ],
  "scalability_notes": "how this architecture scales to 100k users",
  "repo_name": "kebab-case-repo-name-max-30-chars"
}
Return ONLY the JSON."""

def run_architect(advisor_output: dict, prd: dict, github_token: str = None) -> dict:
    llm = ChatOpenAI(model="gpt-4o", temperature=0.2, api_key=os.environ["OPENAI_API_KEY"])

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""
Startup idea: {advisor_output.get('refined_idea', '')}
Core features: {json.dumps(prd.get('core_features', [])[:5])}
MVP scope: {json.dumps(prd.get('mvp_scope', []))}
Target audience: {advisor_output.get('target_audience', '')}
"""),
    ]
    response = llm.invoke(messages)
    content = response.content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    result = json.loads(content.strip())

    # Create GitHub repo
    if github_token:
        try:
            startup_name = advisor_output.get("startup_name", "ai-startup-project")
            repo_name = startup_name.lower().replace(" ", "-")
            description = advisor_output.get("refined_idea", "")[:150]
            repo_result = create_github_repo(repo_name, description, github_token)
            result["github_repo_url"] = repo_result["url"]
            result["github_repo_name"] = repo_result["name"]
        except Exception as e:
            result["github_repo_url"] = None
            result["github_repo_name"] = None
            result["github_error"] = str(e)
    else:
        result["github_repo_url"] = None
        result["github_repo_name"] = None
        result["github_error"] = "No GitHub token available for this user"

    return result
