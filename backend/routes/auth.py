"""
auth.py — Shared authentication utilities
Extracts user identity from Clerk JWT tokens and fetches GitHub OAuth tokens.
"""
import json
import os
from typing import Optional

import httpx


async def get_github_token_for_user(clerk_user_id: str) -> Optional[str]:
    """Fetch the user's GitHub OAuth token via the Clerk API."""
    clerk_secret = os.environ.get("CLERK_SECRET_KEY")
    if not clerk_secret or clerk_user_id == "demo-user":
        return None
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"https://api.clerk.com/v1/users/{clerk_user_id}/oauth_access_tokens/oauth_github",
                headers={"Authorization": f"Bearer {clerk_secret}"},
                timeout=10,
            )
            if res.status_code == 200:
                data = res.json()
                if data and isinstance(data, list) and len(data) > 0:
                    return data[0].get("token")
    except Exception:
        pass
    return None


def get_user_id(authorization: Optional[str]) -> str:
    """Decode Clerk JWT and return the user's subject (sub) claim."""
    if not authorization:
        return "demo-user"
    try:
        import base64
        token = authorization.split(" ")[1]
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.b64decode(payload_b64))
        return payload.get("sub", "demo-user")
    except Exception:
        return "demo-user"
