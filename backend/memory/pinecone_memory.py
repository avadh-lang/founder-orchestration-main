import os
import json
from pinecone import Pinecone, ServerlessSpec
from openai import OpenAI

_pc = None
_index = None
_oai = None

def _get_pinecone():
    global _pc, _index
    if _pc is None:
        _pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
        index_name = os.environ.get("PINECONE_INDEX_NAME", "founder-orchestration")
        existing = [i.name for i in _pc.list_indexes()]
        if index_name not in existing:
            _pc.create_index(
                name=index_name,
                dimension=1536,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
        _index = _pc.Index(index_name)
    return _index

def _embed(text: str) -> list[float]:
    global _oai
    if _oai is None:
        _oai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    resp = _oai.embeddings.create(model="text-embedding-3-small", input=text[:8000])
    return resp.data[0].embedding

def store_session(session_id: str, user_id: str, startup_idea: str, summary: str):
    index = _get_pinecone()
    embedding = _embed(startup_idea + " " + summary[:500])
    index.upsert(vectors=[{
        "id": session_id,
        "values": embedding,
        "metadata": {
            "user_id": user_id,
            "startup_idea": startup_idea[:500],
            "summary": summary[:1000],
            "session_id": session_id,
        }
    }])

def retrieve_similar(startup_idea: str, user_id: str, top_k: int = 3) -> list[dict]:
    try:
        index = _get_pinecone()
        embedding = _embed(startup_idea)
        results = index.query(
            vector=embedding,
            top_k=top_k,
            include_metadata=True,
            filter={"user_id": {"$eq": user_id}},
        )
        return [
            {"idea": m["metadata"].get("startup_idea", ""),
             "summary": m["metadata"].get("summary", ""),
             "score": m["score"]}
            for m in results.get("matches", [])
        ]
    except Exception:
        return []
