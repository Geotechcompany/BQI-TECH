#!/usr/bin/env python3
"""Smoke-test Microsoft Graph mail auth (token only by default).

Usage (from Backend/):
  python scripts/test_graph_mail.py
  python scripts/test_graph_mail.py --send you@example.com
"""

from __future__ import annotations

import argparse
import os
import sys

# Ensure Backend root is on path when run as a script
_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from dotenv import load_dotenv

load_dotenv(os.path.join(_BACKEND_ROOT, ".env"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Test Graph mail configuration")
    parser.add_argument(
        "--send",
        metavar="EMAIL",
        help="Also send a test message to this address (optional)",
    )
    args = parser.parse_args()

    from app.lib.graph_mail import (
        get_graph_mail_from,
        get_mail_from_name,
        is_graph_mail_configured,
        send_mail_via_graph,
        test_graph_mail_auth,
    )
    from app.lib.email_transport import get_email_provider

    print("Graph configured:", is_graph_mail_configured())
    print("Resolved provider:", get_email_provider())
    print("From mailbox set:", bool(get_graph_mail_from()))
    print("From display name:", get_mail_from_name())

    result = test_graph_mail_auth()
    # Never print tokens or cert material
    for key in (
        "provider",
        "configured",
        "authenticated",
        "tokenAcquired",
        "tokenLength",
        "fromEmail",
        "fromName",
        "clientIdSet",
        "tenantIdSet",
        "certConfigured",
        "message",
    ):
        if key in result:
            print(f"  {key}: {result[key]}")

    if not result.get("authenticated"):
        print("\nToken acquisition failed. Check Entra app:")
        print("  - Certificate uploaded to the app registration")
        print("  - Application permission Mail.Send with admin consent")
        print("  - AZURE_CERT_PASSWORD if the PFX is encrypted")
        print("  - Sender mailbox exists and app can send as that user")
        return 1

    if args.send:
        send_mail_via_graph(
            args.send,
            "BQI Tech Graph mail test",
            "<p>This is a Microsoft Graph sendMail smoke test from the HR portal backend.</p>",
        )
        print(f"\nTest email accepted by Graph (202) for {args.send}")
    else:
        print("\nToken OK. Pass --send you@example.com to send a test message.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
