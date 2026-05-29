"""CV Vault API — cached in MongoDB, synced from Dropbox on demand."""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Any, Dict, Optional
import logging

from app.auth import get_current_admin_user
from app.database import get_database
from app.lib.dropbox import get_dropbox_access_token
from app.lib.cv_vault import (
    CV_VAULT_COLLECTION,
    VALID_SORTS,
    get_cv_vault_filter_options,
    list_cv_vault_from_db,
    sync_cv_vault_from_dropbox,
)
import dropbox

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/cv-vault", tags=["cv-vault"])


async def get_dropbox_client():
    try:
        token = await get_dropbox_access_token()
        return dropbox.Dropbox(token)
    except Exception as e:
        logger.error("Dropbox client init failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to connect to Dropbox storage")


@router.get("/filters")
async def cv_vault_filters(
    current_admin: dict = Depends(get_current_admin_user),
) -> Dict[str, Any]:
    """Sort and filter options for the CV vault UI."""
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return await get_cv_vault_filter_options(db)


@router.get("/")
async def list_cv_vault(
    current_admin: dict = Depends(get_current_admin_user),
    search: str = Query("", description="Filter by name, email, or filename"),
    sort: str = Query("complete_first", description="Sort order"),
    has_email: Optional[bool] = Query(None, description="Filter by email present"),
    has_name: Optional[bool] = Query(None, description="Filter by name present"),
    linked_application: Optional[bool] = Query(
        None, description="Filter by linked application"
    ),
    source: str = Query("all", description="Source: all, application, dropbox"),
    contact_filter: str = Query(
        "all",
        description="Contact filter: all, complete, missing",
    ),
    application_status: str = Query("all", description="Application status filter"),
    sync: bool = Query(False, description="Force sync from Dropbox before returning"),
) -> Dict[str, Any]:
    """List CVs from MongoDB cache. Syncs from Dropbox if cache is empty or sync=true."""
    if sort not in VALID_SORTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort. Use one of: {', '.join(sorted(VALID_SORTS))}",
        )

    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    list_kwargs = {
        "search": search,
        "sort": sort,
        "has_email": has_email,
        "has_name": has_name,
        "linked_application": linked_application,
        "source": source if source != "all" else None,
        "contact_filter": contact_filter,
        "application_status": application_status
        if application_status != "all"
        else None,
    }

    count = await db[CV_VAULT_COLLECTION].count_documents({})
    if sync or count == 0:
        try:
            dbx = await get_dropbox_client()
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Dropbox is not configured")
        return await sync_cv_vault_from_dropbox(db, dbx, extract_pdf=False, **list_kwargs)

    return await list_cv_vault_from_db(db, **list_kwargs)


@router.post("/sync")
async def sync_cv_vault(
    current_admin: dict = Depends(get_current_admin_user),
    extract_pdf: bool = Query(
        False,
        description="Extract name/email from PDF content for entries missing data (slower)",
    ),
    sort: str = Query("complete_first"),
    search: str = Query(""),
    has_email: Optional[bool] = Query(None),
    has_name: Optional[bool] = Query(None),
    linked_application: Optional[bool] = Query(None),
    source: str = Query("all"),
    contact_filter: str = Query("all"),
    application_status: str = Query("all"),
) -> Dict[str, Any]:
    """Pull latest CVs from Dropbox, extract metadata, and store in MongoDB."""
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        dbx = await get_dropbox_client()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Dropbox is not configured")

    return await sync_cv_vault_from_dropbox(
        db,
        dbx,
        extract_pdf=extract_pdf,
        search=search,
        sort=sort,
        has_email=has_email,
        has_name=has_name,
        linked_application=linked_application,
        source=source if source != "all" else None,
        contact_filter=contact_filter,
        application_status=application_status
        if application_status != "all"
        else None,
    )
