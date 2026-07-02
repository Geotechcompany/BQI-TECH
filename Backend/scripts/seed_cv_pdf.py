"""Generate dummy CV PDFs and upload them to Dropbox for test seed data."""

from __future__ import annotations

import io
import logging
import os
import re
import sys
from datetime import datetime
from typing import Tuple

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import dropbox
from dropbox.exceptions import ApiError
from dropbox.files import WriteMode
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.lib.dropbox import get_dropbox_access_token

logger = logging.getLogger(__name__)

SEED_CV_FOLDER = "/uploads/seed"

SKILLS_BY_ROLE = {
    "Salesforce Developer": ["Apex", "Lightning Web Components", "SOQL", "Flows", "Integration"],
    "Full Stack Engineer": ["React", "TypeScript", "Python", "FastAPI", "PostgreSQL"],
    "DevOps Specialist": ["Docker", "Kubernetes", "CI/CD", "Terraform", "AWS"],
}

EXPERIENCE_TEMPLATES = [
    "Led delivery of cloud-based solutions for public sector clients.",
    "Built REST APIs and integrated third-party services in agile teams.",
    "Improved deployment pipelines and monitoring for production workloads.",
]


def _safe_filename(name: str) -> str:
    base = re.sub(r"[^\w\-]+", "_", name.strip())
    return f"{base}_Resume.pdf"


def build_cv_pdf_bytes(
    *,
    name: str,
    email: str,
    position: str,
    phone: str = "+254 700 000 000",
) -> bytes:
    """Create a one-page dummy CV PDF in memory."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CvTitle",
        parent=styles["Title"],
        fontSize=20,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6,
    )
    heading_style = ParagraphStyle(
        "CvHeading",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=colors.HexColor("#1e40af"),
        spaceBefore=10,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "CvBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155"),
    )

    skills = SKILLS_BY_ROLE.get(position, ["Communication", "Problem solving", "Teamwork"])
    story = [
        Paragraph(name, title_style),
        Paragraph(f"{email} | {phone} | Nairobi, Kenya", body_style),
        Spacer(1, 8),
        Paragraph("Professional Summary", heading_style),
        Paragraph(
            f"Experienced technology professional applying for the {position} role. "
            "This document was generated for the BQI Tech test environment.",
            body_style,
        ),
        Paragraph("Core Skills", heading_style),
        Paragraph(", ".join(skills), body_style),
        Paragraph("Experience", heading_style),
    ]

    for index, line in enumerate(EXPERIENCE_TEMPLATES, start=1):
        story.append(
            Paragraph(
                f"<b>Senior Consultant — BQI Demo Client {index}</b><br/>"
                f"202{index} – Present<br/>{line}",
                body_style,
            )
        )
        story.append(Spacer(1, 6))

    story.extend(
        [
            Paragraph("Education", heading_style),
            Paragraph(
                "<b>BSc Computer Science</b><br/>University of Nairobi — 2018",
                body_style,
            ),
            Spacer(1, 12),
            Paragraph(
                f"<i>Generated on {datetime.utcnow().strftime('%Y-%m-%d')} — test seed data only.</i>",
                body_style,
            ),
        ]
    )

    doc.build(story)
    return buffer.getvalue()


async def upload_cv_pdf_to_dropbox(
    pdf_bytes: bytes,
    file_name: str,
    *,
    folder: str = SEED_CV_FOLDER,
) -> Tuple[str, str, int]:
    """Upload a CV PDF to Dropbox and return (download_url, dropbox_path, size)."""
    dropbox_path = f"{folder.rstrip('/')}/{file_name}"
    access_token = await get_dropbox_access_token()
    dbx = dropbox.Dropbox(access_token)

    dbx.files_upload(pdf_bytes, dropbox_path, mode=WriteMode.overwrite)

    try:
        shared_link = dbx.sharing_create_shared_link_with_settings(
            dropbox_path,
            settings=dropbox.sharing.SharedLinkSettings(
                requested_visibility=dropbox.sharing.RequestedVisibility.public
            ),
        )
        download_url = shared_link.url.replace("www.dropbox.com", "dl.dropboxusercontent.com")
    except ApiError as error:
        if error.error.is_shared_link_already_exists():
            links = dbx.sharing_list_shared_links(path=dropbox_path).links
            if not links:
                raise
            download_url = links[0].url.replace("www.dropbox.com", "dl.dropboxusercontent.com")
        else:
            raise

    if "?dl=0" in download_url:
        download_url = download_url.replace("?dl=0", "?dl=1")

    return download_url, dropbox_path, len(pdf_bytes)


def save_cv_pdf_locally(pdf_bytes: bytes, file_name: str, output_dir: str) -> str:
    """Persist a copy under scripts/seed_assets/cvs for local inspection."""
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, file_name)
    with open(path, "wb") as handle:
        handle.write(pdf_bytes)
    return path
