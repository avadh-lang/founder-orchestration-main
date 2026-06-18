import os
from github import Github
from notion_client import Client


def verify_github(github_token: str = None) -> dict:
    token = github_token or os.environ.get("GITHUB_TOKEN")
    if not token:
        return {"valid": False, "error": "GitHub account not connected. Please connect GitHub via your account settings."}
    try:
        g = Github(token)
        user = g.get_user()
        login = user.login
        return {"valid": True, "username": login, "error": None}
    except Exception as e:
        return {"valid": False, "error": str(e)}


def verify_notion() -> dict:
    api_key = os.environ.get("NOTION_API_KEY")
    database_id = os.environ.get("NOTION_DATABASE_ID")
    if not api_key:
        return {"valid": False, "error": "NOTION_API_KEY environment variable is missing"}
    if not database_id:
        return {"valid": False, "error": "NOTION_DATABASE_ID environment variable is missing"}
    try:
        notion = Client(auth=api_key)
        notion.databases.retrieve(database_id=database_id)
        return {"valid": True, "error": None}
    except Exception as e:
        return {"valid": False, "error": str(e)}
