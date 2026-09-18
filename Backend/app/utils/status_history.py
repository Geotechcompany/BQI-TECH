#!/usr/bin/env python3
"""
Status History Helper Functions

This module provides utility functions for managing application status history,
ensuring consistency and proper tracking of all status changes.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from bson import ObjectId
from app.models.application import StatusHistoryEntry


def is_mongo_object_id_string(value: Any) -> bool:
    """True when value looks like a 24-char MongoDB ObjectId hex string."""
    if not isinstance(value, str):
        return False
    trimmed = value.strip()
    return len(trimmed) == 24 and ObjectId.is_valid(trimmed)


def actor_label_from_user(user: Optional[Dict[str, Any]]) -> Optional[str]:
    """Prefer email, then name — matches admin status-update changedBy labels."""
    if not user:
        return None
    email = str(user.get("email") or "").strip()
    if email:
        return email
    name = str(user.get("name") or "").strip()
    if name:
        return name
    first = str(user.get("firstName") or "").strip()
    last = str(user.get("lastName") or "").strip()
    combined = f"{first} {last}".strip()
    return combined or None


def admin_actor_label(user: Optional[Dict[str, Any]]) -> str:
    """Label stored on statusHistory.changedBy for admin-driven writes."""
    return actor_label_from_user(user) or "Admin"


async def resolve_status_history_changed_by(
    db,
    status_history: Optional[List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    """
    Replace ObjectId changedBy values with email/name for API responses.
    Leaves human-readable labels (emails, names) unchanged.
    """
    if not status_history:
        return list(status_history or [])

    unresolved_ids: List[str] = []
    for entry in status_history:
        raw = entry.get("changedBy")
        if is_mongo_object_id_string(raw):
            unresolved_ids.append(str(raw).strip())

    label_by_id: Dict[str, str] = {}
    if unresolved_ids and db is not None:
        unique_ids = list(dict.fromkeys(unresolved_ids))
        object_ids = [ObjectId(uid) for uid in unique_ids]
        users = await db.users.find(
            {"_id": {"$in": object_ids}},
            {"email": 1, "name": 1, "firstName": 1, "lastName": 1},
        ).to_list(length=len(object_ids))
        for user in users:
            uid = str(user["_id"])
            label = actor_label_from_user(user)
            if label:
                label_by_id[uid] = label

    resolved: List[Dict[str, Any]] = []
    for entry in status_history:
        new_entry = dict(entry)
        raw = new_entry.get("changedBy")
        if is_mongo_object_id_string(raw):
            key = str(raw).strip()
            if key in label_by_id:
                new_entry["changedBy"] = label_by_id[key]
        resolved.append(new_entry)
    return resolved


async def resolve_applications_changed_by(
    db,
    applications: List[Dict[str, Any]],
) -> None:
    """In-place: resolve ObjectId changedBy values across a list of applications."""
    if not applications or db is None:
        return

    unresolved_ids: List[str] = []
    for app in applications:
        for entry in app.get("statusHistory") or []:
            raw = entry.get("changedBy")
            if is_mongo_object_id_string(raw):
                unresolved_ids.append(str(raw).strip())

    if not unresolved_ids:
        return

    unique_ids = list(dict.fromkeys(unresolved_ids))
    object_ids = [ObjectId(uid) for uid in unique_ids]
    users = await db.users.find(
        {"_id": {"$in": object_ids}},
        {"email": 1, "name": 1, "firstName": 1, "lastName": 1},
    ).to_list(length=len(object_ids))

    label_by_id: Dict[str, str] = {}
    for user in users:
        uid = str(user["_id"])
        label = actor_label_from_user(user)
        if label:
            label_by_id[uid] = label

    if not label_by_id:
        return

    for app in applications:
        history = app.get("statusHistory")
        if not history:
            continue
        for entry in history:
            raw = entry.get("changedBy")
            if is_mongo_object_id_string(raw):
                key = str(raw).strip()
                if key in label_by_id:
                    entry["changedBy"] = label_by_id[key]


class StatusHistoryManager:
    """Manager class for handling status history operations"""
    
    # Valid status transitions - defines which statuses can follow others
    VALID_TRANSITIONS = {
        'New': ['Shortlisted', 'Rejected', 'Disqualified'],
        'Shortlisted': ['Technical Assessment', 'Interviewing', 'Rejected', 'Disqualified'],
        'Technical Assessment': ['Interviewing', 'Shortlisted', 'Rejected', 'Disqualified'],
        'Interviewing': ['Hired', 'Rejected', 'Technical Assessment', 'Disqualified'],
        'Hired': ['Disqualified'],  # Can only be disqualified after hiring
        'Rejected': [],  # Terminal status
        'Disqualified': []  # Terminal status
    }
    
    # Status priorities for determining latest meaningful status
    STATUS_PRIORITY = {
        'New': 0,
        'Shortlisted': 1,
        'Technical Assessment': 2,
        'Interviewing': 3,
        'Hired': 4,
        'Rejected': 5,
        'Disqualified': 6
    }
    
    @classmethod
    def add_admin_status_change(
        cls,
        current_history: List[Dict[str, Any]],
        new_status: str,
        changed_by: str,
        reason: Optional[str] = None,
        previous_status: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Record a status change from admin UI without transition guards."""
        new_entry = {
            "status": new_status,
            "date": datetime.now(timezone.utc),
            "changedBy": changed_by,
            "reason": reason or f"Status changed to {new_status}",
            "metadata": {
                **(metadata or {}),
                "source": "admin_update",
            },
        }
        if previous_status:
            new_entry["metadata"]["previousStatus"] = previous_status

        updated_history = list(current_history or [])
        updated_history.append(new_entry)
        return updated_history

    @classmethod
    def add_status_change(
        cls,
        current_history: List[Dict[str, Any]],
        new_status: str,
        changed_by: str,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Add a new status change to the history
        
        Args:
            current_history: Existing status history
            new_status: New status to add
            changed_by: User ID making the change
            reason: Optional reason for the change
            metadata: Optional additional context
            
        Returns:
            Updated status history list
        """
        # Get the current status
        current_status = cls.get_current_status(current_history)
        
        # Validate transition
        if not cls.is_valid_transition(current_status, new_status):
            raise ValueError(f"Invalid status transition from '{current_status}' to '{new_status}'")
        
        # Create new history entry
        new_entry = {
            'status': new_status,
            'date': datetime.now(timezone.utc),
            'changedBy': changed_by,
            'reason': reason or f"Status changed to {new_status}",
            'metadata': metadata or {}
        }
        
        # Add previous status to metadata
        if current_status:
            new_entry['metadata']['previousStatus'] = current_status
        
        # Add to history
        updated_history = current_history.copy() if current_history else []
        updated_history.append(new_entry)
        
        return updated_history
    
    @classmethod
    def get_current_status(cls, status_history: List[Dict[str, Any]]) -> Optional[str]:
        """Get the current status from history"""
        if not status_history:
            return None
            
        # Sort by date and get the latest
        sorted_history = sorted(status_history, key=lambda x: x['date'])
        return sorted_history[-1]['status'] if sorted_history else None
    
    @classmethod
    def is_valid_transition(cls, from_status: Optional[str], to_status: str) -> bool:
        """Check if a status transition is valid"""
        if from_status is None:
            return to_status == 'New'
        
        return to_status in cls.VALID_TRANSITIONS.get(from_status, [])
    
    @classmethod
    def get_status_date(cls, status_history: List[Dict[str, Any]], status: str) -> Optional[datetime]:
        """Get the date when a specific status was first reached"""
        for entry in status_history:
            if entry['status'] == status:
                return entry['date']
        return None
    
    @classmethod
    def get_status_duration(cls, status_history: List[Dict[str, Any]], status: str) -> Optional[int]:
        """Get how many days an application spent in a specific status"""
        status_entries = [entry for entry in status_history if entry['status'] == status]
        if not status_entries:
            return None
        
        start_date = status_entries[0]['date']
        
        # Find the next status change after this status
        sorted_history = sorted(status_history, key=lambda x: x['date'])
        status_index = next(i for i, entry in enumerate(sorted_history) if entry['status'] == status)
        
        if status_index + 1 < len(sorted_history):
            end_date = sorted_history[status_index + 1]['date']
        else:
            end_date = datetime.now(timezone.utc)
        
        return (end_date - start_date).days
    
    @classmethod
    def get_total_processing_time(cls, status_history: List[Dict[str, Any]]) -> Optional[int]:
        """Get total processing time from application to current status"""
        if not status_history:
            return None
        
        sorted_history = sorted(status_history, key=lambda x: x['date'])
        start_date = sorted_history[0]['date']
        end_date = sorted_history[-1]['date']
        
        return (end_date - start_date).days
    
    @classmethod
    def initialize_status_history(
        cls,
        initial_status: str = 'New',
        applied_date: Optional[datetime] = None,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Initialize status history for a new application"""
        return [{
            'status': initial_status,
            'date': applied_date or datetime.now(timezone.utc),
            'changedBy': user_id,
            'reason': 'Application submitted',
            'metadata': {
                'source': 'application_submission',
                'automatedChange': True
            }
        }]
    
    @classmethod
    def migrate_legacy_dates(
        cls,
        legacy_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Migrate legacy date fields to status history format
        
        Args:
            legacy_data: Dictionary with legacy date fields
            
        Returns:
            Status history list
        """
        status_history = []
        
        # Map legacy fields to statuses
        date_field_mapping = [
            ('appliedDate', 'New', 'Application submitted'),
            ('shortlistedDate', 'Shortlisted', 'Candidate shortlisted'),
            ('assessmentDate', 'Technical Assessment', 'Technical assessment scheduled'),
            ('interviewDate', 'Interviewing', 'Interview scheduled'),
            ('hireDate', 'Hired', 'Candidate hired'),
            ('disqualifiedDate', 'Disqualified', 'Candidate disqualified')
        ]
        
        for field_name, status, default_reason in date_field_mapping:
            if field_name in legacy_data and legacy_data[field_name]:
                date_value = legacy_data[field_name]
                
                # Handle different date formats
                if isinstance(date_value, str):
                    try:
                        date_value = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                    except ValueError:
                        continue
                elif not isinstance(date_value, datetime):
                    continue
                
                # Build metadata based on the status
                metadata = {
                    'source': 'legacy_migration',
                    'migratedFrom': field_name
                }
                
                # Add status-specific metadata
                if status == 'Technical Assessment' and 'assessmentScore' in legacy_data:
                    metadata['assessmentScore'] = legacy_data['assessmentScore']
                elif status == 'Interviewing' and 'interviewer' in legacy_data:
                    metadata['interviewer'] = legacy_data['interviewer']
                elif status == 'Disqualified' and 'disqualifiedReason' in legacy_data:
                    metadata['disqualificationReason'] = legacy_data['disqualifiedReason']
                elif status == 'Hired' and 'startDate' in legacy_data:
                    metadata['startDate'] = legacy_data['startDate']
                
                status_history.append({
                    'status': status,
                    'date': date_value,
                    'changedBy': None,  # Unknown for legacy data
                    'reason': default_reason,
                    'metadata': metadata
                })
        
        # Sort by date
        status_history.sort(key=lambda x: x['date'])
        
        return status_history
    
    @classmethod
    def sync_legacy_fields(
        cls,
        status_history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Sync status history back to legacy date fields for backward compatibility
        
        Args:
            status_history: Current status history
            
        Returns:
            Dictionary with legacy date fields
        """
        legacy_fields = {}
        
        # Map statuses to legacy fields
        status_to_field = {
            'New': 'appliedDate',
            'Shortlisted': 'shortlistedDate',
            'Technical Assessment': 'assessmentDate',
            'Interviewing': 'interviewDate',
            'Hired': 'hireDate',
            'Disqualified': 'disqualifiedDate'
        }
        
        for entry in status_history:
            status = entry['status']
            if status in status_to_field:
                field_name = status_to_field[status]
                legacy_fields[field_name] = entry['date']
                
                # Add related metadata fields
                metadata = entry.get('metadata', {})
                if status == 'Technical Assessment' and 'assessmentScore' in metadata:
                    legacy_fields['assessmentScore'] = metadata['assessmentScore']
                elif status == 'Interviewing' and 'interviewer' in metadata:
                    legacy_fields['interviewer'] = metadata['interviewer']
                elif status == 'Disqualified' and 'disqualificationReason' in metadata:
                    legacy_fields['disqualifiedReason'] = metadata['disqualificationReason']
                elif status == 'Hired' and 'startDate' in metadata:
                    legacy_fields['startDate'] = metadata['startDate']
        
        return legacy_fields
    
    @classmethod
    def get_status_summary(cls, status_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Get a summary of the status history for reporting
        
        Returns:
            Dictionary with status summary information
        """
        if not status_history:
            return {
                'currentStatus': None,
                'totalStatusChanges': 0,
                'totalProcessingDays': 0,
                'statusBreakdown': {}
            }
        
        sorted_history = sorted(status_history, key=lambda x: x['date'])
        current_status = sorted_history[-1]['status']
        
        # Calculate processing time
        start_date = sorted_history[0]['date']
        end_date = sorted_history[-1]['date']
        total_days = (end_date - start_date).days
        
        # Count status occurrences
        status_breakdown = {}
        for entry in status_history:
            status = entry['status']
            if status not in status_breakdown:
                status_breakdown[status] = {
                    'count': 0,
                    'firstDate': entry['date'],
                    'lastDate': entry['date']
                }
            status_breakdown[status]['count'] += 1
            status_breakdown[status]['lastDate'] = max(
                status_breakdown[status]['lastDate'], 
                entry['date']
            )
            status_breakdown[status]['firstDate'] = min(
                status_breakdown[status]['firstDate'], 
                entry['date']
            )
        
        return {
            'currentStatus': current_status,
            'totalStatusChanges': len(status_history) - 1,  # Exclude initial status
            'totalProcessingDays': total_days,
            'statusBreakdown': status_breakdown,
            'applicationDate': start_date,
            'lastUpdated': end_date
        }


CANONICAL_APPLICATION_STATUSES = [
    "New",
    "Shortlisted",
    "Technical Assessment",
    "Interviewing",
    "Hired",
    "Rejected",
    "Disqualified",
]

_STATUS_ALIAS_MAP = {
    "new": "New",
    "shortlisted": "Shortlisted",
    "shortlist": "Shortlisted",
    "technicalassessment": "Technical Assessment",
    "technical assessment": "Technical Assessment",
    "assessment": "Technical Assessment",
    "interviewing": "Interviewing",
    "interview": "Interviewing",
    "hired": "Hired",
    "rejected": "Rejected",
    "disqualified": "Disqualified",
}

_STATUS_QUERY_VARIANTS = {
    "New": ["New", "new", "NEW"],
    "Shortlisted": ["Shortlisted", "shortlisted", "SHORTLISTED"],
    "Technical Assessment": [
        "Technical Assessment",
        "technical assessment",
        "technical_assessment",
        "technical-assessment",
        "Assessment",
    ],
    "Interviewing": ["Interviewing", "interviewing", "INTERVIEWING"],
    "Hired": ["Hired", "hired", "HIRED"],
    "Rejected": ["Rejected", "rejected", "REJECTED"],
    "Disqualified": ["Disqualified", "disqualified", "DISQUALIFIED"],
}


def normalize_application_status(
    status: Optional[str],
    default: str = "New",
) -> str:
    """Map legacy or inconsistent status strings to canonical pipeline values."""
    if not status or not str(status).strip():
        return default

    raw = str(status).strip()
    if raw in CANONICAL_APPLICATION_STATUSES:
        return raw

    alias_key = raw.lower().replace("_", " ").replace("-", " ")
    alias_key_compact = alias_key.replace(" ", "")
    return _STATUS_ALIAS_MAP.get(alias_key, _STATUS_ALIAS_MAP.get(alias_key_compact, raw))


def application_status_match(canonical_status: str) -> Dict[str, Any]:
    """MongoDB filter for status, tolerating legacy casing in stored documents."""
    normalized = normalize_application_status(canonical_status, canonical_status)
    variants = _STATUS_QUERY_VARIANTS.get(normalized, [normalized])
    if len(variants) == 1:
        return {"status": variants[0]}
    return {"status": {"$in": variants}}


def ensure_status_history(existing: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return status history for an application, migrating legacy dates when needed."""
    history = existing.get("statusHistory") or []
    if history:
        return list(history)

    migrated = StatusHistoryManager.migrate_legacy_dates(existing)
    if migrated:
        return migrated

    initial_status = normalize_application_status(existing.get("status"), "New")
    return StatusHistoryManager.initialize_status_history(initial_status=initial_status)


def build_admin_status_update(
    existing: Dict[str, Any],
    new_status: str,
    changed_by: str,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build $set fields for an admin-driven status change, including history and legacy dates.
    Admin updates may use any transition (e.g. Rejected -> Shortlisted).
    """
    normalized_status = normalize_application_status(new_status)
    previous_status = normalize_application_status(existing.get("status"), "New")
    current_time = datetime.now(timezone.utc)

    update_data: Dict[str, Any] = {
        "status": normalized_status,
        "updatedAt": current_time,
    }

    if normalized_status == previous_status:
        return update_data

    current_history = ensure_status_history(existing)
    updated_history = StatusHistoryManager.add_admin_status_change(
        current_history=current_history,
        new_status=normalized_status,
        changed_by=changed_by,
        reason=reason or f"Status changed to {normalized_status}",
        previous_status=previous_status,
    )
    legacy_fields = StatusHistoryManager.sync_legacy_fields(updated_history)

    update_data["statusHistory"] = updated_history
    update_data.update(legacy_fields)
    return update_data
