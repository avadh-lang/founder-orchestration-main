import os
import re
from notion_client import Client

def get_client() -> Client:
    return Client(auth=os.environ["NOTION_API_KEY"])

def strip_markdown(text: str) -> str:
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'_(.*?)_', r'\1', text)
    return text

def create_notion_page(title: str, content: str) -> dict:
    notion = get_client()
    database_id = os.environ["NOTION_DATABASE_ID"]

    blocks = []
    pending_paragraph_lines = []

    def flush_paragraph():
        if pending_paragraph_lines:
            text = strip_markdown(" ".join(pending_paragraph_lines).strip())
            for i in range(0, len(text), 2000):
                blocks.append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": text[i:i+2000]}}]},
                })
            pending_paragraph_lines.clear()

    for line in content.split("\n"):
        if line.startswith("# "):
            flush_paragraph()
            blocks.append({
                "object": "block",
                "type": "heading_1",
                "heading_1": {"rich_text": [{"type": "text", "text": {"content": strip_markdown(line[2:].strip()[:200])}}]},
            })
        elif line.startswith("## "):
            flush_paragraph()
            blocks.append({
                "object": "block",
                "type": "heading_2",
                "heading_2": {"rich_text": [{"type": "text", "text": {"content": strip_markdown(line[3:].strip()[:200])}}]},
            })
        elif line.startswith("### "):
            flush_paragraph()
            blocks.append({
                "object": "block",
                "type": "heading_3",
                "heading_3": {"rich_text": [{"type": "text", "text": {"content": strip_markdown(line[4:].strip()[:200])}}]},
            })
        elif line.startswith("- ") or line.startswith("* "):
            flush_paragraph()
            text = strip_markdown(line[2:].strip())
            blocks.append({
                "object": "block",
                "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": text[:2000]}}]},
            })
        elif line.startswith("  - ") or line.startswith("  * "):
            flush_paragraph()
            text = strip_markdown(line[4:].strip())
            blocks.append({
                "object": "block",
                "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": text[:2000]}}]},
            })
        elif line.strip() == "":
            flush_paragraph()
        else:
            pending_paragraph_lines.append(line.strip())

    flush_paragraph()

    # Notion API allows max 100 blocks per request — append remaining in batches
    page = notion.pages.create(
        parent={"database_id": database_id},
        properties={"title": {"title": [{"type": "text", "text": {"content": title}}]}},
        children=blocks[:100],
    )
    page_id = page["id"]

    # Append remaining blocks if any
    for i in range(100, len(blocks), 100):
        notion.blocks.children.append(block_id=page_id, children=blocks[i:i+100])

    return {"url": page["url"], "page_id": page_id}
