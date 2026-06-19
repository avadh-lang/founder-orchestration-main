import os
from tavily import TavilyClient

_client = None

def get_client() -> TavilyClient:
    global _client
    if _client is None:
        _client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
    return _client

def search_web(query: str, max_results: int = 5) -> list[dict]:
    client = get_client()
    response = client.search(query=query[:380], max_results=max_results, search_depth="advanced")
    return [
        {"title": r.get("title"), "url": r.get("url"), "content": r.get("content")}
        for r in response.get("results", [])
    ]

def search_competitors(idea: str) -> list[dict]:
    queries = [
        f"{idea} startup competitors 2024",
        f"{idea} market leaders companies",
        f"alternatives to {idea} SaaS",
    ]
    seen_urls = set()
    results = []
    client = get_client()
    for q in queries:
        resp = client.search(query=q[:380], max_results=3, search_depth="advanced")
        for r in resp.get("results", []):
            if r.get("url") not in seen_urls:
                seen_urls.add(r["url"])
                results.append({"title": r.get("title"), "url": r.get("url"), "content": r.get("content")})
    return results[:10]
