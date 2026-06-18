import json
import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from tools.tavily_search import search_web, search_competitors

SYSTEM_PROMPT = """You are an expert market research analyst. You have been given web search results and a startup idea.
Synthesize this into a comprehensive market research report as a JSON object with exactly these fields:
{
  "market_size": "estimated TAM/SAM/SOM with sources",
  "market_growth_rate": "CAGR or trend",
  "competitors": [
    {"name": "...", "description": "...", "strengths": "...", "weaknesses": "..."}
  ],
  "gaps": ["gap or opportunity 1", "gap 2", "gap 3"],
  "trends": ["trend 1", "trend 2", "trend 3"],
  "swot": {
    "strengths": ["..."],
    "weaknesses": ["..."],
    "opportunities": ["..."],
    "threats": ["..."]
  },
  "target_segments": ["segment 1", "segment 2"],
  "recommended_positioning": "1 sentence on how to position the product"
}
Return ONLY the JSON."""

def run_market_research(advisor_output: dict) -> dict:
    llm = ChatOpenAI(model="gpt-4o", temperature=0.2, api_key=os.environ["OPENAI_API_KEY"])
    idea = advisor_output.get("refined_idea", "")[:200]
    audience = advisor_output.get("target_audience", "")

    search_results = search_web(f"{idea} market size growth 2024 2025")
    competitor_results = search_competitors(idea)
    trends_results = search_web(f"{idea} industry trends emerging technology")

    search_text = "\n\n".join([
        f"SOURCE: {r['title']}\nURL: {r['url']}\nCONTENT: {r['content']}"
        for r in (search_results + competitor_results + trends_results)[:12]
    ])

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""
Startup idea: {idea}
Target audience: {audience}

Web search results:
{search_text[:6000]}
"""),
    ]
    response = llm.invoke(messages)
    content = response.content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    return json.loads(content.strip())
