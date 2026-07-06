"""CV Vault API — cached in MongoDB, synced from Dropbox on demand."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
import logging

from app.auth import get_current_admin_user
from app.database import get_database
from app.lib.dropbox import get_dropbox_access_token
from app.lib.cv_vault import (
    CV_VAULT_APPLICATION_STATUSES,
    CV_VAULT_COLLECTION,
    VALID_SORTS,
    create_application_from_cv_vault,
    get_cv_vault_filter_options,
    link_cv_vault_entry,
    list_cv_vault_from_db,
    suggest_applications_for_vault,
    sync_cv_vault_from_dropbox,
)
import dropbox

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/cv-vault", tags=["cv-vault"])


class LinkVaultRequest(BaseModel):
    vault_id: str = Field(..., alias="vaultId")
    application_id: str = Field(..., alias="applicationId")

    model_config = {"populate_by_name": True}


class CreateApplicationFromVaultRequest(BaseModel):
    vault_id: str = Field(..., alias="vaultId")
    job_id: str = Field(..., alias="jobId")
    status: str = "New"
    email: Optional[str] = None
    name: Optional[str] = None

    model_config = {"populate_by_name": True}


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
    date_from: Optional[str] = Query(None, description="Applied date from (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Applied date to (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(25, ge=1, le=100, description="Page size"),
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
        "date_from": date_from,
        "date_to": date_to,
        "skip": skip,
        "limit": limit,
    }

    count = await db[CV_VAULT_COLLECTION].count_documents({})
    if sync or count == 0:
        try:
            dbx = await get_dropbox_client()
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Dropbox is not configured")
        return await sync_cv_vault_from_dropbox(db, dbx, extract_pdf=True, **list_kwargs)

    return await list_cv_vault_from_db(db, **list_kwargs)


@router.post("/sync")
async def sync_cv_vault(
    current_admin: dict = Depends(get_current_admin_user),
    extract_pdf: bool = Query(
        True,
        description="Extract name/email from PDF content for entries missing data (set false for faster sync)",
    ),
    sort: str = Query("complete_first"),
    search: str = Query(""),
    has_email: Optional[bool] = Query(None),
    has_name: Optional[bool] = Query(None),
    linked_application: Optional[bool] = Query(None),
    source: str = Query("all"),
    contact_filter: str = Query("all"),
    application_status: str = Query("all"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
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
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )


@router.put("/link")
async def link_cv_vault(
    body: LinkVaultRequest,
    current_admin: dict = Depends(get_current_admin_user),
) -> Dict[str, Any]:
    """Link a CV vault row to an existing application."""
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        entry = await link_cv_vault_entry(db, body.vault_id, body.application_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("CV vault link failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to link application")

    return {"item": entry}


@router.post("/create-application")
async def create_cv_vault_application(
    body: CreateApplicationFromVaultRequest,
    request: Request,
    current_admin: dict = Depends(get_current_admin_user),
) -> Dict[str, Any]:
    """Create an application from a CV vault row, optionally creating the applicant account."""
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    if body.status not in CV_VAULT_APPLICATION_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(CV_VAULT_APPLICATION_STATUSES)}",
        )

    from app.lib.cors import resolve_frontend_url

    try:
        result = await create_application_from_cv_vault(
            db,
            body.vault_id,
            body.job_id,
            body.status,
            email_override=body.email,
            name_override=body.name,
            created_by_admin_id=str(current_admin.get("_id") or current_admin.get("id") or ""),
            frontend_url=resolve_frontend_url(request.headers.get("origin")),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("CV vault create-application failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create application from CV")

    return result


@router.get("/{vault_id:path}/suggestions")
async def cv_vault_suggestions(
    vault_id: str,
    current_admin: dict = Depends(get_current_admin_user),
    limit: int = Query(10, ge=1, le=25),
) -> Dict[str, Any]:
    """Suggest applications that may match an unlinked CV vault row."""
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    suggestions = await suggest_applications_for_vault(db, vault_id, limit=limit)
    return {"suggestions": suggestions}
