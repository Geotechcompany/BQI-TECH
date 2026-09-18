#!/usr/bin/env python3
"""Generate BQI Platform Version 4 Features PDF (reportlab)."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "BQI-Platform-Version-4-Features.pdf"
ASSETS = ROOT / "scripts" / "_pdf_assets"
LOGO_COVER = ASSETS / "logo-cover.png"
LOGO_HEADER = ASSETS / "logo-header.png"

NAVY = HexColor("#272156")
NAVY_ALT = HexColor("#272055")
CYAN = HexColor("#31CDFF")
INK = HexColor("#1a1a1a")
MUTED = HexColor("#4a4a55")
RULE = HexColor("#d8d8e0")
PAGE_BG = HexColor("#f7f7f9")

PAGE_W, PAGE_H = letter
MARGIN_L = 0.75 * inch
MARGIN_R = 0.75 * inch
MARGIN_T = 0.85 * inch
MARGIN_B = 0.7 * inch


SECTIONS: list[tuple[str, list[str]]] = [
    (
        "Recruitment & Pipeline",
        [
            "Pipeline Quickdrop - drag a candidate card onto floating targets to open discussion, move to Offer or Hired, or archive.",
            "Per-job kanban board - stage columns with immediate save on drag between stages.",
            "Column kebab menu - Edit Stage Actions, Move To Stage, Run BQI Intelligence, and related column tools.",
            "Column hover outline - dotted border on stage columns while hovering.",
            "Add Candidates - place people into the first stage without a careers-site application.",
            "Pipeline settings - rename stages, pick a template, and configure stage actions for that position.",
            "List view link - jump to the Candidates table filtered to the open position.",
            "Applicants workspace - three-pane board: positions list, stage queue, and candidate/resume panel.",
            "Applicants preferences - choose which stages and columns appear on your board.",
            "Stage action bar - move, tag, score, and bulk tools for the current stage queue.",
        ],
    ),
    (
        "Candidates, CV & Profiles",
        [
            "Candidate profile - stage controls, BQI Intelligence score, resume/documents, and sibling navigation.",
            "Header More menu - move, copy, delete, archive, add task, share, print, and related actions wired to real APIs.",
            "Team Discussion - threaded hiring conversation on the candidate profile with emoji composer support.",
            "Resume CV extract - upload PDF/Word on Add Candidate to extract name, email, phone, and location for review.",
            "CSV candidate import - bulk-add candidates from a spreadsheet into a pipeline.",
            "Advanced applicant filters - filter by status, job, and BQI Intelligence score; toggle sort direction.",
            "Archive and restore - move applications between active pipelines and Archived with consistent counts.",
            "Inline status updates - change status from the candidate view without a separate edit dialog.",
        ],
    ),
    (
        "BQI Intelligence & Settings",
        [
            "AI provider settings - choose provider preset, store API key, pick model, and test the connection before saving.",
            "BQI Intelligence toggles - turn ranking and related AI features on for the company after providers are configured.",
            "Applicant ranking - score candidates against the applied position using CV text and application answers.",
            "Score and assessment columns - color-coded 0-100 fit scores with strengths/gaps summaries across Applications and pipeline views.",
            "Flexible ranking actions - score the page, selected rows, a single row, or one candidate inside the profile.",
            "Ranking progress overlay - live step feedback during batch and single ranking runs.",
        ],
    ),
    (
        "Jobs & Activation",
        [
            "Position setup wizard - multi-step flow (Details, Description, Application, Pipeline, and publish steps) with Save Progress drafts.",
            "Application form builder - standard fields with required / optional / disabled modes; questionnaire items by type.",
            "Questionnaire builder dialog - add and configure questions without leaving the wizard.",
            "Job activation gates - block Activate until title, department, location, description, and at least one pipeline stage are set.",
            "Activation error messaging - clear missing-field toasts from client checks and API activation_incomplete responses.",
            "Overview position cards - filter My / All / Starred; open pipeline or candidates; invite hiring team; activate or deactivate.",
        ],
    ),
    (
        "Documents",
        [
            "Company documents library - upload PDF, Word, or Excel with title, category, and optional description.",
            "Search and filter - by title, file name, author, or format; category chips for Policies, Handbooks, Templates, Forms.",
            "Shared library actions - open a document to view; delete removes it from the team library.",
        ],
    ),
    (
        "Calendar & Microsoft Integration",
        [
            "Recruitment calendar - interviews, technical assessments, and hire dates from applications on month, week, or day views.",
            "Event filters - show or hide event types and limit the calendar to one position.",
            "Microsoft Outlook meetings - connect Microsoft in Settings; sync and display Outlook events alongside recruitment events.",
            "Event detail - open a calendar entry to jump to the linked application or meeting metadata.",
            "My Agenda widget - upcoming interviews and assessments for the signed-in admin on Overview.",
        ],
    ),
    (
        "Communications, Inbox & Tasks",
        [
            "Communications - foldered hiring email (Inbox, Sent, Failed, Starred) with type filters and delivery status.",
            "Candidate Inbox - threaded candidate email with unread counts and Open profile.",
            "Search - filter Communications by subject, recipient, or candidate from the page header.",
            "Hiring tasks - Mine / Team / Completed filters; create tasks with assignees and attachments.",
            "My Tasks widget - incomplete follow-ups on Overview with check-off.",
        ],
    ),
    (
        "Reports & Empty States",
        [
            "Reports page - volume, sources, pipeline conversion, and time-to-hire for selected positions.",
            "Status KPIs - New, Shortlisted, Interviewing, Technical, Hired, and Disqualified with share of total.",
            "Charts - daily trends, source mix, and funnel conversion.",
            "Export - CSV download or PDF print snapshot of the metrics page.",
            "Lottie empty states - illustrated empties for by-job, hire timing, trends, applicants, candidates, inbox, and tasks.",
            "Loading skeletons - table, list, chart, and inbox split skeletons while data loads.",
        ],
    ),
    (
        "Admin Chrome, Guides & Onboarding",
        [
            "Version 4 welcome modal - first-run highlights for Quickdrop, Communications, Inbox, Reports, and BQI Intelligence.",
            "Finish Setup checklist - add position, invite team, and careers-site steps with minimize / skip.",
            "Guide tours - page-level walkthroughs (Overview, Pipeline, Applicants, Jobs wizard, Settings, and more) via Guide.",
            "Overview welcome banner - greeting, pipeline counts, and shortcuts to Candidates and Post a position.",
            "Admin page banners - concrete titles and subtitles per admin route.",
            "Sidebar navigation - Inbox, Communications, Reports, Documents, Calendar, and related modules.",
            "Brand title - admin chrome shows Version 4 as the active product version label.",
        ],
    ),
    (
        "Content: Blog",
        [
            "Blog setup wizard - draft posts with cover image, body, and category; save draft and publish.",
            "Blog management table - view, edit, publish/unpublish, and delete posts.",
        ],
    ),
    (
        "User Portal",
        [
            "Candidate dashboard - welcome strip with application counts and shortcuts to My applications and Browse jobs.",
            "Hiring progress - stage position for the latest application.",
            "Status totals - submitted, shortlisted, assessment, interview, offers, and closed counts.",
            "Apply form - multi-step application with required-field gating, Back / Next, and Submit.",
            "Portal settings - profile photo/name/contact, password change, notification preferences, and privacy controls.",
            "User Guide tours - Overview, Applications, Jobs, Apply, and Settings walkthroughs.",
        ],
    ),
    (
        "Auth & Session",
        [
            "Stay Logged In - session timeout warning with countdown and refresh to keep the admin session active.",
            "Session expired handling - dialog path when a session cannot be refreshed, with clear next steps.",
            "Toast feedback - success and error toasts (Sonner) across admin and portal flows.",
        ],
    ),
]


def make_styles():
    base = getSampleStyleSheet()
    styles = {
        "cover_kicker": ParagraphStyle(
            "cover_kicker",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            textColor=CYAN,
            alignment=TA_CENTER,
            spaceAfter=8,
            tracking=1.5,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=32,
            textColor=white,
            alignment=TA_CENTER,
            spaceAfter=10,
            leading=36,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=12,
            textColor=HexColor("#dce9f0"),
            alignment=TA_CENTER,
            leading=17,
            spaceAfter=6,
        ),
        "cover_meta": ParagraphStyle(
            "cover_meta",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=HexColor("#a8b8c8"),
            alignment=TA_CENTER,
            leading=13,
        ),
        "intro": ParagraphStyle(
            "intro",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=MUTED,
            alignment=TA_JUSTIFY,
            leading=14,
            spaceAfter=10,
        ),
        "section": ParagraphStyle(
            "section",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=13,
            textColor=NAVY,
            spaceBefore=14,
            spaceAfter=6,
            leading=16,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            textColor=INK,
            leading=13,
            leftIndent=0,
        ),
        "toc_title": ParagraphStyle(
            "toc_title",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=14,
            textColor=NAVY,
            spaceAfter=10,
        ),
        "toc_item": ParagraphStyle(
            "toc_item",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=INK,
            leading=15,
            spaceAfter=3,
        ),
        "omitted": ParagraphStyle(
            "omitted",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=MUTED,
            leading=12.5,
            spaceAfter=4,
        ),
        "footer_note": ParagraphStyle(
            "footer_note",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
    }
    return styles


def draw_cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Cyan accent bar at top
    canvas.setFillColor(CYAN)
    canvas.rect(0, PAGE_H - 8, PAGE_W, 8, fill=1, stroke=0)
    # Soft bottom band
    canvas.setFillColor(NAVY_ALT)
    canvas.rect(0, 0, PAGE_W, 56, fill=1, stroke=0)
    canvas.setFillColor(CYAN)
    canvas.rect(0, 56, PAGE_W, 2, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#9aa8b8"))
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(
        PAGE_W / 2, 28, "Confidential product documentation  |  BQI Platform"
    )
    canvas.restoreState()


def draw_content_page(canvas, doc):
    canvas.saveState()
    # Header rule
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.6)
    y_header = PAGE_H - 0.48 * inch
    canvas.line(MARGIN_L, y_header, PAGE_W - MARGIN_R, y_header)

    if LOGO_HEADER.exists():
        canvas.drawImage(
            str(LOGO_HEADER),
            MARGIN_L,
            y_header + 6,
            width=18,
            height=20,
            mask="auto",
            preserveAspectRatio=True,
        )

    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(MARGIN_L + 24, y_header + 10, "BQI Platform")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(PAGE_W - MARGIN_R, y_header + 10, "Version 4 Features")

    # Footer
    y_footer = 0.42 * inch
    canvas.setStrokeColor(CYAN)
    canvas.setLineWidth(1.2)
    canvas.line(MARGIN_L, y_footer + 14, MARGIN_L + 36, y_footer + 14)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_L + 42, y_footer + 14, PAGE_W - MARGIN_R, y_footer + 14)

    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(MARGIN_L, y_footer, "BQI Platform  |  Version 4")
    canvas.drawRightString(PAGE_W - MARGIN_R, y_footer, f"{doc.page}")
    canvas.restoreState()


def build_pdf_v2() -> Path:
    """Build with explicit cover then content templates."""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    styles = make_styles()

    doc = BaseDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=MARGIN_L,
        rightMargin=MARGIN_R,
        topMargin=MARGIN_T,
        bottomMargin=MARGIN_B,
        title="BQI Platform Version 4 Features",
        author="BQI",
        subject="Shipped features in Version 4",
    )

    cover_frame = Frame(
        MARGIN_L,
        1.2 * inch,
        PAGE_W - MARGIN_L - MARGIN_R,
        PAGE_H - 2.4 * inch,
        id="cover",
        showBoundary=0,
    )
    content_frame = Frame(
        MARGIN_L,
        MARGIN_B + 0.05 * inch,
        PAGE_W - MARGIN_L - MARGIN_R,
        PAGE_H - MARGIN_T - MARGIN_B - 0.05 * inch,
        id="content",
        showBoundary=0,
    )

    def after_cover(flowables, doc_):
        doc_.handle_nextPageTemplate("content")

    cover_tmpl = PageTemplate(
        id="cover", frames=[cover_frame], onPage=draw_cover, onPageEnd=after_cover
    )
    content_tmpl = PageTemplate(
        id="content", frames=[content_frame], onPage=draw_content_page
    )
    doc.addPageTemplates([cover_tmpl, content_tmpl])

    story: list = []

    story.append(Spacer(1, 0.55 * inch))
    if LOGO_COVER.exists():
        img = Image(str(LOGO_COVER), width=1.15 * inch, height=1.25 * inch)
        img.hAlign = "CENTER"
        story.append(img)
        story.append(Spacer(1, 0.32 * inch))

    story.append(Paragraph("BQI PLATFORM", styles["cover_kicker"]))
    story.append(Paragraph("Version 4", styles["cover_title"]))
    story.append(
        Paragraph(
            "Shipped features across recruitment pipeline, documents,<br/>"
            "Microsoft calendar, candidate workspace, and the user portal.",
            styles["cover_sub"],
        )
    )
    story.append(Spacer(1, 0.3 * inch))
    story.append(
        Paragraph(
            "Product release document  |  Evidence from code, tours, and release notes<br/>"
            "July 2026",
            styles["cover_meta"],
        )
    )
    story.append(PageBreak())

    story.append(Paragraph("Contents", styles["toc_title"]))
    for i, (title, _) in enumerate(SECTIONS, start=1):
        story.append(Paragraph(f"{i}. {title}", styles["toc_item"]))
    story.append(Paragraph("Appendix. Planned items omitted", styles["toc_item"]))
    story.append(Spacer(1, 0.18 * inch))
    story.append(
        Paragraph(
            "This document lists Version 4 capabilities with clear evidence in the "
            "BQI Platform codebase, admin Guide tours, welcome modal copy, and "
            "feature-release notes. Planned Monday-board items without a shipped "
            "implementation appear only in the appendix.",
            styles["intro"],
        )
    )

    for title, bullets in SECTIONS:
        block = [Paragraph(title, styles["section"])]
        items = [
            ListItem(Paragraph(b, styles["bullet"]), leftIndent=8)
            for b in bullets
        ]
        block.append(
            ListFlowable(
                items,
                bulletType="bullet",
                bulletFontName="Helvetica",
                bulletFontSize=9,
                bulletColor=CYAN,
                leftIndent=12,
                spaceBefore=2,
                spaceAfter=2,
            )
        )
        story.append(KeepTogether(block))

    story.append(Spacer(1, 0.12 * inch))
    story.append(Paragraph("Appendix. Planned items omitted", styles["section"]))
    story.append(
        Paragraph(
            "These appear in Version 4 planning docs (meeting transcript / Monday board) "
            "but were not verified as shipped in code for this release document:",
            styles["intro"],
        )
    )
    omitted = [
        "Recruitment &gt; AI Requirements subsection for private hiring-manager scoring notes.",
        "Factoring hiring-manager AI requirements into ranking scores.",
        "Bulk rejection email with one-click manual send to all Rejected candidates.",
        "Dedicated curated shortlist/reject mass-email template flow.",
        "Full Breezy-style drag-and-drop question reordering beyond current wizard questionnaire tools.",
        "Job-scoped hiring-team visibility and external recruiter invites.",
        "Operational Dropbox resync of ~300 legacy CVs.",
        "Shortlist tab refresh bug (tracked defect, not a feature).",
        "Surveys builder (changelog Oct 2025; predates Version 4 framing).",
    ]
    for line in omitted:
        story.append(Paragraph(f"- {line}", styles["omitted"]))

    story.append(Spacer(1, 0.22 * inch))
    story.append(
        Paragraph(
            "Sources: Version4WelcomeModal, admin and user tours, feature-releases.ts, "
            "admin-page-banners.ts, job-activation.ts, QuickdropPipeline, "
            "MicrosoftIntegrationCard, resume-import, ApplicantsWorkspace, "
            "docs/VERSION 4 UPDATES REFFERENCES/.",
            styles["footer_note"],
        )
    )

    doc.build(story)
    return OUT


if __name__ == "__main__":
    path = build_pdf_v2()
    print(f"Wrote {path}")
