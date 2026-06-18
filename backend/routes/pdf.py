"""
pdf.py — PDF report generation endpoint
"""
import io
import json
import re
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from db import get_pool

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
        PageBreak, KeepTogether, Table, TableStyle,
    )
    _REPORTLAB_OK = True
except ImportError:
    _REPORTLAB_OK = False

router = APIRouter(prefix="/api/sessions", tags=["pdf"])

# Keys to never render in the PDF
_SKIP_KEYS = {
    "github_repo_name", "github_repo_url", "github_error", "github_issues_error",
    "repo_name", "error", "prd_markdown", "notion_url", "github_issues",
    "github_issues_created",
}

# Max characters for long text fields before truncation
_MAX_BODY = 600


def _clean(text: str) -> str:
    """Strip markdown and escape ReportLab XML special chars."""
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'__(.+?)__', r'\1', text)
    text = re.sub(r'#{1,6}\s*', '', text)
    text = re.sub(r'`{1,3}', '', text)
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return text.strip()


def _trunc(text: str, limit: int = _MAX_BODY) -> str:
    text = _clean(text)
    if len(text) > limit:
        return text[:limit].rstrip() + "…"
    return text


def _render(value, story, styles, indent=0):
    """Recursively render any JSON value into ReportLab flowables."""
    body  = styles["body"]
    h2    = styles["h2"]
    bullet = styles["bullet"]
    hr_color = styles["hr_color"]

    if value is None or value == "" or value == [] or value == {}:
        return

    if isinstance(value, str):
        if value.strip():
            story.append(Paragraph(_trunc(value), body))
            story.append(Spacer(1, 0.05 * inch))

    elif isinstance(value, list):
        for i, item in enumerate(value):
            if isinstance(item, dict):
                # Visual card separator between dict items
                if i > 0:
                    story.append(Spacer(1, 0.1 * inch))
                    story.append(HRFlowable(
                        width="100%", thickness=0.4,
                        color=hr_color, spaceAfter=6
                    ))
                _render_dict_card(item, story, styles, indent)
            else:
                text = _clean(str(item)) if not isinstance(item, (dict, list)) else ""
                if text:
                    story.append(Paragraph(f"•  {text}", bullet))

    elif isinstance(value, dict):
        _render_dict_card(value, story, styles, indent)

    else:
        text = _clean(str(value))
        if text:
            story.append(Paragraph(text, body))
            story.append(Spacer(1, 0.04 * inch))


def _render_dict_card(d: dict, story, styles, indent=0):
    """Render a dict as structured key-value rows."""
    body   = styles["body"]
    h2     = styles["h2"]
    bullet = styles["bullet"]
    kv     = styles["kv"]

    for k, v in d.items():
        if k in _SKIP_KEYS or k.startswith("_"):
            continue
        if v is None or v == "" or v == [] or v == {}:
            continue

        label = k.replace("_", " ").title()

        if isinstance(v, list):
            story.append(Paragraph(f"<b>{label}</b>", kv))
            for item in v:
                if isinstance(item, dict):
                    # Inline dict — render as indented key:value
                    parts = []
                    for ik, iv in item.items():
                        if ik in _SKIP_KEYS:
                            continue
                        if isinstance(iv, (dict, list)):
                            continue
                        parts.append(f"<b>{ik.replace('_',' ').title()}:</b> {_clean(str(iv))}")
                    if parts:
                        story.append(Paragraph("    " + "  |  ".join(parts), bullet))
                else:
                    text = _clean(str(item))
                    if text:
                        story.append(Paragraph(f"•  {text}", bullet))
        elif isinstance(v, dict):
            story.append(Paragraph(f"<b>{label}</b>", kv))
            for ik, iv in v.items():
                if ik in _SKIP_KEYS:
                    continue
                ilabel = ik.replace("_", " ").title()
                if isinstance(iv, list):
                    story.append(Paragraph(f"    <b>{ilabel}:</b>", bullet))
                    for sub in iv:
                        story.append(Paragraph(f"        •  {_clean(str(sub))}", bullet))
                elif not isinstance(iv, dict):
                    story.append(Paragraph(f"    <b>{ilabel}:</b> {_clean(str(iv))}", bullet))
        else:
            # Plain string / number — inline key: value
            text = _trunc(str(v)) if isinstance(v, str) else _clean(str(v))
            story.append(Paragraph(f"<b>{label}:</b>  {text}", kv))

    story.append(Spacer(1, 0.04 * inch))


@router.get("/{session_id}/pdf")
async def download_session_pdf(
    session_id: str,
    authorization: Optional[str] = Header(None),
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        session = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        outputs = await conn.fetch(
            "SELECT agent_name, output_json FROM agent_outputs WHERE session_id = $1",
            session_id,
        )

    outputs_by_agent: dict = {o["agent_name"]: json.loads(o["output_json"]) for o in outputs}

    if not _REPORTLAB_OK:
        raise HTTPException(status_code=500, detail="reportlab not installed")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.9 * inch,
        rightMargin=0.9 * inch,
        topMargin=0.9 * inch,
        bottomMargin=0.9 * inch,
    )

    BASE = getSampleStyleSheet()

    VIOLET     = colors.HexColor("#4c1d95")
    VIOLET_LT  = colors.HexColor("#6d28d9")
    RULE_COLOR = colors.HexColor("#ddd6fe")
    TEXT       = colors.HexColor("#1c1917")
    MUTED      = colors.HexColor("#57534e")
    ACCENT     = colors.HexColor("#7c3aed")

    title_style = ParagraphStyle("RTitle",  parent=BASE["Title"],
        fontSize=26, textColor=VIOLET, spaceAfter=4, alignment=TA_CENTER, leading=32)

    meta_style  = ParagraphStyle("RMeta",   parent=BASE["Normal"],
        fontSize=10, textColor=MUTED, alignment=TA_CENTER, spaceAfter=14)

    h1_style    = ParagraphStyle("RH1",     parent=BASE["Heading1"],
        fontSize=17, textColor=VIOLET, spaceBefore=6, spaceAfter=8, leading=22)

    h2_style    = ParagraphStyle("RH2",     parent=BASE["Heading2"],
        fontSize=12, textColor=VIOLET_LT, spaceBefore=10, spaceAfter=4, leading=16)

    body_style  = ParagraphStyle("RBody",   parent=BASE["Normal"],
        fontSize=10, leading=16, textColor=TEXT, spaceAfter=4, alignment=TA_JUSTIFY)

    bullet_style = ParagraphStyle("RBullet", parent=BASE["Normal"],
        fontSize=10, leading=15, textColor=TEXT, spaceAfter=3,
        leftIndent=14, firstLineIndent=0)

    kv_style    = ParagraphStyle("RKV",     parent=BASE["Normal"],
        fontSize=10, leading=15, textColor=TEXT, spaceAfter=4)

    label_style = ParagraphStyle("RLabel",  parent=BASE["Normal"],
        fontSize=8, leading=12, textColor=MUTED, spaceAfter=2,
        fontName="Helvetica-Oblique")

    styles = {
        "body": body_style, "h2": h2_style, "bullet": bullet_style,
        "kv": kv_style, "label": label_style, "hr_color": RULE_COLOR,
    }

    # ── Cover ──────────────────────────────────────────────────────────────────
    story = []
    idea_text = _clean((session["startup_idea"] or "")[:150])

    story.append(Spacer(1, 0.5 * inch))
    story.append(Paragraph("Founder Orchestration Report", title_style))
    story.append(Paragraph(idea_text, meta_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=RULE_COLOR, spaceAfter=10))

    # Table of contents hint
    sections_toc = [
        "01  Executive Summary",
        "02  Market Research",
        "03  Product Requirements",
        "04  Technical Architecture",
        "05  Go-to-Market Strategy",
        "06  Engineering Sprint Board",
    ]
    toc_data = [[Paragraph(s, label_style)] for s in sections_toc]
    toc_table = Table(toc_data, colWidths=[4.5 * inch])
    toc_table.setStyle(TableStyle([
        ("TOPPADDING",    (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
    ]))
    story.append(Spacer(1, 0.2 * inch))
    story.append(toc_table)
    story.append(PageBreak())

    # ── Sections ───────────────────────────────────────────────────────────────
    sections = [
        ("startup_advisor",     "01  Executive Summary"),
        ("market_research",     "02  Market Research"),
        ("product_manager",     "03  Product Requirements"),
        ("architect",           "04  Technical Architecture"),
        ("marketing",           "05  Go-to-Market Strategy"),
        ("engineering_manager", "06  Engineering Sprint Board"),
    ]

    for agent_name, section_title in sections:
        data = outputs_by_agent.get(agent_name)

        story.append(Paragraph(section_title, h1_style))
        story.append(HRFlowable(width="100%", thickness=1, color=RULE_COLOR, spaceAfter=10))
        story.append(Spacer(1, 0.06 * inch))

        if not data:
            story.append(Paragraph("No output generated for this section.", body_style))
            story.append(PageBreak())
            continue

        # Render each top-level key in the agent output
        for key, value in data.items():
            if key in _SKIP_KEYS or key.startswith("_"):
                continue
            if value is None or value == "" or value == [] or value == {}:
                continue

            label = key.replace("_", " ").title()

            # Sprint section: special renderer for readability
            if key == "sprints" and isinstance(value, list):
                story.append(Paragraph("Sprints", h2_style))
                for sprint in value:
                    sprint_num  = sprint.get("sprint", "")
                    sprint_goal = _clean(sprint.get("goal", ""))
                    sprint_dur  = sprint.get("duration_weeks", "")
                    tasks       = sprint.get("tasks", [])

                    header_text = f"Sprint {sprint_num}:  {sprint_goal}  ({sprint_dur}w)"
                    sprint_block = [
                        Paragraph(header_text, h2_style),
                    ]
                    for task in tasks:
                        t_title = _clean(task.get("title", ""))
                        t_desc  = _clean(task.get("description", ""))
                        t_label = task.get("label", "")
                        t_pts   = task.get("story_points", "")
                        sprint_block.append(
                            Paragraph(f"•  <b>{t_title}</b>  [{t_label} · {t_pts}pt]", bullet_style)
                        )
                        if t_desc:
                            sprint_block.append(
                                Paragraph(f"    {t_desc}", bullet_style)
                            )
                    sprint_block.append(Spacer(1, 0.08 * inch))
                    story.extend(sprint_block)
                story.append(Spacer(1, 0.1 * inch))
                continue

            # Competitors: card per competitor
            if key == "competitors" and isinstance(value, list):
                story.append(Paragraph("Competitors", h2_style))
                for i, comp in enumerate(value):
                    if not isinstance(comp, dict):
                        continue
                    if i > 0:
                        story.append(HRFlowable(width="100%", thickness=0.4, color=RULE_COLOR, spaceAfter=6))
                    name = _clean(comp.get("name", f"Competitor {i+1}"))
                    story.append(Paragraph(f"<b>{name}</b>", kv_style))
                    for ck, cv in comp.items():
                        if ck == "name" or not cv:
                            continue
                        cl = ck.replace("_", " ").title()
                        story.append(Paragraph(f"    <b>{cl}:</b>  {_clean(str(cv))}", bullet_style))
                    story.append(Spacer(1, 0.06 * inch))
                continue

            # Core features: card per feature
            if key == "core_features" and isinstance(value, list):
                story.append(Paragraph("Core Features", h2_style))
                for feat in value:
                    if not isinstance(feat, dict):
                        continue
                    name     = _clean(feat.get("name", ""))
                    priority = feat.get("priority", "")
                    desc     = _clean(feat.get("description", ""))
                    story.append(Paragraph(
                        f"<b>{name}</b>  <font color='#7c3aed' size='9'>[{priority}]</font>",
                        kv_style
                    ))
                    if desc:
                        story.append(Paragraph(f"    {desc}", bullet_style))
                    story.append(Spacer(1, 0.04 * inch))
                continue

            # Roadmap: phase cards
            if key == "roadmap" and isinstance(value, list):
                story.append(Paragraph("Roadmap", h2_style))
                for phase in value:
                    if not isinstance(phase, dict):
                        continue
                    ph_name = _clean(phase.get("phase", phase.get("name", "")))
                    ph_dur  = phase.get("duration", "")
                    delivs  = phase.get("deliverables", [])
                    story.append(Paragraph(
                        f"<b>{ph_name}</b>  <font color='#78716c' size='9'>({ph_dur})</font>",
                        kv_style
                    ))
                    for d in delivs:
                        story.append(Paragraph(f"    •  {_clean(str(d))}", bullet_style))
                    story.append(Spacer(1, 0.05 * inch))
                continue

            # SWOT: quadrant labels
            if key == "swot" and isinstance(value, dict):
                story.append(Paragraph("SWOT Analysis", h2_style))
                quadrant_order = ["strengths", "weaknesses", "opportunities", "threats"]
                all_keys = list(value.keys())
                ordered = [k for k in quadrant_order if k in value] + \
                          [k for k in all_keys if k not in quadrant_order]
                for qk in ordered:
                    qv = value[qk]
                    story.append(Paragraph(f"<b>{qk.title()}</b>", kv_style))
                    if isinstance(qv, list):
                        for item in qv:
                            story.append(Paragraph(f"    •  {_clean(str(item))}", bullet_style))
                    else:
                        story.append(Paragraph(f"    {_clean(str(qv))}", bullet_style))
                    story.append(Spacer(1, 0.05 * inch))
                continue

            # Launch channels: card per channel
            if key == "launch_channels" and isinstance(value, list):
                story.append(Paragraph("Launch Channels", h2_style))
                for ch in value:
                    if not isinstance(ch, dict):
                        continue
                    ch_name  = _clean(ch.get("channel", ch.get("name", "")))
                    tactic   = _clean(ch.get("tactic", ""))
                    reach    = _clean(ch.get("expected_reach", ""))
                    story.append(Paragraph(f"<b>{ch_name}</b>", kv_style))
                    if tactic:
                        story.append(Paragraph(f"    Tactic: {tactic}", bullet_style))
                    if reach:
                        story.append(Paragraph(f"    Expected Reach: {reach}", bullet_style))
                    story.append(Spacer(1, 0.05 * inch))
                continue

            # Email sequence: subject + goal + truncated body per email
            if key == "email_sequence" and isinstance(value, list):
                story.append(Paragraph("Email Sequence", h2_style))
                for em in value:
                    if not isinstance(em, dict):
                        continue
                    subj      = _clean(em.get("subject", ""))
                    goal      = _clean(em.get("goal", ""))
                    send_time = _clean(em.get("send_time", ""))
                    body_txt  = em.get("body") or em.get("body_preview") or ""
                    story.append(Paragraph(f"<b>{subj}</b>", kv_style))
                    if goal:
                        story.append(Paragraph(f"    Goal: {goal}", bullet_style))
                    if send_time:
                        story.append(Paragraph(f"    Send: {send_time}", bullet_style))
                    if body_txt:
                        story.append(Paragraph(f"    {_trunc(body_txt, 300)}", bullet_style))
                    story.append(Spacer(1, 0.07 * inch))
                    story.append(HRFlowable(width="100%", thickness=0.3, color=RULE_COLOR, spaceAfter=4))
                continue

            # Landing page copy: flatten nested dict
            if key == "landing_page_copy" and isinstance(value, dict):
                story.append(Paragraph("Landing Page Copy", h2_style))
                for lpk, lpv in value.items():
                    if not lpv:
                        continue
                    lpl = lpk.replace("_", " ").title()
                    if isinstance(lpv, list):
                        story.append(Paragraph(f"<b>{lpl}</b>", kv_style))
                        for lpitem in lpv:
                            if isinstance(lpitem, dict):
                                parts = "  |  ".join(
                                    f"<b>{k.replace('_',' ').title()}:</b> {_clean(str(v))}"
                                    for k, v in lpitem.items() if v
                                )
                                story.append(Paragraph(f"    {parts}", bullet_style))
                            else:
                                story.append(Paragraph(f"    •  {_clean(str(lpitem))}", bullet_style))
                    else:
                        story.append(Paragraph(f"<b>{lpl}:</b>  {_trunc(str(lpv), 200)}", kv_style))
                    story.append(Spacer(1, 0.04 * inch))
                continue

            # Pricing recommendation: tiers as cards
            if key == "pricing_recommendation" and isinstance(value, dict):
                story.append(Paragraph("Pricing", h2_style))
                model = value.get("model", "")
                if model:
                    story.append(Paragraph(f"<b>Model:</b>  {_clean(str(model))}", kv_style))
                tiers = value.get("tiers", [])
                for tier in tiers:
                    if not isinstance(tier, dict):
                        continue
                    t_name  = _clean(tier.get("name", tier.get("tier", "")))
                    t_price = _clean(str(tier.get("price", "")))
                    story.append(Paragraph(f"<b>{t_name}</b>  —  {t_price}", kv_style))
                    for f in tier.get("features", []):
                        story.append(Paragraph(f"    •  {_clean(str(f))}", bullet_style))
                    story.append(Spacer(1, 0.04 * inch))
                continue

            # Generic fallback
            story.append(Paragraph(label, h2_style))
            _render(value, story, styles)
            story.append(Spacer(1, 0.06 * inch))

        story.append(PageBreak())

    doc.build(story)
    buf.seek(0)

    safe_id = session_id[:8]
    return StreamingResponse(
        buf,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="founder-report-{safe_id}.pdf"'},
    )
