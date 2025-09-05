#!/usr/bin/env python3
"""
Migration to add status history tracking to applications collection.

This migration:
1. Adds a statusHistory array to track all status changes with dates and metadata
2. Preserves existing status date fields for backward compatibility
3. Initializes statusHistory for existing applications based on their current status and date fields
4. Adds indexes for efficient querying
"""

import asyncio
import sys
import os
from datetime import datetime, timezone
import logging

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'app'))

from app.database import connect_to_database, get_database
from bson import ObjectId

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def migrate_add_status_history():
    """Add status history tracking to applications collection"""
    try:
        # Connect to database
        await connect_to_database()
        db = get_database()
        
        if db is None:
            logger.error("Failed to connect to database")
            return False
            
        applications_collection = db.applications
        
        logger.info("=== STATUS HISTORY MIGRATION ===")
        logger.info(f"Migration started at: {datetime.now(timezone.utc)}")
        
        # Get total count of applications
        total_apps = await applications_collection.count_documents({})
        logger.info(f"Found {total_apps} applications to migrate")
        
        if total_apps == 0:
            logger.info("No applications found, migration complete")
            return True
        
        # Counter for tracking progress
        migrated_count = 0
        batch_size = 100
        
        # Process applications in batches
        cursor = applications_collection.find({})
        
        async for app in cursor:
            try:
                # Skip if statusHistory already exists
                if 'statusHistory' in app and isinstance(app['statusHistory'], list):
                    logger.debug(f"Application {app['_id']} already has statusHistory, skipping")
                    continue
                
                # Build status history from existing data
                status_history = []
                
                # Get basic info
                current_status = app.get('status', 'New')
                applied_date = app.get('appliedDate')
                
                # Initialize with application date (always exists)
                if applied_date:
                    status_history.append({
                        'status': 'New',
                        'date': applied_date,
                        'changedBy': None,  # System/unknown for historical data
                        'reason': 'Application submitted',
                        'metadata': {
                            'source': 'migration',
                            'migratedFrom': 'appliedDate'
                        }
                    })
                
                # Add status transitions based on existing date fields
                status_date_mapping = [
                    ('Shortlisted', app.get('shortlistedDate'), 'shortlistedDate'),
                    ('Technical Assessment', app.get('assessmentDate'), 'assessmentDate'), 
                    ('Interviewing', app.get('interviewDate'), 'interviewDate'),
                    ('Hired', app.get('hireDate'), 'hireDate'),
                    ('Disqualified', app.get('disqualifiedDate'), 'disqualifiedDate')
                ]
                
                for status, date_value, field_name in status_date_mapping:
                    if date_value:
                        # Handle different date formats
                        if isinstance(date_value, str):
                            try:
                                # Try parsing ISO format
                                parsed_date = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                            except ValueError:
                                logger.warning(f"Could not parse date {date_value} for {field_name}, skipping")
                                continue
                        elif isinstance(date_value, datetime):
                            parsed_date = date_value
                        else:
                            logger.warning(f"Unknown date format {type(date_value)} for {field_name}, skipping")
                            continue
                        
                        # Add metadata based on status
                        metadata = {
                            'source': 'migration',
                            'migratedFrom': field_name
                        }
                        
                        # Add status-specific metadata
                        if status == 'Technical Assessment' and app.get('assessmentScore'):
                            metadata['assessmentScore'] = app.get('assessmentScore')
                        elif status == 'Interviewing' and app.get('interviewer'):
                            metadata['interviewer'] = app.get('interviewer')
                        elif status == 'Disqualified' and app.get('disqualifiedReason'):
                            metadata['reason'] = app.get('disqualifiedReason')
                        elif status == 'Hired' and app.get('startDate'):
                            metadata['startDate'] = app.get('startDate')
                        
                        status_history.append({
                            'status': status,
                            'date': parsed_date,
                            'changedBy': None,  # Unknown for historical data
                            'reason': f'Status changed to {status}',
                            'metadata': metadata
                        })
                
                # If current status is different from what we've tracked, add it
                latest_status_in_history = status_history[-1]['status'] if status_history else 'New'
                if current_status != latest_status_in_history:
                    # Use the most recent update time or current time
                    status_change_date = app.get('updatedAt') or datetime.now(timezone.utc)
                    
                    status_history.append({
                        'status': current_status,
                        'date': status_change_date,
                        'changedBy': None,  # Unknown for historical data
                        'reason': f'Current status: {current_status}',
                        'metadata': {
                            'source': 'migration',
                            'migratedFrom': 'current_status'
                        }
                    })
                
                # Sort status history by date
                status_history.sort(key=lambda x: x['date'])
                
                # Update the application with status history
                update_result = await applications_collection.update_one(
                    {'_id': app['_id']},
                    {
                        '$set': {
                            'statusHistory': status_history,
                            'migratedAt': datetime.now(timezone.utc),
                            'statusHistoryVersion': '1.0'
                        }
                    }
                )
                
                if update_result.modified_count > 0:
                    migrated_count += 1
                    if migrated_count % 10 == 0:
                        logger.info(f"Migrated {migrated_count}/{total_apps} applications...")
                else:
                    logger.warning(f"Failed to update application {app['_id']}")
                    
            except Exception as e:
                logger.error(f"Error migrating application {app.get('_id', 'unknown')}: {e}")
                continue
        
        logger.info(f"Migration completed: {migrated_count} applications migrated")
        
        # Create indexes for efficient querying
        logger.info("Creating indexes for statusHistory...")
        
        try:
            # Index on statusHistory.status for filtering by status
            await applications_collection.create_index([("statusHistory.status", 1)])
            logger.info("Created index on statusHistory.status")
            
            # Index on statusHistory.date for sorting by date
            await applications_collection.create_index([("statusHistory.date", -1)])
            logger.info("Created index on statusHistory.date")
            
            # Compound index for efficient status + date queries
            await applications_collection.create_index([
                ("statusHistory.status", 1), 
                ("statusHistory.date", -1)
            ])
            logger.info("Created compound index on statusHistory.status + date")
            
            # Index on statusHistory.changedBy for admin queries
            await applications_collection.create_index([("statusHistory.changedBy", 1)])
            logger.info("Created index on statusHistory.changedBy")
            
        except Exception as e:
            logger.warning(f"Error creating indexes: {e}")
        
        # Verify migration
        logger.info("Verifying migration...")
        migrated_apps = await applications_collection.count_documents({'statusHistory': {'$exists': True}})
        logger.info(f"Verification: {migrated_apps} applications now have statusHistory")
        
        if migrated_apps == total_apps:
            logger.info("✅ Migration completed successfully!")
            return True
        else:
            logger.warning(f"⚠️ Migration incomplete: {migrated_apps}/{total_apps} migrated")
            return False
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def rollback_status_history_migration():
    """Rollback the status history migration (remove statusHistory fields)"""
    try:
        await connect_to_database()
        db = get_database()
        
        if db is None:
            logger.error("Failed to connect to database")
            return False
            
        applications_collection = db.applications
        
        logger.info("=== ROLLING BACK STATUS HISTORY MIGRATION ===")
        
        # Remove statusHistory fields
        result = await applications_collection.update_many(
            {},
            {
                '$unset': {
                    'statusHistory': '',
                    'migratedAt': '',
                    'statusHistoryVersion': ''
                }
            }
        )
        
        logger.info(f"Rollback completed: {result.modified_count} applications updated")
        
        # Drop the indexes we created
        try:
            await applications_collection.drop_index([("statusHistory.status", 1)])
            await applications_collection.drop_index([("statusHistory.date", -1)])
            await applications_collection.drop_index([("statusHistory.status", 1), ("statusHistory.date", -1)])
            await applications_collection.drop_index([("statusHistory.changedBy", 1)])
            logger.info("Dropped statusHistory indexes")
        except Exception as e:
            logger.warning(f"Error dropping indexes: {e}")
        
        return True
        
    except Exception as e:
        logger.error(f"Rollback failed: {e}")
        return False

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Status History Migration')
    parser.add_argument('--rollback', action='store_true', help='Rollback the migration')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be migrated without making changes')
    
    args = parser.parse_args()
    
    if args.rollback:
        success = asyncio.run(rollback_status_history_migration())
    else:
        success = asyncio.run(migrate_add_status_history())
    
    if success:
        logger.info("Operation completed successfully")
        sys.exit(0)
    else:
        logger.error("Operation failed")
        sys.exit(1)
