import json
import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from tools.github_tools import create_github_issues

SYSTEM_PROMPT = """You are an experienced Engineering Manager who creates clear, actionable sprint plans.
Given the features and architecture, create a sprint plan and return a JSON object with exactly these fields:
{
  "sprints": [
    {
      "sprint": 1,
      "goal": "one line sprint goal",
      "duration_weeks": 2,
      "tasks": [
        {"title": "task title", "description": "detailed description", "label": "frontend|backend|infra|design", "story_points": 3}
      ]
    }
  ],
  "total_weeks": 8,
  "team_size_recommended": 3,
  "definition_of_done": ["criterion 1", "criterion 2", "criterion 3"],
  "tech_debt_risks": ["risk 1", "risk 2"]
}
Create 3-4 sprints with 5-8 tasks each. Return ONLY the JSON."""

def run_engineering_manager(prd: dict, architecture: dict, github_token: str = None) -> dict:
    llm = ChatOpenAI(model="gpt-4o", temperature=0.3, api_key=os.environ["OPENAI_API_KEY"])

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""
MVP features: {json.dumps(prd.get('mvp_scope', []))}
Core features: {json.dumps(prd.get('core_features', [])[:6])}
Tech stack: {json.dumps(architecture.get('tech_stack', {}))}
API endpoints: {json.dumps(architecture.get('api_endpoints', [])[:8])}
Data models: {json.dumps(architecture.get('data_models', []))}
"""),
    ]
    response = llm.invoke(messages)
    content = response.content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    result = json.loads(content.strip())

    # Always expose the GitHub repo URL (moved here from architect section)
    result["github_repo_url"] = architecture.get("github_repo_url")

    # Create GitHub issues if repo exists (action only — not exposed in output)
    repo_name = architecture.get("github_repo_name")
    if repo_name and github_token:
        try:
            issues = []
            for sprint in result.get("sprints", []):
                for task in sprint.get("tasks", []):
                    issues.append({
                        "title": f"[Sprint {sprint['sprint']}] {task['title']}",
                        "body": f"Sprint {sprint['sprint']} — {sprint.get('goal', '')}\n\n{task.get('description', '')}\n\nStory Points: {task.get('story_points', 0)}",
                        "label": task.get("label", "task"),
                    })
            create_github_issues(repo_name, issues, github_token)
        except Exception as e:
            result["github_issues_error"] = str(e)

    return result
