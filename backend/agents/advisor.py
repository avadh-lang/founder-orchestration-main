import json
import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

SYSTEM_PROMPT = """You are a seasoned startup advisor with 20+ years of experience mentoring founders.
Analyze the startup idea provided and return a JSON object with exactly these fields:
{
  "startup_name": "a creative, punchy, and catchy name for the startup (2-4 words)",
  "refined_idea": "clearer one-paragraph description of the idea",
  "problem_statement": "the core problem being solved",
  "target_audience": "specific primary user persona",
  "value_proposition": "why users will choose this over alternatives",
  "risks": ["risk 1", "risk 2", "risk 3"],
  "recommendation": "proceed | pivot | reject",
  "reasoning": "2-3 sentences explaining the recommendation"
}
Return ONLY the JSON, no markdown, no explanation."""

def run_advisor(startup_idea: str, similar_past: list[dict] = None) -> dict:
    llm = ChatOpenAI(model="gpt-4o", temperature=0.3, api_key=os.environ["OPENAI_API_KEY"])
    context = ""
    if similar_past:
        context = "\n\nSimilar past startup ideas for reference:\n"
        for s in similar_past[:2]:
            context += f"- {s['idea']}: {s['summary']}\n"

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"Startup idea: {startup_idea}{context}"),
    ]
    response = llm.invoke(messages)
    content = response.content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    return json.loads(content.strip())
