#!/usr/bin/env python3
"""
Download a local mirror of app Dropbox folders (/uploads, /avatars) for reimport.

Uses Dropbox HTTP API (requests only; no dropbox package — avoids setuptools/pkg_resources issues).

Requires Dropbox credentials. **Refresh token (recommended):** set
DROPBOX_REFRESH_TOKEN + DROPBOX_APP_KEY + DROPBOX_APP_SECRET — these are used first when all
three are present. **Fallback:** DROPBOX_ACCESS_TOKEN only if refresh vars are not all set.

Usage (from Backend/):
  python scripts/backup_dropbox_local.py
  python scripts/backup_dropbox_local.py --dry-run
  python scripts/backup_dropbox_local.py --out ../backups/dropbox_mirror
  python scripts/backup_dropbox_local.py --access-token-only   # ignore refresh; use DROPBOX_ACCESS_TOKEN
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

API_LIST = "https://api.dropboxapi.com/2/files/list_folder"
API_LIST_CONTINUE = "https://api.dropboxapi.com/2/files/list_folder/continue"
API_DOWNLOAD = "https://content.dropboxapi.com/2/files/download"


def _load_env() -> None:
    here = Path(__file__).resolve()
    for p in (here.parents[1] / ".env", here.parents[2] / ".env"):
        if p.is_file():
            load_dotenv(p)
            return
    load_dotenv()


def _exchange_refresh_token() -> str:
    refresh = os.getenv("DROPBOX_REFRESH_TOKEN", "").strip()
    key = os.getenv("DROPBOX_APP_KEY", "").strip()
    secret = os.getenv("DROPBOX_APP_SECRET", "").strip()
    if not (refresh and key and secret):
        return ""

    r = requests.post(
        "https://api.dropbox.com/oauth2/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh,
            "client_id": key,
            "client_secret": secret,
        },
        timeout=60,
    )
    if not r.ok:
        print(
            f"Dropbox refresh_token exchange failed ({r.status_code}): {r.text}",
            file=sys.stderr,
        )
        r.raise_for_status()
    data = r.json()
    access = data.get("access_token")
    if not access:
        print("Dropbox token response missing access_token.", file=sys.stderr)
        sys.exit(1)
    return access


def get_access_token(*, prefer_refresh: bool = True) -> str:
    """
    Return a short-lived access token.
    When prefer_refresh is True (default), uses refresh token if DROPBOX_REFRESH_TOKEN,
    DROPBOX_APP_KEY, and DROPBOX_APP_SECRET are all set; otherwise falls back to
    DROPBOX_ACCESS_TOKEN.
    """
    if prefer_refresh:
        token = _exchange_refresh_token()
        if token:
            return token

    token = os.getenv("DROPBOX_ACCESS_TOKEN", "").strip()
    if token:
        return token

    if prefer_refresh:
        print(
            "Missing Dropbox credentials. Set DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, and "
            "DROPBOX_APP_SECRET (recommended), or set DROPBOX_ACCESS_TOKEN alone.",
            file=sys.stderr,
        )
    else:
        print("Missing DROPBOX_ACCESS_TOKEN.", file=sys.stderr)
    sys.exit(1)


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _is_path_not_found(resp: requests.Response) -> bool:
    if resp.status_code != 409:
        return False
    try:
        body = resp.json()
        err = body.get("error") or {}
        if err.get(".tag") == "path":
            inner = err.get("path") or {}
            return inner.get(".tag") == "not_found"
    except Exception:
        pass
    return False


def list_all_files_rest(token: str, folder_path: str) -> list[dict[str, Any]]:
    """List all files under folder_path (recursive). Returns Dropbox file metadata dicts."""
    headers = _auth_headers(token)
    body: dict[str, Any] = {
        "path": folder_path if folder_path else "",
        "recursive": True,
    }
    r = requests.post(API_LIST, headers=headers, json=body, timeout=120)
    if _is_path_not_found(r):
        return []
    if r.status_code == 401:
        print(
            "Dropbox API returned 401 Unauthorized. Check DROPBOX_ACCESS_TOKEN (or refresh "
            "credentials) in Backend/.env or project root .env.",
            file=sys.stderr,
        )
        sys.exit(1)
    r.raise_for_status()
    data = r.json()
    entries: list = list(data.get("entries") or [])

    while data.get("has_more"):
        r2 = requests.post(
            API_LIST_CONTINUE,
            headers=headers,
            json={"cursor": data["cursor"]},
            timeout=120,
        )
        r2.raise_for_status()
        data = r2.json()
        entries.extend(data.get("entries") or [])

    return [e for e in entries if e.get(".tag") == "file"]


def download_file_rest(token: str, dropbox_path: str) -> bytes:
    headers = {
        "Authorization": f"Bearer {token}",
        "Dropbox-API-Arg": json.dumps({"path": dropbox_path}),
    }
    r = requests.post(API_DOWNLOAD, headers=headers, timeout=300)
    r.raise_for_status()
    return r.content


def dropbox_path_to_local_relative(path: str) -> str:
    p = path.lstrip("/")
    return p if p else "root"


def main() -> None:
    parser = argparse.ArgumentParser(description="Mirror Dropbox /uploads and /avatars to disk.")
    parser.add_argument(
        "--out",
        type=str,
        default=None,
        help="Output directory (default: Backend/backups/dropbox_local_<timestamp>)",
    )
    parser.add_argument(
        "--roots",
        type=str,
        default="/uploads,/avatars",
        help="Comma-separated Dropbox folder paths to mirror (default: /uploads,/avatars)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List files only; do not download.",
    )
    parser.add_argument(
        "--access-token-only",
        action="store_true",
        help="Use DROPBOX_ACCESS_TOKEN only (skip refresh token exchange).",
    )
    args = parser.parse_args()

    _load_env()
    token = get_access_token(prefer_refresh=not args.access_token_only)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backend_dir = Path(__file__).resolve().parents[1]
    out_root = Path(args.out) if args.out else backend_dir / "backups" / f"dropbox_local_{ts}"
    out_root.mkdir(parents=True, exist_ok=True)

    roots = [r.strip() for r in args.roots.split(",") if r.strip()]
    if not roots:
        roots = ["/uploads", "/avatars"]

    manifest_files: list[dict[str, Any]] = []
    total_bytes = 0
    downloaded = 0

    for root in roots:
        if not root.startswith("/"):
            root = "/" + root
        files = list_all_files_rest(token, root)
        print(f"{root}: {len(files)} file(s)")

        for meta in files:
            disp = meta.get("path_display") or meta.get("path_lower") or ""
            rel = dropbox_path_to_local_relative(disp)
            local_path = out_root / rel
            client_mod = meta.get("client_modified")
            entry = {
                "dropbox_path": disp,
                "local_relative": str(Path(rel).as_posix()),
                "size": meta.get("size"),
                "content_hash": meta.get("content_hash"),
                "rev": meta.get("rev"),
                "client_modified": client_mod,
            }
            manifest_files.append(entry)

            if args.dry_run:
                continue

            local_path.parent.mkdir(parents=True, exist_ok=True)
            data = download_file_rest(token, disp)
            local_path.write_bytes(data)
            total_bytes += len(data)
            downloaded += 1
            if downloaded % 50 == 0:
                print(f"  ... downloaded {downloaded} files")

    manifest = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "roots": roots,
        "dry_run": args.dry_run,
        "file_count": len(manifest_files),
        "total_bytes_downloaded": total_bytes if not args.dry_run else None,
        "files": manifest_files,
    }
    manifest_path = out_root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"Manifest: {manifest_path}")
    if args.dry_run:
        print("Dry run: no files written except manifest.json")
    else:
        print(f"Downloaded {downloaded} files ({total_bytes / (1024 * 1024):.2f} MiB) -> {out_root}")


if __name__ == "__main__":
    main()
