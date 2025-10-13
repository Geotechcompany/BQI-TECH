from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime
import logging

from ..database import get_database
from ..auth import get_current_admin_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/broadcast-lists", tags=["broadcast-lists"])

def to_object_id(id_str: str) -> ObjectId:
    """Convert string ID to ObjectId"""
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")

@router.get("/")
async def list_broadcast_lists(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    current_admin: dict = Depends(get_current_admin_user)
):
    """Get all broadcast lists"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Get total count
        total_count = await db.broadcast_lists.count_documents({})
        
        # Get broadcast lists with pagination
        cursor = db.broadcast_lists.find({}).skip(skip).limit(limit)
        broadcast_lists = []
        
        async for doc in cursor:
            # Get user count for each list
            user_count = await db.broadcast_lists_users.count_documents({
                "broadcast_list_id": doc["_id"]
            })
            
            broadcast_lists.append({
                "_id": str(doc["_id"]),
                "name": doc["name"],
                "description": doc.get("description", ""),
                "userCount": user_count,
                "createdAt": doc["createdAt"],
                "updatedAt": doc["updatedAt"],
                "createdBy": str(doc["createdBy"])
            })
        
        return {
            "broadcastLists": broadcast_lists,
            "total": total_count,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Error listing broadcast lists: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list broadcast lists")

@router.post("/")
async def create_broadcast_list(
    request: Request,
    broadcast_list: Dict[str, Any],
    current_admin: dict = Depends(get_current_admin_user)
):
    """Create a new broadcast list"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Validate required fields
        if not broadcast_list.get("name"):
            raise HTTPException(status_code=400, detail="Name is required")
        
        if not broadcast_list.get("userIds") or not isinstance(broadcast_list["userIds"], list):
            raise HTTPException(status_code=400, detail="User IDs are required")
        
        now = datetime.utcnow()
        
        # Create the broadcast list
        list_doc = {
            "name": broadcast_list["name"],
            "description": broadcast_list.get("description", ""),
            "createdAt": now,
            "updatedAt": now,
            "createdBy": str(current_admin["_id"])
        }
        
        result = await db.broadcast_lists.insert_one(list_doc)
        list_id = result.inserted_id
        
        # Add users to the broadcast list
        user_docs = []
        for user_id in broadcast_list["userIds"]:
            user_docs.append({
                "broadcast_list_id": list_id,
                "user_id": ObjectId(user_id),
                "addedAt": now,
                "addedBy": str(current_admin["_id"])
            })
        
        if user_docs:
            await db.broadcast_lists_users.insert_many(user_docs)
        
        return {
            "id": str(list_id),
            "name": broadcast_list["name"],
            "description": broadcast_list.get("description", ""),
            "userCount": len(broadcast_list["userIds"]),
            "createdAt": now,
            "updatedAt": now
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating broadcast list: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create broadcast list")

@router.get("/{list_id}")
async def get_broadcast_list(
    request: Request,
    list_id: str,
    current_admin: dict = Depends(get_current_admin_user)
):
    """Get a specific broadcast list"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        list_doc = await db.broadcast_lists.find_one({"_id": to_object_id(list_id)})
        if not list_doc:
            raise HTTPException(status_code=404, detail="Broadcast list not found")
        
        # Get user count
        user_count = await db.broadcast_lists_users.count_documents({
            "broadcast_list_id": to_object_id(list_id)
        })
        
        return {
            "_id": str(list_doc["_id"]),
            "name": list_doc["name"],
            "description": list_doc.get("description", ""),
            "userCount": user_count,
            "createdAt": list_doc["createdAt"],
            "updatedAt": list_doc["updatedAt"],
            "createdBy": str(list_doc["createdBy"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting broadcast list: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get broadcast list")

@router.put("/{list_id}")
async def update_broadcast_list(
    request: Request,
    list_id: str,
    update_data: Dict[str, Any],
    current_admin: dict = Depends(get_current_admin_user)
):
    """Update a broadcast list"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Check if list exists
        existing_list = await db.broadcast_lists.find_one({"_id": to_object_id(list_id)})
        if not existing_list:
            raise HTTPException(status_code=404, detail="Broadcast list not found")
        
        # Update the list
        update_doc = {
            "updatedAt": datetime.utcnow()
        }
        
        if "name" in update_data:
            update_doc["name"] = update_data["name"]
        if "description" in update_data:
            update_doc["description"] = update_data["description"]
        
        await db.broadcast_lists.update_one(
            {"_id": to_object_id(list_id)},
            {"$set": update_doc}
        )
        
        # Update users if provided
        if "userIds" in update_data and isinstance(update_data["userIds"], list):
            # Remove existing users
            await db.broadcast_lists_users.delete_many({
                "broadcast_list_id": to_object_id(list_id)
            })
            
            # Add new users
            if update_data["userIds"]:
                user_docs = []
                for user_id in update_data["userIds"]:
                    user_docs.append({
                        "broadcast_list_id": to_object_id(list_id),
                        "user_id": ObjectId(user_id),
                        "addedAt": datetime.utcnow(),
                        "addedBy": str(current_admin["_id"])
                    })
                
                await db.broadcast_lists_users.insert_many(user_docs)
        
        return {"message": "Broadcast list updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating broadcast list: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update broadcast list")

@router.delete("/{list_id}")
async def delete_broadcast_list(
    request: Request,
    list_id: str,
    current_admin: dict = Depends(get_current_admin_user)
):
    """Delete a broadcast list"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Check if list exists
        existing_list = await db.broadcast_lists.find_one({"_id": to_object_id(list_id)})
        if not existing_list:
            raise HTTPException(status_code=404, detail="Broadcast list not found")
        
        # Delete the list and all associated users
        await db.broadcast_lists.delete_one({"_id": to_object_id(list_id)})
        await db.broadcast_lists_users.delete_many({
            "broadcast_list_id": to_object_id(list_id)
        })
        
        return {"message": "Broadcast list deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting broadcast list: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete broadcast list")

@router.get("/{list_id}/users")
async def get_broadcast_list_users(
    request: Request,
    list_id: str,
    current_admin: dict = Depends(get_current_admin_user)
):
    """Get users in a broadcast list"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Check if list exists
        existing_list = await db.broadcast_lists.find_one({"_id": to_object_id(list_id)})
        if not existing_list:
            raise HTTPException(status_code=404, detail="Broadcast list not found")
        
        # Get users in the list
        cursor = db.broadcast_lists_users.find({
            "broadcast_list_id": to_object_id(list_id)
        })
        
        user_ids = []
        async for doc in cursor:
            user_ids.append(doc["user_id"])
        
        # Get user details
        users = []
        if user_ids:
            cursor = db.users.find({"_id": {"$in": user_ids}})
            async for user in cursor:
                users.append({
                    "_id": str(user["_id"]),
                    "firstName": user.get("firstName", ""),
                    "lastName": user.get("lastName", ""),
                    "email": user.get("email", ""),
                    "username": user.get("username", "")
                })
        
        return {"users": users}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting broadcast list users: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get broadcast list users")