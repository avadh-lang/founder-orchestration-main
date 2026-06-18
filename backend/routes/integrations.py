"""
integrations.py — Integration verification endpoints
Owner: PoorvaJawale

Verifies that GitHub and Notion credentials are valid before
the user can launch an orchestration run.
"""
from typing import Optional

from fastapi import APIRouter, Header

from routes.auth import get_user_id, get_github_token_for_user
from tools.integrations import verify_github, verify_notion

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/verify")
async def verify_integrations(authorization: Optional[str] = Header(None)):
    """
    Check whether GitHub OAuth and Notion API credentials are active.
    Returns status + connected username for each integration.
    """
    user_id = get_user_id(authorization)
    github_token = await get_github_token_for_user(user_id)
    gh_status     = verify_github(github_token)
    notion_status = verify_notion()
    return {
        "github": gh_status,
        "notion": notion_status,
    }
