#!/usr/bin/env python3
"""Seed dummy users, CVs, job postings, and blog posts for the test environment."""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import re
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bson import ObjectId

from app.auth import get_password_hash
from app.database import close_database_connection, connect_to_database, get_database, is_connected
from app.lib.cv_vault import CV_VAULT_COLLECTION, CV_VAULT_META_COLLECTION, CV_VAULT_META_ID, entry_to_db_doc
from seed_cv_pdf import (
    _safe_filename,
    build_cv_pdf_bytes,
    save_cv_pdf_locally,
    upload_cv_pdf_to_dropbox,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

SEED_TAG = "bqi-test-env-seed"
DEFAULT_PASSWORD = "TestPassword123!"

FIRST_NAMES = [
    "Amara",
    "Brian",
    "Chloe",
    "Daniel",
    "Elena",
    "Felix",
    "Grace",
    "Hassan",
    "Isabella",
    "James",
]
LAST_NAMES = [
    "Okonkwo",
    "Mwangi",
    "Kamau",
    "Ochieng",
    "Wanjiru",
    "Mutua",
    "Achieng",
    "Kiptoo",
    "Njoroge",
    "Wambui",
]

JOB_TITLES = [
    "Salesforce Developer",
    "Full Stack Engineer",
    "DevOps Specialist",
]

BLOG_TOPICS = [
    {
        "title": "Modernizing Government Services with Cloud Platforms",
        "category": "Digital Transformation",
        "tags": ["cloud", "government", "modernization"],
        "image_id": 28,
    },
    {
        "title": "Building Scalable APIs for Enterprise Applications",
        "category": "Engineering",
        "tags": ["api", "architecture", "backend"],
        "image_id": 119,
    },
    {
        "title": "How Agile Teams Deliver Better Public Sector Software",
        "category": "Process",
        "tags": ["agile", "delivery", "teams"],
        "image_id": 180,
    },
    {
        "title": "Security Best Practices for SaaS Platforms",
        "category": "Security",
        "tags": ["security", "compliance", "saas"],
        "image_id": 263,
    },
    {
        "title": "Designing Accessible User Experiences in Civic Tech",
        "category": "UX Design",
        "tags": ["accessibility", "ux", "civic-tech"],
        "image_id": 367,
    },
]

SAMPLE_CV_URL = (
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_CV_DIR = os.path.join(SCRIPT_DIR, "seed_assets", "cvs")


def generate_slug(title: str) -> str:
    slug = title.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug


def blog_image_url(image_id: int) -> str:
    return f"https://picsum.photos/id/{image_id}/1200/675.jpg"


def author_image_url(index: int) -> str:
    return f"https://i.pravatar.cc/150?img={index + 1}"


async def _build_and_upload_cv(
    *,
    name: str,
    email: str,
    position: str,
    index: int,
    upload_dropbox: bool,
    save_local: bool,
) -> tuple[str, str, int]:
    file_name = _safe_filename(name)
    pdf_bytes = build_cv_pdf_bytes(name=name, email=email, position=position)

    if save_local:
        local_path = save_cv_pdf_locally(pdf_bytes, file_name, LOCAL_CV_DIR)
        logger.info("Saved local CV copy: %s", local_path)

    if upload_dropbox:
        try:
            cv_url, dropbox_path, size = await upload_cv_pdf_to_dropbox(pdf_bytes, file_name)
            return cv_url, dropbox_path, size
        except Exception as error:
            logger.warning(
                "Dropbox upload failed for %s (%s); trying existing shared link",
                name,
                error,
            )
            # File may already exist from a prior seed — reuse its shared link.
            try:
                from app.lib.dropbox import get_dropbox_access_token
                import dropbox as dropbox_sdk

                token = await get_dropbox_access_token()
                dbx = dropbox_sdk.Dropbox(token)
                dropbox_path = f"/uploads/seed/{file_name}"
                links = dbx.sharing_list_shared_links(path=dropbox_path).links
                if links:
                    cv_url = links[0].url.replace(
                        "www.dropbox.com", "dl.dropboxusercontent.com"
                    )
                    if "?dl=0" in cv_url:
                        cv_url = cv_url.replace("?dl=0", "?dl=1")
                    elif "dl=1" not in cv_url:
                        cv_url = f"{cv_url}{'&' if '?' in cv_url else '?'}dl=1"
                    return cv_url, dropbox_path, len(pdf_bytes)
            except Exception as link_error:
                logger.warning(
                    "Could not reuse Dropbox link for %s (%s)",
                    name,
                    link_error,
                )

    # Last resort only — W3 dummy has no contact fields; prefer local path marker.
    if save_local:
        local_path = os.path.join(LOCAL_CV_DIR, file_name)
        if os.path.isfile(local_path):
            logger.warning(
                "Using local seed CV path for %s (Dropbox unavailable). "
                "Contact sync will read scripts/seed_assets/cvs/%s",
                name,
                file_name,
            )
            # file:// is not fetchable by the API; store a dropbox-shaped path and
            # a placeholder URL that extract_text_from_cv_url can map to local seed.
            return (
                f"https://dl.dropboxusercontent.com/uploads/seed/{file_name}?local_seed=1",
                f"/uploads/seed/{file_name}",
                len(pdf_bytes),
            )

    cv_url = f"{SAMPLE_CV_URL}?seed={index + 1}"
    return cv_url, f"/uploads/seed/{file_name}", len(pdf_bytes)


async def cleanup_seed_data(db) -> dict[str, int]:
    counts = {}
    for collection, query in [
        ("users", {"seedTag": SEED_TAG}),
        ("jobpostings", {"seedTag": SEED_TAG}),
        ("applications", {"seedTag": SEED_TAG}),
        (CV_VAULT_COLLECTION, {"seedTag": SEED_TAG}),
        ("blogposts", {"seedTag": SEED_TAG}),
    ]:
        result = await db[collection].delete_many(query)
        counts[collection] = result.deleted_count
    return counts


async def seed_users(db, *, force: bool) -> list[dict]:
    existing = await db.users.count_documents({"seedTag": SEED_TAG})
    if existing and not force:
        logger.info("Skipping users (%s already seeded)", existing)
        cursor = db.users.find({"seedTag": SEED_TAG}).sort("seedIndex", 1)
        return await cursor.to_list(length=10)

    if existing and force:
        await db.users.delete_many({"seedTag": SEED_TAG})

    now = datetime.utcnow()
    hashed_password = get_password_hash(DEFAULT_PASSWORD)
    users: list[dict] = []

    for index in range(10):
        first = FIRST_NAMES[index]
        last = LAST_NAMES[index]
        email = f"seed.user{index + 1}@test.bqitech.local"
        user_doc = {
            "email": email,
            "name": f"{first} {last}",
            "password": hashed_password,
            "role": "ADMIN" if index == 0 else "USER",
            "isEmailVerified": True,
            "is_verified": True,
            "createdAt": now,
            "updatedAt": now,
            "seedTag": SEED_TAG,
            "seedIndex": index,
        }
        result = await db.users.insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
        users.append(user_doc)

    logger.info("Created %s seed users", len(users))
    return users


async def seed_jobs(db, admin_user_id: str, *, force: bool) -> list[dict]:
    existing = await db.jobpostings.count_documents({"seedTag": SEED_TAG})
    if existing and not force:
        logger.info("Skipping job postings (%s already seeded)", existing)
        cursor = db.jobpostings.find({"seedTag": SEED_TAG}).sort("seedIndex", 1)
        return await cursor.to_list(length=3)

    if existing and force:
        await db.jobpostings.delete_many({"seedTag": SEED_TAG})

    now = datetime.utcnow()
    jobs: list[dict] = []
    descriptions = [
        "<p><strong>About the role</strong></p><p>Build and maintain Salesforce solutions for public sector clients.</p>",
        "<p><strong>About the role</strong></p><p>Design and ship full-stack features using React and Python.</p>",
        "<p><strong>About the role</strong></p><p>Own CI/CD pipelines, observability, and cloud infrastructure.</p>",
    ]

    for index, title in enumerate(JOB_TITLES):
        job_doc = {
            "title": title,
            "department": "Professional Services",
            "location": "Nairobi, Kenya",
            "description": descriptions[index],
            "employmentType": "Full-time",
            "category": "Technology",
            "isActive": True,
            "requirements": [
                "3+ years of relevant experience",
                "Strong communication skills",
                "Experience working in agile teams",
            ],
            "questions": [],
            "postedDate": now - timedelta(days=index + 1),
            "createdAt": now,
            "updatedAt": now,
            "createdBy": admin_user_id,
            "seedTag": SEED_TAG,
            "seedIndex": index,
        }
        result = await db.jobpostings.insert_one(job_doc)
        job_doc["_id"] = result.inserted_id
        jobs.append(job_doc)

    logger.info("Created %s seed job postings", len(jobs))
    return jobs


async def seed_applications_and_cvs(
    db,
    users: list[dict],
    jobs: list[dict],
    *,
    force: bool,
    upload_dropbox: bool = True,
    save_local: bool = True,
) -> list[dict]:
    existing = await db.applications.count_documents({"seedTag": SEED_TAG})
    if existing and not force:
        logger.info("Skipping applications/CVs (%s already seeded)", existing)
        cursor = db.applications.find({"seedTag": SEED_TAG}).sort("seedIndex", 1)
        return await cursor.to_list(length=10)

    if existing and force:
        await db.applications.delete_many({"seedTag": SEED_TAG})
        await db[CV_VAULT_COLLECTION].delete_many({"seedTag": SEED_TAG})

    now = datetime.utcnow()
    applications: list[dict] = []
    vault_entries: list[dict] = []

    for index, user in enumerate(users):
        job = jobs[index % len(jobs)]
        job_id = str(job["_id"])
        name = user["name"]
        email = user["email"]
        position = job["title"]
        cv_url, dropbox_path, file_size = await _build_and_upload_cv(
            name=name,
            email=email,
            position=position,
            index=index,
            upload_dropbox=upload_dropbox,
            save_local=save_local,
        )
        file_name = os.path.basename(dropbox_path)

        answers = [
            {"questionText": "First Name", "answer": name.split()[0]},
            {"questionText": "Last Name", "answer": name.split()[-1]},
            {"questionText": "Email", "answer": email},
            {
                "questionText": "Upload your CV/Resume",
                "answer": cv_url,
            },
        ]

        app_doc = {
            "jobId": job_id,
            "userId": str(user["_id"]),
            "position": position,
            "cvUrl": cv_url,
            "answers": answers,
            "name": name,
            "email": email,
            "status": ["New", "Shortlisted", "Assessment", "Interview"][index % 4],
            "appliedDate": now - timedelta(days=index),
            "createdAt": now,
            "updatedAt": now,
            "statusHistory": [
                {
                    "status": "New",
                    "date": now - timedelta(days=index),
                    "changedBy": None,
                    "reason": "Application submitted",
                }
            ],
            "seedTag": SEED_TAG,
            "seedIndex": index,
        }
        result = await db.applications.insert_one(app_doc)
        app_doc["_id"] = result.inserted_id
        applications.append(app_doc)

        vault_id = f"seed-cv-{index + 1}"
        vault_entry = {
            "id": vault_id,
            "name": name,
            "email": email,
            "cvUrl": cv_url,
            "dropboxPath": dropbox_path,
            "fileName": file_name,
            "source": "dropbox" if upload_dropbox and cv_url.startswith("http") else "seed",
            "applicationId": str(result.inserted_id),
            "applicationStatus": app_doc["status"],
            "appliedDate": app_doc["appliedDate"].isoformat(),
            "modifiedAt": now.isoformat(),
            "size": file_size,
        }
        vault_doc = entry_to_db_doc(vault_entry, now)
        vault_doc["seedTag"] = SEED_TAG
        vault_doc["seedIndex"] = index
        await db[CV_VAULT_COLLECTION].update_one(
            {"vaultId": vault_id},
            {"$set": vault_doc, "$setOnInsert": {"createdAt": now}},
            upsert=True,
        )
        vault_entries.append(vault_entry)

    total = len(vault_entries)
    await db[CV_VAULT_META_COLLECTION].update_one(
        {"_id": CV_VAULT_META_ID},
        {
            "$set": {
                "lastSyncedAt": now,
                "total": total,
                "stats": {
                    "withEmail": total,
                    "withApplication": total,
                    "dropboxFolders": ["/uploads/seed"],
                },
                "updatedAt": now,
            },
            "$setOnInsert": {"createdAt": now},
        },
        upsert=True,
    )

    logger.info("Created %s seed applications and CV vault entries", len(applications))
    return applications


async def seed_blog_posts(db, admin_user: dict, *, force: bool) -> list[dict]:
    existing = await db.blogposts.count_documents({"seedTag": SEED_TAG})
    if existing and not force:
        logger.info("Skipping blog posts (%s already seeded)", existing)
        cursor = db.blogposts.find({"seedTag": SEED_TAG}).sort("seedIndex", 1)
        return await cursor.to_list(length=5)

    if existing and force:
        await db.blogposts.delete_many({"seedTag": SEED_TAG})

    now = datetime.utcnow()
    posts: list[dict] = []
    author_name = admin_user.get("name", "BQI Tech Editorial")

    for index, topic in enumerate(BLOG_TOPICS):
        slug = generate_slug(topic["title"])
        image_url = blog_image_url(topic["image_id"])
        excerpt = (
            f"A practical overview of {topic['title'].lower()} for teams building "
            "modern digital services."
        )
        post_doc = {
            "title": topic["title"],
            "slug": slug,
            "content": (
                f"<p>{excerpt}</p>"
                "<p>This seeded article is intended for test and demo environments only.</p>"
                "<h2>Key takeaways</h2>"
                "<ul>"
                "<li>Focus on measurable outcomes for citizens and staff.</li>"
                "<li>Invest in secure, maintainable architecture.</li>"
                "<li>Ship iteratively with strong feedback loops.</li>"
                "</ul>"
            ),
            "excerpt": excerpt,
            "category": topic["category"],
            "tags": topic["tags"],
            "imageUrl": image_url,
            "readTime": "4 min",
            "status": "published",
            "isPublished": True,
            "published": True,
            "publishedAt": now - timedelta(days=index + 2),
            "createdAt": now - timedelta(days=index + 3),
            "updatedAt": now,
            "author": author_name,
            "authorId": str(admin_user["_id"]),
            "authorProfile": {
                "name": author_name,
                "bio": "Editorial team member at BQI Tech.",
                "title": "Content Lead",
                "profile_image": author_image_url(index),
                "social_links": {
                    "linkedin": "https://www.linkedin.com/company/bqitech",
                    "website": "https://bqitech.com",
                },
            },
            "views": 25 * (index + 1),
            "seedTag": SEED_TAG,
            "seedIndex": index,
        }
        result = await db.blogposts.insert_one(post_doc)
        post_doc["_id"] = result.inserted_id
        posts.append(post_doc)

    logger.info("Created %s seed blog posts with images", len(posts))
    return posts


async def update_seed_cv_pdfs(
    db,
    *,
    upload_dropbox: bool = True,
    save_local: bool = True,
) -> int:
    """Regenerate PDFs for existing seed applications and update DB records."""
    applications = await db.applications.find({"seedTag": SEED_TAG}).sort("seedIndex", 1).to_list(length=100)
    if not applications:
        logger.warning("No seed applications found to update")
        return 0

    now = datetime.utcnow()
    updated = 0

    for app in applications:
        index = app.get("seedIndex", 0)
        name = app.get("name") or "Unknown Applicant"
        email = app.get("email") or f"seed.user{index + 1}@test.bqitech.local"
        position = app.get("position") or "Technology Professional"

        cv_url, dropbox_path, file_size = await _build_and_upload_cv(
            name=name,
            email=email,
            position=position,
            index=index,
            upload_dropbox=upload_dropbox,
            save_local=save_local,
        )
        file_name = os.path.basename(dropbox_path)

        answers = app.get("answers") or []
        patched_answers = []
        cv_answer_updated = False
        for answer in answers:
            if isinstance(answer, dict) and "cv" in str(answer.get("questionText", "")).lower():
                answer = {**answer, "answer": cv_url}
                cv_answer_updated = True
            patched_answers.append(answer)
        if not cv_answer_updated:
            patched_answers.append(
                {"questionText": "Upload your CV/Resume", "answer": cv_url}
            )

        await db.applications.update_one(
            {"_id": app["_id"]},
            {
                "$set": {
                    "cvUrl": cv_url,
                    "answers": patched_answers,
                    "updatedAt": now,
                }
            },
        )

        vault_id = f"seed-cv-{index + 1}"
        vault_entry = {
            "id": vault_id,
            "name": name,
            "email": email,
            "cvUrl": cv_url,
            "dropboxPath": dropbox_path,
            "fileName": file_name,
            "source": "dropbox" if upload_dropbox and cv_url.startswith("http") else "seed",
            "applicationId": str(app["_id"]),
            "applicationStatus": app.get("status"),
            "appliedDate": app.get("appliedDate"),
            "modifiedAt": now.isoformat(),
            "size": file_size,
        }
        vault_doc = entry_to_db_doc(vault_entry, now)
        vault_doc["seedTag"] = SEED_TAG
        vault_doc["seedIndex"] = index
        await db[CV_VAULT_COLLECTION].update_one(
            {"vaultId": vault_id},
            {"$set": vault_doc, "$setOnInsert": {"createdAt": now}},
            upsert=True,
        )
        updated += 1
        logger.info("Updated CV PDF for %s", name)

    return updated


async def run_seed(
    *,
    clean: bool,
    force: bool,
    upload_dropbox: bool = True,
    save_local: bool = True,
    cv_pdfs_only: bool = False,
) -> None:
    await connect_to_database()
    if not is_connected():
        raise RuntimeError("Could not connect to MongoDB. Check MONGO_URL in Backend/.env")

    db = get_database()
    db_name = db.name
    logger.info("Connected to database: %s", db_name)

    if clean:
        removed = await cleanup_seed_data(db)
        logger.info("Cleaned seed data: %s", removed)
        if not force:
            return

    if cv_pdfs_only:
        count = await update_seed_cv_pdfs(
            db,
            upload_dropbox=upload_dropbox,
            save_local=save_local,
        )
        print(f"\n=== Updated {count} seed CV PDFs ===")
        if save_local:
            print(f"Local copies: {LOCAL_CV_DIR}")
        return

    users = await seed_users(db, force=force)
    admin_user = users[0]
    jobs = await seed_jobs(db, str(admin_user["_id"]), force=force)
    applications = await seed_applications_and_cvs(
        db,
        users,
        jobs,
        force=force,
        upload_dropbox=upload_dropbox,
        save_local=save_local,
    )
    posts = await seed_blog_posts(db, admin_user, force=force)

    print("\n=== Test environment seed complete ===")
    print(f"Database: {db_name}")
    print(f"Users: {len(users)}")
    print(f"Job postings: {len(jobs)}")
    print(f"Applications/CVs: {len(applications)}")
    print(f"Blog posts: {len(posts)}")
    print(f"\nDefault password for all seed users: {DEFAULT_PASSWORD}")
    print("\nSeed user accounts:")
    for user in users:
        role = user.get("role", "USER")
        print(f"  - {user['email']} ({role})")
    print("\nSeed job postings:")
    for job in jobs:
        print(f"  - {job['title']} [{job['_id']}]")
    print("\nSeed blog slugs:")
    for post in posts:
        print(f"  - /blog/{post['slug']}")
    if save_local:
        print(f"\nLocal CV PDF copies: {LOCAL_CV_DIR}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed dummy test data into MongoDB")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove previously seeded documents tagged with seedTag",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace existing seed data instead of skipping",
    )
    parser.add_argument(
        "--cv-pdfs-only",
        action="store_true",
        help="Only regenerate and upload CV PDFs for existing seed applications",
    )
    parser.add_argument(
        "--no-dropbox",
        action="store_true",
        help="Skip Dropbox upload (local PDF files only)",
    )
    parser.add_argument(
        "--no-local",
        action="store_true",
        help="Do not write local PDF copies under scripts/seed_assets/cvs",
    )
    args = parser.parse_args()

    if args.clean and not args.force:
        async def clean_only() -> None:
            await connect_to_database()
            if not is_connected():
                raise RuntimeError("Could not connect to MongoDB")
            removed = await cleanup_seed_data(get_database())
            print("Removed seed data:", removed)

        asyncio.run(clean_only())
        return

    asyncio.run(
        run_seed(
            clean=args.clean,
            force=args.force,
            upload_dropbox=not args.no_dropbox,
            save_local=not args.no_local,
            cv_pdfs_only=args.cv_pdfs_only,
        )
    )


if __name__ == "__main__":
    main()
