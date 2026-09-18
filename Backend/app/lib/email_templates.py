"""Pipeline-stage email broadcast templates — seed into Mongo on startup."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.lib.email_brand import BQI_BRAND, _frontend_url, _logo_url

NAVY = BQI_BRAND["navy"]  # #272156
CYAN = BQI_BRAND["cyan"]  # #31CDFF
BODY = BQI_BRAND["body_text"]
MUTED = BQI_BRAND["muted_text"]
LIGHT = BQI_BRAND["light_bg"]
BORDER = BQI_BRAND["border"]

# Match PipelineBoard / PIPELINE_STAGES ids (label.lower().replace spaces with -)
PIPELINE_STAGE_KEYS = (
    "new",
    "shortlisted",
    "technical-assessment",
    "interviewing",
    "hired",
    "disqualified",
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _header_block() -> str:
    logo = _logo_url(light=False)
    host = (
        _frontend_url()
        .replace("https://", "")
        .replace("http://", "")
        .split("/")[0]
        or "bqitech.com"
    )
    return f"""
    <div style="background:linear-gradient(135deg,{NAVY} 0%,{CYAN} 100%);padding:28px 24px;text-align:center;margin-bottom:0;">
      <img src="{logo}" alt="BQI Tech" style="max-width:160px;height:auto;margin-bottom:10px;" />
      <div style="color:rgba(255,255,255,0.9);font-size:13px;letter-spacing:0.04em;">{host}</div>
    </div>
    """


def _footer_block() -> str:
    logo = _logo_url(light=False)
    year = utc_now().year
    return f"""
    <div style="background:{LIGHT};padding:28px 24px;text-align:center;border-top:3px solid {CYAN};">
      <img src="{logo}" alt="BQI Tech" style="max-width:100px;height:auto;opacity:0.85;margin-bottom:14px;" />
      <p style="margin:0 0 8px;color:{BODY};font-size:14px;line-height:1.6;">
        <strong>BQI Technologies</strong><br />
        Talent &amp; recruiting
      </p>
      <p style="margin:0;color:{MUTED};font-size:12px;">
        © {year} BQI Tech ·
        <a href="{_frontend_url()}" style="color:{CYAN};text-decoration:none;">bqitech.com</a>
      </p>
    </div>
    """


def _wrap_stage_email(*, headline: str, intro: str, panel_title: str, panel_html: str, closing: str) -> str:
    return f"""
{_header_block()}
<div style="max-width:600px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:{BODY};">
  <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:{CYAN};">{{{{companyName}}}}</p>
  <h1 style="margin:0 0 16px;color:{NAVY};font-size:24px;font-weight:700;line-height:1.3;">{headline}</h1>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.7;">Hi {{{{candidateName}}}},</p>
  <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">{intro}</p>
  <div style="background:{LIGHT};border-left:4px solid {CYAN};border-radius:0 10px 10px 0;padding:20px 22px;margin:0 0 24px;">
    <h2 style="margin:0 0 12px;color:{NAVY};font-size:16px;font-weight:600;">{panel_title}</h2>
    {panel_html}
  </div>
  <p style="margin:0 0 8px;font-size:16px;line-height:1.7;">{closing}</p>
  <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:{MUTED};">
    - Recruiting team<br />{{{{companyName}}}}
  </p>
</div>
{_footer_block()}
""".strip()


def _seed_templates() -> list[dict[str, str]]:
    """Default pipeline-stage templates. Placeholders: candidateName, jobTitle, companyName."""
    return [
        {
            "stageKey": "new",
            "name": "New - Application received",
            "subject": "We received your application for {{jobTitle}}",
            "html": _wrap_stage_email(
                headline="Application received",
                intro=(
                    "Your application for <strong>{{jobTitle}}</strong> is in our system. "
                    "Our recruiting team will review it against the role requirements."
                ),
                panel_title="What happens next",
                panel_html="""
                <ul style="margin:0;padding-left:18px;color:#334155;line-height:1.8;font-size:15px;">
                  <li>We screen applications for this role in the order received</li>
                  <li>If your profile matches, you will hear from us about next steps</li>
                  <li>Keep an eye on this inbox (and spam) for messages from BQI Tech</li>
                </ul>
                """,
                closing="No action needed from you right now. Thank you for applying.",
            ),
        },
        {
            "stageKey": "shortlisted",
            "name": "Shortlisted - Moving forward",
            "subject": "You are shortlisted for {{jobTitle}}",
            "html": _wrap_stage_email(
                headline="You are on the shortlist",
                intro=(
                    "Your application for <strong>{{jobTitle}}</strong> stood out. "
                    "We have moved you to the shortlist and will share the next step shortly."
                ),
                panel_title="Shortlist details",
                panel_html="""
                <p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#334155;">
                  Role: <strong>{{jobTitle}}</strong><br />
                  Company: <strong>{{companyName}}</strong>
                </p>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#334155;">
                  Expect a follow-up about assessment or interview scheduling.
                </p>
                """,
                closing="Reply to this email if your availability or contact details have changed.",
            ),
        },
        {
            "stageKey": "technical-assessment",
            "name": "Technical Assessment - Instructions",
            "subject": "Technical assessment for {{jobTitle}}",
            "html": _wrap_stage_email(
                headline="Technical assessment",
                intro=(
                    "The next step for <strong>{{jobTitle}}</strong> is a technical assessment. "
                    "Complete it within the window we share so we can review your work fairly."
                ),
                panel_title="Assessment checklist",
                panel_html="""
                <ul style="margin:0;padding-left:18px;color:#334155;line-height:1.8;font-size:15px;">
                  <li>Use a quiet space and a stable internet connection</li>
                  <li>Follow the instructions in the assessment link (sent separately if needed)</li>
                  <li>Submit before the deadline - late submissions may not be scored</li>
                </ul>
                """,
                closing="Questions about the assessment? Reply to this email before you start.",
            ),
        },
        {
            "stageKey": "interviewing",
            "name": "Interviewing - Invitation",
            "subject": "Interview invitation - {{jobTitle}}",
            "html": _wrap_stage_email(
                headline="Interview invitation",
                intro=(
                    "We would like to interview you for <strong>{{jobTitle}}</strong>. "
                    "Please confirm the time that works, or propose two alternatives."
                ),
                panel_title="How to prepare",
                panel_html="""
                <ul style="margin:0;padding-left:18px;color:#334155;line-height:1.8;font-size:15px;">
                  <li>Review the job description and your recent work</li>
                  <li>Be ready to discuss projects relevant to {{jobTitle}}</li>
                  <li>Join a few minutes early if the interview is virtual</li>
                </ul>
                """,
                closing="We will send calendar details once you confirm. Looking forward to speaking with you.",
            ),
        },
        {
            "stageKey": "hired",
            "name": "Hired - Welcome aboard",
            "subject": "Welcome to {{companyName}} - {{jobTitle}}",
            "html": _wrap_stage_email(
                headline="Welcome to the team",
                intro=(
                    "Congratulations - we are offering you the <strong>{{jobTitle}}</strong> role "
                    "at <strong>{{companyName}}</strong>. We are glad to have you join us."
                ),
                panel_title="Onboarding next steps",
                panel_html="""
                <ul style="margin:0;padding-left:18px;color:#334155;line-height:1.8;font-size:15px;">
                  <li>Complete any paperwork or forms we send</li>
                  <li>Confirm your start date with People Ops</li>
                  <li>Watch for equipment and access setup instructions</li>
                </ul>
                """,
                closing="Reach out if anything in your offer packet needs clarifying. Welcome aboard.",
            ),
        },
        {
            "stageKey": "disqualified",
            "name": "Disqualified - Application update",
            "subject": "Update on your {{jobTitle}} application",
            "html": _wrap_stage_email(
                headline="Application update",
                intro=(
                    "Thank you for your interest in <strong>{{jobTitle}}</strong> at "
                    "<strong>{{companyName}}</strong>. After careful review, we are not moving "
                    "your application forward for this role."
                ),
                panel_title="What this means",
                panel_html="""
                <p style="margin:0;font-size:15px;line-height:1.7;color:#334155;">
                  This decision is specific to the current opening. You are welcome to apply
                  to other roles that match your experience.
                </p>
                """,
                closing="We appreciate the time you invested and wish you well in your search.",
            ),
        },
    ]


SEED_EMAIL_TEMPLATES = _seed_templates()


def format_email_template(doc: dict[str, Any]) -> dict[str, Any]:
    html = str(doc.get("html") or doc.get("body") or "")
    return {
        "id": str(doc.get("_id") or doc.get("id") or ""),
        "stageKey": str(doc.get("stageKey") or ""),
        "name": str(doc.get("name") or ""),
        "subject": str(doc.get("subject") or ""),
        "html": html,
        "body": html,
        "isDefault": bool(doc.get("isDefault", True)),
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
    }


def stage_key_from_label(label: str | None) -> str:
    """Normalize a pipeline stage label to the seed stageKey."""
    raw = (label or "").strip().lower()
    if not raw:
        return "new"
    if raw in ("rejected", "disqualified"):
        return "disqualified"
    return raw.replace(" ", "-")


async def ensure_email_templates_seed(db) -> dict[str, int]:
    """Insert missing pipeline email templates by stageKey. Never overwrites admin edits."""
    now = utc_now()
    inserted = 0
    skipped = 0

    for template in SEED_EMAIL_TEMPLATES:
        stage_key = template["stageKey"]
        existing = await db.email_templates.find_one({"stageKey": stage_key})
        if existing:
            skipped += 1
            continue
        await db.email_templates.insert_one(
            {
                "stageKey": stage_key,
                "name": template["name"],
                "subject": template["subject"],
                "html": template["html"],
                "body": template["html"],
                "isDefault": True,
                "createdAt": now,
                "updatedAt": now,
            }
        )
        inserted += 1

    # Unique index on stageKey (idempotent)
    try:
        await db.email_templates.create_index("stageKey", unique=True)
    except Exception:
        pass

    return {
        "inserted": inserted,
        "skipped": skipped,
        "total": await db.email_templates.count_documents({}),
    }
