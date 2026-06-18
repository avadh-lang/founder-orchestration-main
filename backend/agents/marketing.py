import json
import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from tools.tavily_search import search_web

SYSTEM_PROMPT = """You are a world-class growth marketer and copywriter.
Given full context about a startup (idea, market research, product, architecture), create a comprehensive GTM strategy.
Return a JSON object with exactly these fields:
{
  "tagline": "punchy 6-10 word tagline",
  "linkedin_post": "a catchy, viral-style LinkedIn launch post template (with hook, bullet points, call to action, and relevant hashtags) ready for the founder to copy and post",
  "landing_page_copy": {
    "hero_headline": "...",
    "hero_subheadline": "...",
    "cta_text": "...",
    "features": [{"title": "...", "description": "..."}],
    "social_proof": "example testimonial or stat",
    "faq": [{"question": "...", "answer": "..."}]
  },
  "gtm_strategy": "3-paragraph go-to-market narrative",
  "launch_channels": [
    {"channel": "Product Hunt", "tactic": "...", "expected_reach": "..."},
    {"channel": "...", "tactic": "...", "expected_reach": "..."}
  ],
  "email_sequence": [
    {"email": 1, "subject": "...", "body": "complete ready-to-send email body, minimum 200 words, with greeting, 3-4 paragraphs of value-driven content, and a clear CTA at the end", "send_time": "Day 0", "goal": "Welcome & Activate"},
    {"email": 2, "subject": "...", "body": "complete ready-to-send email body, minimum 200 words", "send_time": "Day 3", "goal": "Educate & Demonstrate Value"},
    {"email": 3, "subject": "...", "body": "complete ready-to-send email body, minimum 200 words", "send_time": "Day 7", "goal": "Social Proof & Case Study"},
    {"email": 4, "subject": "...", "body": "complete ready-to-send email body, minimum 200 words", "send_time": "Day 14", "goal": "Overcome Objections & Urgency"},
    {"email": 5, "subject": "...", "body": "complete ready-to-send email body, minimum 200 words", "send_time": "Day 30", "goal": "Re-engage & Upsell"}
  ],
  "pricing_recommendation": {
    "model": "freemium|subscription|usage-based|one-time",
    "tiers": [{"name": "...", "price": "...", "features": ["..."]}]
  },
  "90_day_plan": ["Week 1-2: ...", "Week 3-4: ...", "Month 2: ...", "Month 3: ..."]
}
Return ONLY the JSON."""

def run_marketing(advisor_output: dict, market_research: dict, prd: dict) -> dict:
    llm = ChatOpenAI(model="gpt-4o", temperature=0.4, api_key=os.environ["OPENAI_API_KEY"])

    idea = advisor_output.get("refined_idea", "")
    search_results = search_web(f"{idea} marketing strategy launch growth hacking")
    search_text = "\n".join([r["content"][:300] for r in search_results[:4]])

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""
Startup idea: {idea}
Target audience: {advisor_output.get('target_audience', '')}
Value proposition: {advisor_output.get('value_proposition', '')}
Market positioning: {market_research.get('recommended_positioning', '')}
Competitors: {json.dumps(market_research.get('competitors', [])[:3])}
Core features (MVP): {json.dumps(prd.get('mvp_scope', []))}
Market trends: {json.dumps(market_research.get('trends', []))}
Market research snippets: {search_text[:1000]}
"""),
    ]
    response = llm.invoke(messages)
    content = response.content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    return json.loads(content.strip())
