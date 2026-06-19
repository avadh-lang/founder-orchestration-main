import io
import re
import json
import pdfplumber
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable

def extract_pdf_text(file_bytes: bytes) -> str:
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text.strip())
    return "\n\n".join(text_parts)

def clean_markdown(text: str) -> str:
    if not isinstance(text, str):
        return str(text)
    
    # Escape XML entities first
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    
    # Convert markdown bold **text** to ReportLab HTML bold <b>text</b>
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    # Convert markdown italic *text* or _text_ to ReportLab HTML italic <i>text</i>
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
    text = re.sub(r'_(.*?)_', r'<i>\1</i>', text)
    
    # Remove markdown headers markup
    text = re.sub(r'#+\s*', '', text)
    
    # Replace custom bullet/separator marks
    text = text.replace("■", "•").replace("■■", "•").replace("`", "")
    return text.strip()

def generate_report_pdf(session_data: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                            leftMargin=inch, rightMargin=inch,
                            topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("Title", parent=styles["Title"],
                                  fontSize=24, textColor=colors.HexColor("#1a1a2e"), spaceAfter=12)
    h1_style = ParagraphStyle("H1", parent=styles["Heading1"],
                               fontSize=14, textColor=colors.HexColor("#16213e"), spaceBefore=12, spaceAfter=4, keepWithNext=True)
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"],
                               fontSize=11, textColor=colors.HexColor("#0f3460"), spaceBefore=8, spaceAfter=2, keepWithNext=True)
    body_style = ParagraphStyle("Body", parent=styles["Normal"],
                                 fontSize=9, leading=13, spaceAfter=6)

    story = []
    story.append(Paragraph("AI Founder Orchestration Report", title_style))
    idea = session_data.get("startup_idea", "")
    story.append(Paragraph(f"<b>Base Idea:</b> {clean_markdown(idea)}", body_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#e94560"), spaceAfter=10))

    # --- 1. Startup Advisor ---
    advisor = session_data.get("startup_advisor")
    if advisor:
        story.append(Paragraph("1. Startup Advisor", h1_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceAfter=6))
        
        fields = [
            ("startup_name", "Generated Startup Name"),
            ("refined_idea", "Refined Idea"),
            ("problem_statement", "Problem Statement"),
            ("target_audience", "Target Audience"),
            ("value_proposition", "Value Proposition"),
            ("recommendation", "Recommendation"),
            ("reasoning", "Reasoning")
        ]
        for key, label in fields:
            val = advisor.get(key)
            if val:
                if key == "recommendation":
                    val = str(val).upper()
                story.append(Paragraph(f"<b>{label}:</b> {clean_markdown(val)}", body_style))
                
        risks = advisor.get("risks")
        if risks and isinstance(risks, list):
            story.append(Paragraph("<b>Risks:</b>", h2_style))
            for risk in risks:
                story.append(Paragraph(f"• {clean_markdown(risk)}", body_style))
                
        story.append(Spacer(1, 0.15 * inch))

    # --- 2. Market Research ---
    market = session_data.get("market_research")
    if market:
        story.append(Paragraph("2. Market Research", h1_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceAfter=6))
        
        fields = [
            ("market_size", "Market Size"),
            ("market_growth_rate", "Market Growth Rate"),
            ("recommended_positioning", "Recommended Positioning")
        ]
        for key, label in fields:
            val = market.get(key)
            if val:
                story.append(Paragraph(f"<b>{label}:</b> {clean_markdown(val)}", body_style))
                
        competitors = market.get("competitors")
        if competitors and isinstance(competitors, list):
            story.append(Paragraph("<b>Competitors:</b>", h2_style))
            for comp in competitors:
                if isinstance(comp, dict):
                    comp_name = clean_markdown(comp.get("name") or "Unnamed Competitor")
                    comp_desc = clean_markdown(comp.get("description") or "")
                    comp_text = f"• <b>{comp_name}</b>: {comp_desc}"
                    if comp.get("strengths"):
                        comp_text += f"<br/>&nbsp;&nbsp;<i>Strengths:</i> {clean_markdown(comp.get('strengths'))}"
                    if comp.get("weaknesses"):
                        comp_text += f"<br/>&nbsp;&nbsp;<i>Weaknesses:</i> {clean_markdown(comp.get('weaknesses'))}"
                    story.append(Paragraph(comp_text, body_style))
                else:
                    story.append(Paragraph(f"• {clean_markdown(str(comp))}", body_style))
                    
        swot = market.get("swot")
        if swot and isinstance(swot, dict):
            story.append(Paragraph("<b>SWOT Analysis:</b>", h2_style))
            for k, val_list in swot.items():
                if val_list and isinstance(val_list, list):
                    story.append(Paragraph(f"<i>{k.capitalize()}:</i>", body_style))
                    for item in val_list:
                        story.append(Paragraph(f"  - {clean_markdown(item)}", body_style))
                        
        gaps = market.get("gaps")
        if gaps and isinstance(gaps, list):
            story.append(Paragraph("<b>Market Gaps:</b>", h2_style))
            for gap in gaps:
                story.append(Paragraph(f"• {clean_markdown(gap)}", body_style))
                
        trends = market.get("trends")
        if trends and isinstance(trends, list):
            story.append(Paragraph("<b>Industry Trends:</b>", h2_style))
            for trend in trends:
                story.append(Paragraph(f"• {clean_markdown(trend)}", body_style))
                
        story.append(Spacer(1, 0.15 * inch))

    # --- 3. Product Manager (PRD) ---
    pm = session_data.get("product_manager")
    if pm:
        story.append(Paragraph("3. Product Manager (PRD)", h1_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceAfter=6))
        
        if pm.get("notion_url"):
            story.append(Paragraph(f"<b>Notion PRD Link:</b> {pm['notion_url']}", body_style))
            
        mvp_scope = pm.get("mvp_scope")
        if mvp_scope and isinstance(mvp_scope, list):
            story.append(Paragraph("<b>MVP Scope:</b>", h2_style))
            for scope in mvp_scope:
                story.append(Paragraph(f"• {clean_markdown(scope)}", body_style))
                
        core_features = pm.get("core_features")
        if core_features and isinstance(core_features, list):
            story.append(Paragraph("<b>Core Features:</b>", h2_style))
            for feat in core_features:
                if isinstance(feat, dict):
                    f_name = feat.get("name") or "Unnamed Feature"
                    f_priority = feat.get("priority") or "medium"
                    f_desc = feat.get("description") or ""
                    story.append(Paragraph(f"• <b>{f_name}</b> (<i>Priority: {f_priority}</i>): {f_desc}", body_style))
                else:
                    story.append(Paragraph(f"• {clean_markdown(str(feat))}", body_style))
                    
        user_stories = pm.get("user_stories")
        if user_stories and isinstance(user_stories, list):
            story.append(Paragraph("<b>User Stories:</b>", h2_style))
            for story_item in user_stories:
                if isinstance(story_item, dict):
                    persona = story_item.get("persona") or "User"
                    action = story_item.get("action") or ""
                    benefit = story_item.get("benefit") or ""
                    story.append(Paragraph(f"• As a <b>{persona}</b>, I want to <i>{action}</i> so that <i>{benefit}</i>", body_style))
                else:
                    story.append(Paragraph(f"• {clean_markdown(str(story_item))}", body_style))
                    
        roadmap = pm.get("roadmap")
        if roadmap and isinstance(roadmap, list):
            story.append(Paragraph("<b>Product Roadmap:</b>", h2_style))
            for phase in roadmap:
                if isinstance(phase, dict):
                    phase_title = f"Phase: <b>{phase.get('phase', '')}</b> ({phase.get('duration', '')})"
                    story.append(Paragraph(phase_title, body_style))
                    deliverables = phase.get("deliverables") or []
                    for deliv in deliverables:
                        story.append(Paragraph(f"  - {clean_markdown(deliv)}", body_style))
                else:
                    story.append(Paragraph(f"• {clean_markdown(str(phase))}", body_style))
                    
        success_metrics = pm.get("success_metrics")
        if success_metrics and isinstance(success_metrics, list):
            story.append(Paragraph("<b>Success Metrics:</b>", h2_style))
            for metric in success_metrics:
                story.append(Paragraph(f"• {clean_markdown(metric)}", body_style))
                
        story.append(Spacer(1, 0.15 * inch))

    # --- 4. Technical Architecture ---
    arch = session_data.get("architect")
    if arch:
        story.append(Paragraph("4. Technical Architecture", h1_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceAfter=6))
        
        if arch.get("github_repo_url"):
            story.append(Paragraph(f"<b>GitHub Repository:</b> {arch['github_repo_url']}", body_style))
        if arch.get("system_design"):
            story.append(Paragraph(f"<b>System Design:</b> {clean_markdown(arch['system_design'])}", body_style))
            
        tech_stack = arch.get("tech_stack")
        if tech_stack and isinstance(tech_stack, dict):
            story.append(Paragraph("<b>Tech Stack:</b>", h2_style))
            for k, val in tech_stack.items():
                if val:
                    if isinstance(val, list):
                        val_str = ", ".join(val)
                    else:
                        val_str = str(val)
                    story.append(Paragraph(f"• <b>{k.capitalize()}:</b> {clean_markdown(val_str)}", body_style))
                    
        api_endpoints = arch.get("api_endpoints")
        if api_endpoints and isinstance(api_endpoints, list):
            story.append(Paragraph("<b>API Endpoints:</b>", h2_style))
            for ep in api_endpoints:
                if isinstance(ep, dict):
                    method = ep.get("method") or "GET"
                    path = ep.get("path") or ""
                    desc = ep.get("description") or ""
                    story.append(Paragraph(f"• <b>{method}</b> {path} — {desc}", body_style))
                else:
                    story.append(Paragraph(f"• {clean_markdown(str(ep))}", body_style))
                    
        data_models = arch.get("data_models")
        if data_models and isinstance(data_models, list):
            story.append(Paragraph("<b>Data Models:</b>", h2_style))
            for model in data_models:
                if isinstance(model, dict):
                    name = model.get("name") or "Model"
                    fields = ", ".join(model.get("fields") or [])
                    story.append(Paragraph(f"• <b>{name}</b>: {clean_markdown(fields)}", body_style))
                else:
                    story.append(Paragraph(f"• {clean_markdown(str(model))}", body_style))
                    
        if arch.get("scalability_notes"):
            story.append(Paragraph(f"<b>Scalability Notes:</b> {clean_markdown(arch['scalability_notes'])}", body_style))
            
        story.append(Spacer(1, 0.15 * inch))

    # --- 5. Engineering Manager ---
    em = session_data.get("engineering_manager")
    if em:
        story.append(Paragraph("5. Engineering Manager", h1_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceAfter=6))
        
        if em.get("total_weeks"):
            story.append(Paragraph(f"<b>Total Duration:</b> {em['total_weeks']} Weeks", body_style))
        if em.get("team_size_recommended"):
            story.append(Paragraph(f"<b>Recommended Team Size:</b> {em['team_size_recommended']} members", body_style))
            
        sprints = em.get("sprints")
        if sprints and isinstance(sprints, list):
            story.append(Paragraph("<b>Sprint Plan:</b>", h2_style))
            for sprint in sprints:
                if isinstance(sprint, dict):
                    story.append(Paragraph(f"• <b>Sprint {sprint.get('sprint', 1)}:</b> {clean_markdown(sprint.get('goal', ''))} ({sprint.get('duration_weeks', 2)} weeks)", body_style))
                    tasks = sprint.get("tasks") or []
                    for task in tasks:
                        if isinstance(task, dict):
                            story.append(Paragraph(f"  - <b>[{task.get('label', 'task')}]</b> {clean_markdown(task.get('title', ''))} ({task.get('story_points', 0)} pts) — {clean_markdown(task.get('description', ''))}", body_style))
                else:
                    story.append(Paragraph(f"• {clean_markdown(str(sprint))}", body_style))
                    
        dod = em.get("definition_of_done")
        if dod and isinstance(dod, list):
            story.append(Paragraph("<b>Definition of Done:</b>", h2_style))
            for criteria in dod:
                story.append(Paragraph(f"• {clean_markdown(criteria)}", body_style))
                
        tech_debt = em.get("tech_debt_risks")
        if tech_debt and isinstance(tech_debt, list):
            story.append(Paragraph("<b>Tech Debt & Risks:</b>", h2_style))
            for risk in tech_debt:
                story.append(Paragraph(f"• {clean_markdown(risk)}", body_style))
                
        story.append(Spacer(1, 0.15 * inch))

    # --- 6. Marketing Strategy ---
    mkt = session_data.get("marketing")
    if mkt:
        story.append(Paragraph("6. Marketing Strategy", h1_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceAfter=6))
        
        if mkt.get("tagline"):
            story.append(Paragraph(f"<b>Tagline:</b> \"{clean_markdown(mkt['tagline'])}\"", body_style))
        if mkt.get("gtm_strategy"):
            story.append(Paragraph(f"<b>Go-To-Market Narrative:</b> {clean_markdown(mkt['gtm_strategy'])}", body_style))
            
        lpc = mkt.get("landing_page_copy")
        if lpc and isinstance(lpc, dict):
            story.append(Paragraph("<b>Landing Page Copy:</b>", h2_style))
            if lpc.get("hero_headline"):
                story.append(Paragraph(f"<i>Hero Headline:</i> {clean_markdown(lpc['hero_headline'])}", body_style))
            if lpc.get("hero_subheadline"):
                story.append(Paragraph(f"<i>Subheadline:</i> {clean_markdown(lpc['hero_subheadline'])}", body_style))
            if lpc.get("cta_text"):
                story.append(Paragraph(f"<i>CTA Text:</i> {clean_markdown(lpc['cta_text'])}", body_style))
            if lpc.get("social_proof"):
                story.append(Paragraph(f"<i>Social Proof:</i> {clean_markdown(lpc['social_proof'])}", body_style))
                
            features = lpc.get("features")
            if features and isinstance(features, list):
                story.append(Paragraph("<i>Key Features:</i>", body_style))
                for f in features:
                    if isinstance(f, dict):
                        story.append(Paragraph(f"  - <b>{f.get('title', '')}</b>: {clean_markdown(f.get('description', ''))}", body_style))
            faq = lpc.get("faq")
            if faq and isinstance(faq, list):
                story.append(Paragraph("<i>FAQ:</i>", body_style))
                for faq_item in faq:
                    if isinstance(faq_item, dict):
                        story.append(Paragraph(f"  <b>Q:</b> {clean_markdown(faq_item.get('question', ''))}<br/>  <b>A:</b> {clean_markdown(faq_item.get('answer', ''))}", body_style))
                        
        lc_list = mkt.get("launch_channels")
        if lc_list and isinstance(lc_list, list):
            story.append(Paragraph("<b>Launch Channels:</b>", h2_style))
            for lc in lc_list:
                if isinstance(lc, dict):
                    story.append(Paragraph(f"• <b>{lc.get('channel', '')}</b>: {clean_markdown(lc.get('tactic', ''))} (Reach: {lc.get('expected_reach', '')})", body_style))
                else:
                    story.append(Paragraph(f"• {clean_markdown(str(lc))}", body_style))
                    
        email_seq = mkt.get("email_sequence")
        if email_seq and isinstance(email_seq, list):
            story.append(Paragraph("<b>Email Campaign Sequence:</b>", h2_style))
            for email in email_seq:
                if isinstance(email, dict):
                    story.append(Paragraph(
                        f"• <b>Email {email.get('email', '')} ({email.get('send_time', '')}):</b> {clean_markdown(email.get('subject', ''))}",
                        body_style
                    ))
                    if email.get("body_preview"):
                        story.append(Paragraph(f"  {clean_markdown(email['body_preview'])}", body_style))

        linkedin = mkt.get("linkedin_post")
        if linkedin:
            story.append(Paragraph("<b>LinkedIn Launch Post:</b>", h2_style))
            for line in linkedin.split("\n"):
                if line.strip():
                    story.append(Paragraph(clean_markdown(line), body_style))
                    
        pricing = mkt.get("pricing_recommendation")
        if pricing and isinstance(pricing, dict):
            story.append(Paragraph(f"<b>Pricing Model:</b> {pricing.get('model', 'freemium')}", body_style))
            tiers = pricing.get("tiers") or []
            for tier in tiers:
                if isinstance(tier, dict):
                    feats = ", ".join(tier.get("features") or [])
                    story.append(Paragraph(f"• <b>{tier.get('name', '')}</b> ({tier.get('price', '')}): {clean_markdown(feats)}", body_style))
                    
        plan_90 = mkt.get("90_day_plan")
        if plan_90 and isinstance(plan_90, list):
            story.append(Paragraph("<b>90-Day Execution Plan:</b>", h2_style))
            for step in plan_90:
                story.append(Paragraph(f"• {clean_markdown(step)}", body_style))

    doc.build(story)
    return buffer.getvalue()
