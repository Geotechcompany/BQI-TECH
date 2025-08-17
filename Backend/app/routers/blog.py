from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from typing import Optional
from app.database import get_database, is_connected
from bson import ObjectId
from datetime import datetime
import json
from ..logger import logger
import re

def generate_slug(title: str) -> str:
    """Generate a URL-friendly slug from a title"""
    # Convert to lowercase and replace spaces with hyphens
    slug = title.lower().strip()
    # Remove special characters
    slug = re.sub(r'[^\w\s-]', '', slug)
    # Replace spaces with hyphens
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug

# Normalize author profile keys from DB (snake_case) to API (camelCase)
def _normalize_author_profile(post: dict) -> None:
    """Mutates the given post dict to ensure authorProfile has camelCase keys.

    - profile_image -> profileImage
    - social_links -> socialLinks
    Safe to call if keys are missing.
    """
    try:
        author_profile = post.get("authorProfile")
        if not isinstance(author_profile, dict):
            return

        # Only set camelCase if not already present to avoid overwriting
        if "profile_image" in author_profile and "profileImage" not in author_profile:
            author_profile["profileImage"] = author_profile.get("profile_image")
        if "social_links" in author_profile and "socialLinks" not in author_profile:
            author_profile["socialLinks"] = author_profile.get("social_links")
    except Exception:
        # Be defensive – never break the response formatting due to normalization
        pass

router = APIRouter(
    tags=["blog"],
    include_in_schema=True
)

@router.get("")
async def get_blog_posts(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = None
):
    """Get public blog posts with pagination and category filter"""
    try:
        logger.info("Received GET /blog request")
        logger.info(f"Query parameters: skip={skip}, limit={limit}, category={category}")
        logger.info(f"Request headers: {dict(request.headers)}")
        
        if not is_connected():
            logger.error("Database not connected")
            raise HTTPException(status_code=503, detail="Database not available")
            
        db = get_database()
        if db is None:
            logger.error("Failed to get database instance")
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Build query to handle both isPublished and published fields
        query = {
            "$or": [
                {"isPublished": True},
                {"published": True}
            ]
        }
        if category:
            query["category"] = category
            
        logger.info(f"MongoDB query: {query}")
        
        # Get posts with pagination
        posts_cursor = db.blogposts.find(query).skip(skip).limit(limit).sort("createdAt", -1)
        posts = await posts_cursor.to_list(length=limit)
        total = await db.blogposts.count_documents(query)
        
        logger.info(f"Found {len(posts)} posts out of {total} total")
        
        # Convert ObjectIds to strings and format dates
        for post in posts:
            post["id"] = str(post.pop("_id"))
            if "createdAt" in post:
                post["createdAt"] = post["createdAt"].isoformat()
            if "updatedAt" in post:
                post["updatedAt"] = post["updatedAt"].isoformat()
            if "publishedAt" in post:
                post["publishedAt"] = post["publishedAt"].isoformat() if isinstance(post["publishedAt"], datetime) else post["publishedAt"]
            
            # Ensure all required fields are present
            post.setdefault("title", "")
            post.setdefault("content", "")
            post.setdefault("excerpt", "")
            post.setdefault("author", {})
            post.setdefault("category", "Uncategorized")
            post.setdefault("tags", [])
            post.setdefault("imageUrl", "")
            post.setdefault("readTime", "")
            
            # Generate slug from title if not present
            if "slug" not in post or not post["slug"]:
                post["slug"] = generate_slug(post["title"])

            # Normalize author profile keys for frontend compatibility
            _normalize_author_profile(post)
        
        response_data = {
            "posts": posts,
            "total": total,
            "page": skip // limit + 1,
            "totalPages": (total + limit - 1) // limit
        }
        
        logger.info("Successfully prepared response")
        
        # Return with CORS headers
        return JSONResponse(
            content=json.loads(json.dumps(response_data)),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
                "Cache-Control": "public, max-age=300"  # Cache for 5 minutes
            }
        )
    except Exception as e:
        logger.error(f"Error in get_blog_posts: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/by-slug/{slug}")
async def get_blog_post_by_slug(
    request: Request,
    slug: str
):
    """Get a specific blog post by slug"""
    try:
        logger.info(f"Received GET /blog/by-slug/{slug} request")
        
        if not is_connected():
            logger.error("Database not connected")
            raise HTTPException(status_code=503, detail="Database not available")
            
        db = get_database()
        if db is None:
            logger.error("Failed to get database instance")
            raise HTTPException(status_code=503, detail="Database not available")
        
        logger.info(f"Searching for blog post with slug: {slug}")
        
        # Query to handle both isPublished and published fields
        post = await db.blogposts.find_one({
            "slug": slug,
            "$or": [
                {"isPublished": True},
                {"published": True}
            ]
        })

        logger.info(f"Query result: {'Found' if post else 'Not Found'}")

        # Fallback: auto-generate slug for posts missing slug and try to match by title
        if not post:
            logger.info("No post matched by slug. Attempting fallback: match generated slug from title and persist slug...")
            try:
                # Find published posts missing slug
                candidates_cursor = db.blogposts.find({
                    "$and": [
                        {"$or": [{"isPublished": True}, {"published": True}]},
                        {"$or": [
                            {"slug": {"$exists": False}},
                            {"slug": None},
                            {"slug": ""}
                        ]}
                    ]
                }).limit(200)
                candidates = await candidates_cursor.to_list(length=200)

                matched = None
                for candidate in candidates:
                    title_value = candidate.get("title") or ""
                    if not title_value:
                        continue
                    generated = generate_slug(title_value)
                    if generated == slug:
                        matched = candidate
                        break

                if matched:
                    logger.info("Found a published post without slug whose generated title slug matches. Backfilling slug in DB.")
                    await db.blogposts.update_one({"_id": matched["_id"]}, {"$set": {"slug": slug}})
                    post = matched
                    post["slug"] = slug
                else:
                    logger.error(f"Blog post not found with slug: {slug}")
                    raise HTTPException(status_code=404, detail="Blog post not found")
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Fallback slug generation search failed: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
            
        # Convert ObjectId to string and format dates
        post["id"] = str(post.pop("_id"))
        if "createdAt" in post and hasattr(post["createdAt"], "isoformat"):
            post["createdAt"] = post["createdAt"].isoformat()
        if "updatedAt" in post and hasattr(post["updatedAt"], "isoformat"):
            post["updatedAt"] = post["updatedAt"].isoformat()
        if "publishedAt" in post and hasattr(post["publishedAt"], "isoformat"):
            post["publishedAt"] = post["publishedAt"].isoformat()
            
        # Handle author field - it's a string ID, not an object
        if "author" in post and isinstance(post["author"], str):
            # Keep as string for now, frontend can handle it
            pass
        else:
            post["author"] = ""
            
        # Ensure all required fields are present with proper defaults
        post.setdefault("title", "")
        post.setdefault("content", "")
        post.setdefault("excerpt", "")
        post.setdefault("category", "Uncategorized")
        post.setdefault("tags", [])
        post.setdefault("imageUrl", "")
        post.setdefault("readTime", "")
        post.setdefault("slug", slug)

        # Normalize author profile keys for frontend compatibility
        _normalize_author_profile(post)
        
        # Remove internal fields that shouldn't be exposed
        post.pop("__v", None)
        
        logger.info(f"Successfully prepared blog post response for slug: {slug}")
            
        # Return with CORS headers
        return JSONResponse(
            content=post,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
                "Cache-Control": "public, max-age=300"  # Cache for 5 minutes
            }
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error in get_blog_post_by_slug: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/{post_id}")
async def get_blog_post_by_id(
    request: Request,
    post_id: str
):
    """Get a specific blog post by ID"""
    try:
        logger.info(f"Received GET /blog/{post_id} request")
        
        if not is_connected():
            raise HTTPException(status_code=503, detail="Database not available")
            
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        try:
            # Query to handle both isPublished and published fields
            post = await db.blogposts.find_one({
                "_id": ObjectId(post_id),
                "$or": [
                    {"isPublished": True},
                    {"published": True}
                ]
            })
        except Exception as e:
            logger.error(f"Invalid post ID format: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid post ID format")
            
        if not post:
            raise HTTPException(status_code=404, detail="Blog post not found")
            
        # Convert ObjectId to string and format dates
        post["id"] = str(post.pop("_id"))
        if "createdAt" in post:
            post["createdAt"] = post["createdAt"].isoformat()
        if "updatedAt" in post:
            post["updatedAt"] = post["updatedAt"].isoformat()
        if "publishedAt" in post:
            post["publishedAt"] = post["publishedAt"].isoformat() if isinstance(post["publishedAt"], datetime) else post["publishedAt"]
            
        # Ensure all required fields are present
        post.setdefault("title", "")
        post.setdefault("content", "")
        post.setdefault("excerpt", "")
        post.setdefault("author", {})
        post.setdefault("category", "Uncategorized")
        post.setdefault("tags", [])
        post.setdefault("imageUrl", "")
        post.setdefault("readTime", "")

        # Normalize author profile keys for frontend compatibility
        _normalize_author_profile(post)
            
        # Return with CORS headers
        return JSONResponse(
            content=json.loads(json.dumps(post)),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
                "Cache-Control": "public, max-age=300"  # Cache for 5 minutes
            }
        )
    except Exception as e:
        logger.error(f"Error in get_blog_post: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))

@router.options("")
@router.options("/{post_id}")
@router.options("/{slug}")
async def options_blog(request: Request):
    """Handle CORS preflight requests for blog endpoints"""
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
            "Access-Control-Max-Age": "3600"
        }
    )

@router.post("")
async def create_blog_post(
    request: Request,
    post_data: dict
):
    """Create a new blog post"""
    try:
        logger.info("Received POST /blog request")
        
        if not is_connected():
            raise HTTPException(status_code=503, detail="Database not available")
            
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Generate slug from title if not provided
        if "title" in post_data and ("slug" not in post_data or not post_data["slug"]):
            post_data["slug"] = generate_slug(post_data["title"])
            
        # Add timestamps
        post_data["createdAt"] = datetime.utcnow()
        post_data["updatedAt"] = datetime.utcnow()
        
        result = await db.blogposts.insert_one(post_data)
        post_data["id"] = str(result.inserted_id)
        
        return JSONResponse(
            content=json.loads(json.dumps(post_data)),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept"
            }
        )
    except Exception as e:
        logger.error(f"Error in create_blog_post: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{post_id}")
async def update_blog_post(
    request: Request,
    post_id: str,
    update_data: dict
):
    """Update a blog post"""
    try:
        logger.info(f"Received PUT /blog/{post_id} request")
        
        if not is_connected():
            raise HTTPException(status_code=503, detail="Database not available")
            
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
            
        # Generate new slug if title is updated
        if "title" in update_data:
            update_data["slug"] = generate_slug(update_data["title"])
            
        # Update timestamp
        update_data["updatedAt"] = datetime.utcnow()
        
        try:
            result = await db.blogposts.update_one(
                {"_id": ObjectId(post_id)},
                {"$set": update_data}
            )
        except Exception as e:
            logger.error(f"Invalid post ID format: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid post ID format")
            
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Blog post not found")
            
        return JSONResponse(
            content={"message": "Blog post updated successfully"},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "PUT, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept"
            }
        )
    except Exception as e:
        logger.error(f"Error in update_blog_post: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e)) 