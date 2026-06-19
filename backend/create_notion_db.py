"""
Run this once to create a new Notion database that's auto-connected to your integration.
Usage: python create_notion_db.py
"""
import os
import re
from dotenv import load_dotenv
from notion_client import Client

load_dotenv()

api_key = os.environ["NOTION_API_KEY"]
notion = Client(auth=api_key)

# Find a parent page we can write to — search for any page the integration can access
print("Searching for accessible pages...")
results = notion.search(filter={"property": "object", "value": "page"})

pages = results.get("results", [])
if not pages:
    # No pages found — create a top-level page first isn't possible via API without a parent.
    # Instead, search for any accessible object
    results = notion.search()
    pages = [r for r in results.get("results", []) if r["object"] == "page"]

if not pages:
    print("\nNo accessible pages found.")
    print("Please go to Notion, create a new page (outside Private), share it with")
    print("the 'poorva jawale founder' integration, then re-run this script.")
    exit(1)

parent_page = pages[0]
parent_id = parent_page["id"]
parent_title = ""
try:
    parent_title = parent_page["properties"]["title"]["title"][0]["plain_text"]
except Exception:
    parent_title = parent_id

print(f"Using parent page: '{parent_title}' ({parent_id})")

# Create the database
print("Creating 'FounderAI Runs' database...")
db = notion.databases.create(
    parent={"type": "page_id", "page_id": parent_id},
    title=[{"type": "text", "text": {"content": "FounderAI Runs"}}],
    properties={
        "title": {"title": {}},
    }
)

new_db_id = db["id"]
new_db_url = db["url"]
print(f"\nDatabase created successfully!")
print(f"  ID:  {new_db_id}")
print(f"  URL: {new_db_url}")

# Update .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
with open(env_path, "r") as f:
    content = f.read()

# Replace the old NOTION_DATABASE_ID
new_id_no_hyphens = new_db_id.replace("-", "")
content = re.sub(
    r"NOTION_DATABASE_ID=.*",
    f"NOTION_DATABASE_ID={new_id_no_hyphens}",
    content
)

with open(env_path, "w") as f:
    f.write(content)

print(f"\n.env updated with new NOTION_DATABASE_ID={new_id_no_hyphens}")
print("Restart your backend server to apply the change.")
