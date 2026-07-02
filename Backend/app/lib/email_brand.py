"""BQI Tech brand tokens and HTML fragments for transactional emails."""

from __future__ import annotations

import html as html_module
from datetime import datetime

from app.config import settings
from app.lib.runtime_environment import get_frontend_url

BQI_BRAND = {
    "dark_blue": "#272055",
    "cyan": "#31CDFF",
    "accent_blue": "#2563EB",
    "admin_bg": "#2B2B2B",
    "admin_surface": "#363636",
    "admin_text": "#FFFFFF",
    "admin_muted": "#D1D5DB",
    "admin_accent": "#94A3FF",
    "body_text": "#334155",
    "muted_text": "#64748B",
    "light_bg": "#F8FAFC",
    "border": "#E2E8F0",
}


def _frontend_url() -> str:
    return get_frontend_url()


def _logo_url(light: bool = False) -> str:
    filename = "bqilogo.png" if light else "bqilogo-light.png"
    return f"{_frontend_url()}/{filename}"


def escape_email_text(value: str) -> str:
    return html_module.escape(str(value or ""))


def branded_email_header_html() -> str:
    """Gradient header for public-facing emails."""
    logo_url = _logo_url(light=False)
    return f"""
    <tr>
      <td style="background: linear-gradient(135deg, {BQI_BRAND['dark_blue']} 0%, {BQI_BRAND['cyan']} 100%); padding: 32px 40px; text-align: center;">
        <img src="{logo_url}" alt="BQI Tech" width="160" style="width: 160px; max-width: 100%; height: auto; display: block; margin: 0 auto 12px;" />
        <div style="color: rgba(255,255,255,0.9); font-size: 13px; letter-spacing: 0.04em;">bqitech.com</div>
      </td>
    </tr>
  """


def admin_email_header_html() -> str:
    """Dark admin header with logo and workspace label."""
    logo_url = _logo_url(light=False)
    return f"""
    <tr>
      <td style="background: {BQI_BRAND['admin_bg']}; padding: 36px 40px 24px; text-align: center; border-bottom: 1px solid rgba(148,163,255,0.15);">
        <img src="{logo_url}" alt="BQI Tech" width="150" style="width: 150px; max-width: 100%; height: auto; display: block; margin: 0 auto 10px;" />
        <div style="margin-top: 6px; font-size: 11px; color: {BQI_BRAND['admin_muted']}; letter-spacing: 0.1em; text-transform: uppercase;">
          Admin Workspace
        </div>
      </td>
    </tr>
    """


def branded_email_footer_html() -> str:
    base = _frontend_url()
    year = datetime.utcnow().year
    logo_url = _logo_url(light=False)
    hr_email = escape_email_text(settings.hr_email)

    return f"""
    <tr>
      <td style="padding: 24px 40px 32px; background: {BQI_BRAND['light_bg']}; border-top: 3px solid {BQI_BRAND['cyan']}; text-align: center;">
        <img src="{logo_url}" alt="BQI Tech" width="100" style="width: 100px; height: auto; opacity: 0.85; margin-bottom: 16px;" />
        <p style="margin: 0 0 8px; color: {BQI_BRAND['body_text']}; font-size: 14px; line-height: 1.6;">
          <strong>BQI Technologies</strong><br />
          Empowering businesses through innovative technology solutions
        </p>
        <p style="margin: 0 0 12px; color: {BQI_BRAND['muted_text']}; font-size: 12px;">
          Visit us at <a href="https://bqitech.com" style="color: {BQI_BRAND['cyan']}; text-decoration: none;">bqitech.com</a>
        </p>
        <p style="margin: 0; color: {BQI_BRAND['muted_text']}; font-size: 12px;">
          © {year} BQI Tech. All rights reserved.
          &nbsp;•&nbsp;
          <a href="{base}/privacy" style="color: {BQI_BRAND['cyan']}; text-decoration: none;">Privacy</a>
          &nbsp;•&nbsp;
          <a href="{base}/terms" style="color: {BQI_BRAND['cyan']}; text-decoration: none;">Terms</a>
        </p>
        <p style="margin: 12px 0 0; color: {BQI_BRAND['muted_text']}; font-size: 12px;">
          Questions? Contact us at <a href="mailto:{hr_email}" style="color: {BQI_BRAND['cyan']}; text-decoration: none;">{hr_email}</a>
        </p>
      </td>
    </tr>
    """


def admin_email_footer_html() -> str:
    year = datetime.utcnow().year
    hr_email = escape_email_text(settings.hr_email)

    return f"""
    <tr>
      <td style="padding: 20px 40px 28px; background: {BQI_BRAND['admin_surface']}; border-top: 1px solid rgba(148,163,255,0.12);">
        <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #9CA3AF; text-align: center;">
          If you were not expecting this email, you can ignore it or contact
          <a href="mailto:{hr_email}" style="color: {BQI_BRAND['admin_accent']}; text-decoration: underline;">{hr_email}</a>.
        </p>
        <p style="margin: 10px 0 0; font-size: 11px; line-height: 1.5; color: #6B7280; text-align: center;">
          © {year} BQI Tech. All rights reserved.
        </p>
      </td>
    </tr>
    """


def primary_button_html(label: str, href: str, accent: str | None = None) -> str:
    safe_label = escape_email_text(label)
    safe_href = escape_email_text(href)
    color = accent or BQI_BRAND["cyan"]
    return f"""
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px auto 0; border-collapse: collapse;">
      <tr>
        <td align="center" style="border-radius: 10px; background: {color};">
          <a href="{safe_href}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">
            {safe_label}
          </a>
        </td>
      </tr>
    </table>
    """


def environment_email_styles(environment: str) -> dict[str, str]:
    env = (environment or "development").lower()
    if env == "staging":
        return {
            "badge_bg": "rgba(251,191,36,0.15)",
            "badge_text": "#FCD34D",
            "badge_border": "rgba(252,211,77,0.5)",
            "accent": "#F59E0B",
            "notice_bg": "rgba(75,85,99,0.35)",
            "notice_border": "rgba(252,211,77,0.35)",
            "notice_text": "#FDE68A",
        }
    if env == "production":
        return {
            "badge_bg": "rgba(16,185,129,0.15)",
            "badge_text": "#6EE7B7",
            "badge_border": "rgba(110,231,183,0.45)",
            "accent": "#10B981",
            "notice_bg": "rgba(75,85,99,0.35)",
            "notice_border": "rgba(110,231,183,0.35)",
            "notice_text": "#D1FAE5",
        }
    return {
        "badge_bg": "rgba(148,163,255,0.12)",
        "badge_text": BQI_BRAND["admin_accent"],
        "badge_border": "rgba(148,163,255,0.45)",
        "accent": BQI_BRAND["accent_blue"],
        "notice_bg": "rgba(75,85,99,0.35)",
        "notice_border": "rgba(148,163,255,0.35)",
        "notice_text": BQI_BRAND["admin_muted"],
    }


def environment_notice_html(
    environment_label: str,
    database_name: str,
    environment: str,
) -> str:
    styles = environment_email_styles(environment)
    label = escape_email_text(environment_label)
    db_name = escape_email_text(database_name)
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; border-collapse: collapse;">
      <tr>
        <td style="padding: 14px 16px; background: {styles['notice_bg']}; border: 1px solid {styles['notice_border']}; border-radius: 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr>
              <td style="padding-bottom: 8px;">
                <span style="display: inline-block; padding: 4px 10px; background: {styles['badge_bg']}; color: {styles['badge_text']}; border: 1px solid {styles['badge_border']}; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;">
                  {label} environment
                </span>
              </td>
            </tr>
            <tr>
              <td style="font-size: 14px; line-height: 1.6; color: {styles['notice_text']};">
                This invitation applies to the <strong style="color: {BQI_BRAND['admin_text']};">{label}</strong> workspace.
                Active database: <strong style="color: {BQI_BRAND['admin_text']};">{db_name}</strong>.
                Please confirm you are signing in to the correct environment before accepting.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    """


def module_chips_html(module_labels: list[str]) -> str:
    if not module_labels:
        return ""
    chips = "".join(
        f'<span style="display:inline-block;margin:0 8px 8px 0;padding:6px 12px;background:rgba(148,163,255,0.1);border:1px solid rgba(148,163,255,0.25);border-radius:999px;font-size:12px;font-weight:500;color:{BQI_BRAND["admin_muted"]};">{escape_email_text(label)}</span>'
        for label in module_labels
    )
    return f"""
    <div style="margin: 20px 0 8px;">
      <p style="margin: 0 0 10px; font-size: 13px; font-weight: 600; color: {BQI_BRAND['admin_muted']}; text-transform: uppercase; letter-spacing: 0.06em;">
        Module access
      </p>
      <div>{chips}</div>
    </div>
    """


def wrap_branded_email(
    *,
    header: str,
    footer: str,
    content: str,
    accent_color: str | None = None,
    outer_bg: str | None = None,
    card_bg: str = "#FFFFFF",
    preheader: str = "",
) -> str:
    accent = accent_color or BQI_BRAND["cyan"]
    background = outer_bg or BQI_BRAND["light_bg"]
    preheader_html = (
        f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{escape_email_text(preheader)}</div>'
        if preheader
        else ""
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BQI Tech</title>
</head>
<body style="margin:0;padding:0;background:{background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  {preheader_html}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{background};padding:40px 16px;border-collapse:collapse;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:{card_bg};border:1px solid {BQI_BRAND['border']};border-radius:16px;overflow:hidden;border-collapse:collapse;box-shadow:0 10px 30px rgba(39,32,85,0.08);">
          <tr>
            <td style="height:4px;background:{accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          {header}
          <tr>
            <td style="padding:36px 40px 28px;">
              {content}
            </td>
          </tr>
          {footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def wrap_admin_email(
    *,
    content: str,
    accent_color: str | None = None,
    preheader: str = "",
) -> str:
    accent = accent_color or BQI_BRAND["accent_blue"]
    return wrap_branded_email(
        header=admin_email_header_html(),
        footer=admin_email_footer_html(),
        content=content,
        accent_color=accent,
        outer_bg="#1A1A1A",
        card_bg=BQI_BRAND["admin_bg"],
        preheader=preheader,
    )


def wrap_public_email(*, content: str, preheader: str = "") -> str:
    return wrap_branded_email(
        header=branded_email_header_html(),
        footer=branded_email_footer_html(),
        content=content,
        accent_color=BQI_BRAND["cyan"],
        preheader=preheader,
    )
