"""
Import blog posts from backups/Website blogs/Website Bogs into MongoDB (blogposts).

Extracts title, HTML content (with inline images), featured image, and author name.
Uploads embedded .docx images to Dropbox (same storage as the admin uploader).
"""

from __future__ import annotations

import argparse
import asyncio
import html
import os
import re
import sys
import uuid
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from xml.etree import ElementTree as ET

import dns.resolver
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pypdf import PdfReader

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent
BACKUP_DIR = PROJECT_ROOT / "backups" / "Website blogs" / "Website Bogs"

BOM = "\ufeff"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
EMBED_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORD_NS, "r": EMBED_NS, "rel": REL_NS}


@dataclass
class ContentBlock:
    kind: Literal["heading", "paragraph", "list_item", "image"]
    text: str = ""
    embed_id: str = ""
    level: int = 2  # heading level: 2 = h2, 3 = h3


@dataclass
class ParsedPost:
    title: str
    slug: str
    filename_hint: str
    content: str
    excerpt: str
    category: str
    read_time: str
    author: str
    image_url: str
    plain_paragraphs: list[str] = field(default_factory=list)
    image_count: int = 0
    source_file: str = ""


def generate_slug(title: str) -> str:
    slug = title.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug.strip("-")[:100]


def clean_text(text: str) -> str:
    text = text.replace(BOM, "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_filename(path: Path) -> tuple[str, str]:
    stem = path.stem
    if " - " in stem:
        title_hint, author = stem.rsplit(" - ", 1)
    else:
        title_hint, author = stem, ""
    title_hint = re.sub(r"\bblog\b", "", title_hint, flags=re.IGNORECASE).strip()
    return title_hint, author.strip()


def normalize_media_target(target: str) -> str:
    target = target.lstrip("/")
    if target.startswith("media/") and not target.startswith("word/"):
        return target
    if target.startswith("word/"):
        return target
    return f"word/{target}"


def build_relationship_map(archive: zipfile.ZipFile) -> dict[str, str]:
    rels_path = "word/_rels/document.xml.rels"
    if rels_path not in archive.namelist():
        return {}
    root = ET.fromstring(archive.read(rels_path))
    mapping: dict[str, str] = {}
    for rel in root.findall("rel:Relationship", NS):
        rel_id = rel.get("Id")
        target = rel.get("Target")
        if rel_id and target:
            mapping[rel_id] = normalize_media_target(target)
    return mapping


def read_media_bytes(archive: zipfile.ZipFile, target: str) -> bytes | None:
    candidates = [
        target,
        target.lstrip("/"),
        f"word/{target.lstrip('/')}",
    ]
    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        if candidate in archive.namelist():
            return archive.read(candidate)
    return None


def media_extension(target: str) -> str:
    ext = Path(target).suffix.lower().lstrip(".")
    return ext if ext in {"jpg", "jpeg", "png", "gif", "webp"} else "jpg"


def get_paragraph_style(element: ET.Element) -> str:
    p_pr = element.find("w:pPr", NS)
    if p_pr is None:
        return ""
    p_style = p_pr.find("w:pStyle", NS)
    if p_style is None:
        return ""
    return p_style.get(f"{{{WORD_NS}}}val", "") or ""


def paragraph_is_list(element: ET.Element) -> bool:
    p_pr = element.find("w:pPr", NS)
    if p_pr is None:
        return False
    return p_pr.find("w:numPr", NS) is not None


def extract_embed_ids(element: ET.Element) -> list[str]:
    embeds: list[str] = []
    for node in element.iter():
        if node.tag.split("}")[-1] == "blip":
            embed_id = node.get(f"{{{EMBED_NS}}}embed")
            if embed_id:
                embeds.append(embed_id)
    return embeds


def extract_runs(element: ET.Element) -> list[tuple[str, bool]]:
    runs: list[tuple[str, bool]] = []
    for run in element.findall("w:r", NS):
        run_text_nodes = run.findall("w:t", NS)
        if not run_text_nodes:
            continue
        text = "".join(node.text or "" for node in run_text_nodes)
        if not text:
            continue
        r_pr = run.find("w:rPr", NS)
        is_bold = r_pr is not None and r_pr.find("w:b", NS) is not None
        runs.append((text, is_bold))
    return runs


COMPOUND_WORD_PREFIXES = (
    "Service",
    "Gov",
    "Net",
    "Sales",
    "U.",
    "Multi",
    "Auto",
)


def join_run_fragments(fragments: list[str]) -> str:
    if not fragments:
        return ""
    result = [fragments[0]]
    for frag in fragments[1:]:
        if not frag:
            continue
        prev = result[-1]
        if (
            prev
            and not prev.endswith((" ", "-", "—", "\n"))
            and not frag.startswith((" ", ",", ".", ";", ":", "'", '"', ")", "]"))
        ):
            compound = any(prev.endswith(prefix) for prefix in COMPOUND_WORD_PREFIXES)
            if prev[-1].isalnum() and frag[0].isalnum() and not compound:
                if prev[-1].islower() and frag[0].isupper():
                    result.append(" ")
                elif prev[-1].isupper() and frag[0].islower():
                    result.append(" ")
        result.append(frag)
    return "".join(result)


def fix_mashed_spacing(text: str) -> str:
    # Only split long lowercase endings fused to the next word (e.g. "TransformationAcross").
    text = re.sub(r"([a-z]{4,})([A-Z][a-z])", r"\1 \2", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def fix_sentence_spacing(text: str) -> str:
    text = fix_mashed_spacing(text)
    # Add a space after sentence-ending punctuation only (preserves U.S., .NET, etc.).
    text = re.sub(r"([a-z])\.([A-Z])", r"\1. \2", text)
    text = re.sub(r"([a-z])\?([A-Z])", r"\1? \2", text)
    text = re.sub(r"([a-z])!([A-Z])", r"\1! \2", text)
    return text


def is_heading_text(text: str, bold: bool = False) -> bool:
    candidate = text.strip().rstrip(":")
    if not candidate or len(candidate) > 120:
        return False
    if re.match(r"^(and|or|of|in|to|for|as)\s", candidate, flags=re.IGNORECASE):
        return False
    if candidate.lower().startswith(("govtech and", "enterprise digital", "digital transformation")):
        return False
    lower = candidate.lower()
    if lower.startswith("read more:"):
        return False
    if lower in {"introduction", "conclusion"}:
        return True
    if len(candidate) > 90 and ("," in candidate or candidate.count(".") > 1):
        return False
    if candidate.endswith(".") and len(candidate) > 70:
        return False
    if bold and not candidate.endswith(".") and len(candidate) < 100:
        return True
    if re.match(
        r"^(Why|What|How|When|Where|Conclusion|Introduction|Thought-|The Shift|The Role|The Future)",
        candidate,
    ):
        return True
    words = [word for word in candidate.split() if word]
    if 2 <= len(words) <= 14 and not candidate.endswith("."):
        capitalized = sum(1 for word in words if word[0].isupper())
        if capitalized >= len(words) * 0.6:
            return True
    return False


def split_runs_into_segments(runs: list[tuple[str, bool]]) -> list[tuple[str, str]]:
    segments: list[tuple[str, str]] = []
    buffer: list[str] = []

    def flush_paragraph() -> None:
        if not buffer:
            return
        paragraph = fix_sentence_spacing(clean_text(join_run_fragments(buffer)))
        buffer.clear()
        if paragraph:
            segments.append(("paragraph", paragraph))

    for text, bold in runs:
        if not text or not text.strip():
            continue
        stripped = text.strip()
        if stripped.startswith("•") or stripped.startswith("·"):
            flush_paragraph()
            item = stripped.lstrip("•·").strip()
            if item:
                segments.append(("list_item", item))
            continue
        if is_heading_text(stripped, bold):
            flush_paragraph()
            segments.append(("heading", stripped.rstrip(":").strip()))
            continue
        buffer.append(text)

    flush_paragraph()
    return segments


def split_mashed_paragraph(text: str) -> list[tuple[str, str]]:
    text = fix_mashed_spacing(text)
    segments: list[tuple[str, str]] = []

    if "•" in text:
        parts = re.split(r"\s*•\s*", text)
        lead = parts[0].strip()
        if lead:
            segments.extend(split_mashed_paragraph(lead))
        for part in parts[1:]:
            part = part.strip()
            if not part:
                continue
            sub = split_mashed_paragraph(part)
            if sub and sub[0][0] == "paragraph" and is_heading_text(sub[0][1]):
                segments.append(sub[0])
                if len(sub) > 1:
                    segments.extend(split_mashed_paragraph(" ".join(s[1] for s in sub[1:])))
            else:
                segments.append(("list_item", part))
        return segments

    chunks = re.split(
        r"(?<=[.!?])\s+(?=(?:The |Why |What |How |When |Where |Conclusion|Introduction|Thought-)[A-Z])",
        text,
    )
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        if is_heading_text(chunk):
            segments.append(("heading", chunk.rstrip(":").strip()))
        else:
            segments.append(("paragraph", chunk))
    return segments


def segments_to_blocks(segments: list[tuple[str, str]], style: str) -> list[ContentBlock]:
    blocks: list[ContentBlock] = []
    style_level = {"Heading1": 2, "Heading2": 2, "Heading3": 3, "Title": 1}

    if style in style_level and len(segments) == 1 and segments[0][0] == "paragraph":
        level = style_level[style]
        blocks.append(
            ContentBlock(kind="heading", text=segments[0][1], level=level)
        )
        return blocks

    for seg_type, text in segments:
        if seg_type == "heading":
            level = 3 if text.lower().startswith("thought-") else 2
            blocks.append(ContentBlock(kind="heading", text=text, level=level))
        elif seg_type == "list_item":
            blocks.append(ContentBlock(kind="list_item", text=text))
        elif text:
            blocks.append(ContentBlock(kind="paragraph", text=text))
    return blocks


def paragraph_blocks(element: ET.Element) -> list[ContentBlock]:
    style = get_paragraph_style(element)
    runs = extract_runs(element)
    embeds = extract_embed_ids(element)
    blocks: list[ContentBlock] = []

    if not runs and not embeds:
        return blocks

    if style in {"Heading1", "Heading2", "Heading3", "Title"}:
        heading_text = fix_sentence_spacing(
            clean_text(join_run_fragments([text for text, _ in runs]))
        )
        if heading_text:
            level = {"Heading3": 3, "Title": 1}.get(style, 2)
            blocks.append(ContentBlock(kind="heading", text=heading_text, level=level))
        for embed_id in embeds:
            blocks.append(ContentBlock(kind="image", embed_id=embed_id))
        return blocks
    else:
        full_text = fix_sentence_spacing(
            clean_text(join_run_fragments([text for text, _ in runs]))
        )
        if (
            full_text
            and len(full_text) < 170
            and full_text.count(".") <= 1
            and (":" in full_text or "?" in full_text)
        ):
            segments = [("paragraph", full_text)]
        else:
            segments = split_runs_into_segments(runs)
            if len(segments) <= 1 and runs:
                if len(full_text) > 350:
                    segments = split_mashed_paragraph(full_text)
                elif full_text:
                    segments = [("paragraph", full_text)]
        blocks.extend(segments_to_blocks(segments, style))

    for embed_id in embeds:
        blocks.append(ContentBlock(kind="image", embed_id=embed_id))
    return blocks


def parse_docx_blocks(path: Path) -> tuple[list[ContentBlock], dict[str, str]]:
    blocks: list[ContentBlock] = []
    media_targets: dict[str, str] = {}

    with zipfile.ZipFile(path) as archive:
        rel_map = build_relationship_map(archive)
        document = ET.fromstring(archive.read("word/document.xml"))
        body = document.find("w:body", NS)
        if body is None:
            return blocks, media_targets

        for child in list(body):
            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
            if tag == "p":
                blocks.extend(paragraph_blocks(child))
            elif tag == "tbl":
                for paragraph in child.findall(".//w:p", NS):
                    blocks.extend(paragraph_blocks(paragraph))

        for embed_id, target in rel_map.items():
            if re.search(r"\.(png|jpe?g|gif|webp)$", target, re.IGNORECASE):
                media_targets[embed_id] = target

    return blocks, media_targets


def pick_title(filename_hint: str, text_blocks: list[str]) -> tuple[str, list[str]]:
    body = list(text_blocks)
    while body and re.match(r"^by\s+", body[0], flags=re.IGNORECASE):
        body.pop(0)

    if not body:
        return filename_hint, body

    first = body[0].strip()
    first = re.sub(r"\s+by\s+[\w\s.'-]+$", "", first, flags=re.IGNORECASE).strip()

    if len(body) > 1:
        second = body[1].strip()
        title_continuation = re.match(
            r"^(GovTech\b|and Enterprise\b|Enterprise Digital\b|"
            r"for Global Reach\b|Public Sector Work\b)",
            second,
            flags=re.IGNORECASE,
        )
        if (
            len(first) < 110
            and not first.endswith(".")
            and len(second) < 70
            and title_continuation
        ):
            merged = f"{first} {second}".strip()
            if len(merged) < 170:
                return merged.rstrip("."), body[2:]

    # Prefer the document's full title line when it clearly extends the filename hint.
    if len(first) > len(filename_hint) + 10 and first.lower().startswith(
        filename_hint.lower()[: min(20, len(filename_hint))]
    ):
        return first.rstrip("."), body[1:]

    headline = (
        len(first) <= 200
        and first.lower() not in {"introduction", "intro"}
        and (
            len(first) > len(filename_hint)
            or ":" in first
            or "?" in first
            or first.lower().startswith(filename_hint.lower())
        )
    )
    if headline:
        return first.rstrip("."), body[1:]

    return filename_hint, body


def image_to_html(url: str, alt: str) -> str:
    safe_url = html.escape(url, quote=True)
    safe_alt = html.escape(alt)
    return (
        f'<figure class="my-8">'
        f'<img src="{safe_url}" alt="{safe_alt}" '
        f'class="w-full rounded-2xl object-cover" loading="lazy" />'
        f"</figure>"
    )


def infer_category(title: str, paragraphs: list[str]) -> str:
    haystack = f"{title} {' '.join(paragraphs[:6])}".lower()
    if any(
        k in haystack
        for k in ("data analytics", "business decision", "business decisions")
    ):
        return "Business"
    if any(
        k in haystack
        for k in ("govtech", "government", "public sector", "agency", "legacy system")
    ):
        return "GovTech"
    if any(
        k in haystack
        for k in (".net", "software", "knowledge sharing", "engineering team")
    ):
        return "Technology"
    if "ai" in haystack or "artificial intelligence" in haystack:
        return "Technology"
    return "Technology"


def estimate_read_time(paragraphs: list[str]) -> str:
    words = sum(len(p.split()) for p in paragraphs)
    minutes = max(1, round(words / 200))
    return f"{minutes} min Read"


def make_excerpt(paragraphs: list[str], max_len: int = 280) -> str:
    plain = " ".join(paragraphs)
    plain = re.sub(r"\s+", " ", plain).strip()
    if len(plain) <= max_len:
        return plain
    trimmed = plain[: max_len - 3].rsplit(" ", 1)[0]
    return f"{trimmed}..."


class DropboxImageUploader:
    def __init__(self) -> None:
        self._cache: dict[str, str] = {}
        self._client = None

    async def _get_client(self):
        if self._client is not None:
            return self._client
        sys.path.insert(0, str(BACKEND_DIR))
        from app.lib.dropbox import get_dropbox_access_token
        import dropbox

        token = await get_dropbox_access_token()
        self._client = dropbox.Dropbox(token)
        return self._client

    async def upload(self, data: bytes, extension: str) -> str:
        import dropbox as dropbox_sdk
        from dropbox.exceptions import ApiError
        from dropbox.files import WriteMode

        dbx = await self._get_client()
        unique_name = f"{uuid.uuid4()}.{extension}"
        dropbox_path = f"/uploads/blog-sync/{unique_name}"

        dbx.files_upload(data, dropbox_path, mode=WriteMode.overwrite)
        try:
            shared = dbx.sharing_create_shared_link_with_settings(
                dropbox_path,
                settings=dropbox_sdk.sharing.SharedLinkSettings(
                    requested_visibility=dropbox_sdk.sharing.RequestedVisibility.public
                ),
            )
            url = shared.url
        except ApiError as error:
            if error.error.is_shared_link_already_exists():
                links = dbx.sharing_list_shared_links(dropbox_path).links
                if not links:
                    raise
                url = links[0].url
            else:
                raise
        return url.replace("www.dropbox.com", "dl.dropboxusercontent.com")


async def upload_docx_images(
    path: Path,
    media_targets: dict[str, str],
    uploader: DropboxImageUploader | None,
) -> dict[str, str]:
    urls: dict[str, str] = {}
    if not media_targets:
        return urls

    with zipfile.ZipFile(path) as archive:
        for embed_id, target in media_targets.items():
            cache_key = f"{path.name}:{target}"
            if cache_key in urls:
                continue
            media_bytes = read_media_bytes(archive, target)
            if not media_bytes:
                print(f"  warning: could not read media {target} from {path.name}")
                continue
            if uploader is None:
                urls[embed_id] = f"dry-run://{target}"
                continue
            ext = media_extension(target)
            urls[embed_id] = await uploader.upload(media_bytes, ext)

    return urls


def block_plain_text(block: ContentBlock) -> str:
    return block.text.strip()


def should_skip_block(block: ContentBlock, title: str, skipped_title: bool) -> bool:
    if block.kind not in {"heading", "paragraph"}:
        return False
    if not skipped_title:
        return False
    return block.text.strip().lower() == title.strip().lower()


def render_content_block(block: ContentBlock) -> str:
    text = html.escape(block.text)
    lower = block.text.lower()
    if block.kind == "heading":
        tag = "h3" if block.level == 3 else "h2"
        return f"<{tag}>{text}</{tag}>"
    if block.kind == "list_item":
        return f"<li>{text}</li>"
    if lower.startswith("thought-leadership"):
        return f"<p><strong>{text}</strong></p>"
    if lower.startswith("read more:"):
        return f"<p><em>{text}</em></p>"
    return f"<p>{text}</p>"


def build_html_from_blocks(
    blocks: list[ContentBlock],
    image_urls: dict[str, str],
    *,
    title: str,
    skip_title: bool,
) -> tuple[str, list[str], str]:
    html_parts: list[str] = []
    plain_paragraphs: list[str] = []
    featured_image = ""
    skipped_title = skip_title
    in_list = False

    for block in blocks:
        if should_skip_block(block, title, skipped_title):
            skipped_title = False
            continue
        if skipped_title and block.kind in {"heading", "paragraph"}:
            skipped_title = False

        if block.kind == "list_item":
            if not in_list:
                html_parts.append("<ul>")
                in_list = True
            plain_paragraphs.append(block.text)
            html_parts.append(render_content_block(block))
            continue

        if in_list:
            html_parts.append("</ul>")
            in_list = False

        if block.kind == "heading":
            # h1-level blocks are post titles; rendered on the page header already.
            if block.level == 1:
                continue
            plain_paragraphs.append(block.text)
            html_parts.append(render_content_block(block))
        elif block.kind == "paragraph":
            if block.text.strip().lower() == title.strip().lower():
                continue
            plain_paragraphs.append(block.text)
            html_parts.append(render_content_block(block))
        elif block.kind == "image":
            url = image_urls.get(block.embed_id)
            if not url or url.startswith("dry-run://"):
                continue
            if not featured_image:
                featured_image = url
            html_parts.append(image_to_html(url, title))

    if in_list:
        html_parts.append("</ul>")

    return "".join(html_parts), plain_paragraphs, featured_image


def structure_plain_paragraphs(paragraphs: list[str]) -> list[ContentBlock]:
    blocks: list[ContentBlock] = []
    for paragraph in paragraphs:
        paragraph = fix_mashed_spacing(paragraph)
        if not paragraph:
            continue
        if paragraph.startswith("•") or paragraph.startswith("·"):
            blocks.append(
                ContentBlock(
                    kind="list_item",
                    text=paragraph.lstrip("•·").strip(),
                )
            )
            continue
        if is_heading_text(paragraph):
            blocks.append(ContentBlock(kind="heading", text=paragraph.rstrip(":"), level=2))
            continue
        if len(paragraph) > 350:
            for seg_type, text in split_mashed_paragraph(paragraph):
                if seg_type == "heading":
                    blocks.append(ContentBlock(kind="heading", text=text, level=2))
                elif seg_type == "list_item":
                    blocks.append(ContentBlock(kind="list_item", text=text))
                else:
                    blocks.append(ContentBlock(kind="paragraph", text=text))
        else:
            blocks.append(ContentBlock(kind="paragraph", text=paragraph))
    return blocks


def extract_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    pages = [page.extract_text() or "" for page in reader.pages]
    return clean_text("\n".join(pages))


def split_paragraphs(text: str) -> list[str]:
    lines = [line.strip() for line in text.split("\n")]
    paragraphs: list[str] = []
    buffer: list[str] = []
    for line in lines:
        if not line:
            if buffer:
                paragraphs.append(" ".join(buffer))
                buffer = []
            continue
        buffer.append(line)
    if buffer:
        paragraphs.append(" ".join(buffer))
    return [p for p in paragraphs if p]


async def parse_docx_file(
    path: Path,
    uploader: DropboxImageUploader | None,
) -> ParsedPost:
    filename_hint, author = parse_filename(path)
    blocks, media_targets = parse_docx_blocks(path)
    image_urls = await upload_docx_images(path, media_targets, uploader)

    text_blocks = [
        b.text
        for b in blocks
        if b.kind in {"heading", "paragraph", "list_item"} and b.text
    ]
    title, body_text_blocks = pick_title(filename_hint, text_blocks)

    # Drop duplicate title block when it was promoted to the post title
    filtered_blocks: list[ContentBlock] = []
    dropped_title = False
    for block in blocks:
        if block.kind == "heading" and block.level == 1:
            dropped_title = True
            continue
        if (
            not dropped_title
            and block.kind in {"heading", "paragraph"}
            and block.text.strip().lower() == title.strip().lower()
        ):
            dropped_title = True
            continue
        filtered_blocks.append(block)

    content, plain_paragraphs, featured_image = build_html_from_blocks(
        filtered_blocks,
        image_urls,
        title=title,
        skip_title=not dropped_title,
    )

    if not plain_paragraphs:
        plain_paragraphs = body_text_blocks

    return ParsedPost(
        title=title,
        slug=generate_slug(title),
        filename_hint=filename_hint,
        content=content,
        excerpt=make_excerpt(plain_paragraphs or text_blocks),
        category=infer_category(title, plain_paragraphs or text_blocks),
        read_time=estimate_read_time(plain_paragraphs or text_blocks),
        author=author,
        image_url=featured_image,
        plain_paragraphs=plain_paragraphs,
        image_count=len(image_urls),
        source_file=path.name,
    )


def parse_pdf_file(path: Path) -> ParsedPost:
    filename_hint, author = parse_filename(path)
    raw = extract_pdf(path)
    paragraphs = split_paragraphs(raw)
    title, body_paragraphs = pick_title(filename_hint, paragraphs)

    if not body_paragraphs and len(paragraphs) > 1:
        title, body_paragraphs = paragraphs[0], paragraphs[1:]
    if not body_paragraphs:
        body_paragraphs = paragraphs[1:] if len(paragraphs) > 1 else paragraphs

    structured = structure_plain_paragraphs(body_paragraphs)
    content, plain_from_html, _ = build_html_from_blocks(
        structured,
        {},
        title=title,
        skip_title=True,
    )
    plain_paragraphs = plain_from_html or body_paragraphs
    return ParsedPost(
        title=title,
        slug=generate_slug(title),
        filename_hint=filename_hint,
        content=content,
        excerpt=make_excerpt(plain_paragraphs or paragraphs),
        category=infer_category(title, plain_paragraphs or paragraphs),
        read_time=estimate_read_time(plain_paragraphs or paragraphs),
        author=author,
        image_url="",
        plain_paragraphs=plain_paragraphs,
        image_count=0,
        source_file=path.name,
    )


async def parse_backup_file(
    path: Path,
    uploader: DropboxImageUploader | None,
) -> ParsedPost:
    if path.suffix.lower() == ".docx":
        return await parse_docx_file(path, uploader)
    if path.suffix.lower() == ".pdf":
        return parse_pdf_file(path)
    raise ValueError(f"Unsupported file type: {path.suffix}")


async def resolve_slug(db, parsed: ParsedPost) -> str:
    """Match an existing post slug when re-syncing to avoid duplicates."""
    title_slug = generate_slug(parsed.title)
    hint_slug = generate_slug(parsed.filename_hint)
    candidates = [title_slug, hint_slug]

    for slug in candidates:
        if await db.blogposts.find_one({"slug": slug}, {"_id": 1}):
            return slug

    if hint_slug:
        existing = await db.blogposts.find_one(
            {"slug": {"$regex": f"^{re.escape(hint_slug)}"}},
            {"slug": 1},
        )
        if existing:
            return existing["slug"]

    for slug in (hint_slug, title_slug):
        if slug and not await db.blogposts.find_one({"slug": slug}, {"_id": 1}):
            return slug
    return title_slug


def post_to_document(parsed: ParsedPost) -> dict:
    doc: dict = {
        "title": parsed.title,
        "slug": parsed.slug,
        "content": parsed.content,
        "excerpt": parsed.excerpt,
        "category": parsed.category,
        "readTime": parsed.read_time,
        "published": True,
        "isPublished": True,
        "tags": [],
        "views": 0,
    }
    if parsed.image_url:
        doc["imageUrl"] = parsed.image_url
    if parsed.author:
        doc["author"] = parsed.author
        doc["authorName"] = parsed.author
    return doc


async def sync_posts(*, dry_run: bool = False, skip_upload: bool = False) -> int:
    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv(BACKEND_DIR / ".env")

    mongo_uri = os.getenv("BACKUP_MONGO_URL") or os.getenv("MONGODB_URI")
    if not mongo_uri:
        print("Error: set BACKUP_MONGO_URL or MONGODB_URI in .env")
        return 1

    if not BACKUP_DIR.is_dir():
        print(f"Error: backup folder not found: {BACKUP_DIR}")
        return 1

    files = sorted(
        f for f in BACKUP_DIR.iterdir() if f.suffix.lower() in {".docx", ".pdf"}
    )
    if not files:
        print(f"No .docx/.pdf files found in {BACKUP_DIR}")
        return 1

    dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
    dns.resolver.default_resolver.nameservers = ["8.8.8.8", "8.8.4.4"]

    uploader: DropboxImageUploader | None = None
    if not skip_upload and not dry_run:
        uploader = DropboxImageUploader()
    elif dry_run:
        uploader = None  # image URLs reported as dry-run paths

    database_name = os.getenv("DATABASE_NAME", "BQITECH")
    client: AsyncIOMotorClient | None = None
    db = None

    if not dry_run:
        client = AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=30000)
        db = client[database_name]
        try:
            await client.admin.command("ping")
        except Exception as exc:
            print(f"Database connection failed: {exc}")
            return 1

    now = datetime.now(timezone.utc)
    inserted = 0
    updated = 0

    print(f"Found {len(files)} backup file(s) in {BACKUP_DIR}\n")

    for path in files:
        parsed = await parse_backup_file(
            path,
            uploader if not dry_run else None,
        )
        if dry_run:
            blocks, media = parse_docx_blocks(path) if path.suffix.lower() == ".docx" else ([], {})
            img_count = len(media) if path.suffix.lower() == ".docx" else 0
            print(f"[dry-run] {parsed.title}")
            print(f"  slug: {parsed.slug}")
            print(f"  images in docx: {img_count} | featured: {parsed.image_url or '(none)'}")
            print(f"  author: {parsed.author or '(omitted)'}")
            continue

        assert db is not None
        parsed.slug = await resolve_slug(db, parsed)
        payload = post_to_document(parsed)
        payload["updatedAt"] = now

        existing = await db.blogposts.find_one({"slug": parsed.slug})
        unset_fields = {
            "authorProfile": "",
            "authorBio": "",
            "authorTitle": "",
            "authorProfileImage": "",
            "authorTwitter": "",
            "authorLinkedin": "",
            "authorGithub": "",
            "authorWebsite": "",
            "metaDescription": "",
        }
        if not parsed.image_url:
            unset_fields["imageUrl"] = ""

        if existing:
            await db.blogposts.update_one(
                {"_id": existing["_id"]},
                {"$set": payload, "$unset": unset_fields},
            )
            updated += 1
            print(
                f"Updated: {parsed.title} ({parsed.slug}) "
                f"[images: {parsed.image_count}, featured: {'yes' if parsed.image_url else 'no'}]"
            )
        else:
            payload["createdAt"] = now
            payload["publishedAt"] = now
            await db.blogposts.insert_one(payload)
            inserted += 1
            print(
                f"Inserted: {parsed.title} ({parsed.slug}) "
                f"[images: {parsed.image_count}, featured: {'yes' if parsed.image_url else 'no'}]"
            )

    if client is not None:
        if not dry_run:
            total = await db.blogposts.count_documents({})
            print(f"\nDone. inserted={inserted}, updated={updated}, total_posts={total}")
        client.close()

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync blog backup documents to MongoDB")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse files and print summary without writing to the database",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(sync_posts(dry_run=args.dry_run)))


if __name__ == "__main__":
    main()
