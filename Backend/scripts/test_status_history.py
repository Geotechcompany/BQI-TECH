#!/usr/bin/env python3
"""
Status History System Test Script

This script tests the status history migration and functionality to ensure
everything works correctly before deploying to production.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
import json
import logging

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'app'))

from app.database import connect_to_database, get_database
from app.utils.status_history import StatusHistoryManager
from bson import ObjectId

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_status_history_system():
    """Comprehensive test of the status history system"""
    try:
        # Connect to database
        await connect_to_database()
        db = get_database()
        
        if db is None:
            logger.error("Failed to connect to database")
            return False
            
        applications_collection = db.applications
        
        logger.info("=== STATUS HISTORY SYSTEM TESTS ===")
        logger.info(f"Test started at: {datetime.now(timezone.utc)}")
        
        # Test 1: StatusHistoryManager utility functions
        logger.info("\n1. Testing StatusHistoryManager utility functions...")
        
        # Test initialization
        initial_history = StatusHistoryManager.initialize_status_history(
            initial_status="New",
            applied_date=datetime.now(timezone.utc) - timedelta(days=5),
            user_id="test_user_123"
        )
        
        assert len(initial_history) == 1
        assert initial_history[0]['status'] == 'New'
        assert initial_history[0]['changedBy'] == 'test_user_123'
        logger.info("✅ Status history initialization works correctly")
        
        # Test adding status changes
        updated_history = StatusHistoryManager.add_status_change(
            current_history=initial_history,
            new_status="Shortlisted",
            changed_by="admin_user",
            reason="Strong technical background",
            metadata={"reviewScore": 8.5, "reviewerNotes": "Excellent candidate"}
        )
        
        assert len(updated_history) == 2
        assert updated_history[1]['status'] == 'Shortlisted'
        assert updated_history[1]['changedBy'] == 'admin_user'
        assert updated_history[1]['metadata']['previousStatus'] == 'New'
        logger.info("✅ Status change addition works correctly")
        
        # Test invalid transition
        try:
            StatusHistoryManager.add_status_change(
                current_history=updated_history,
                new_status="Hired",  # Invalid: can't go directly from Shortlisted to Hired
                changed_by="admin_user"
            )
            assert False, "Should have raised ValueError for invalid transition"
        except ValueError:
            logger.info("✅ Invalid transition validation works correctly")
        
        # Test valid transition chain
        updated_history = StatusHistoryManager.add_status_change(
            current_history=updated_history,
            new_status="Technical Assessment",
            changed_by="admin_user"
        )
        
        updated_history = StatusHistoryManager.add_status_change(
            current_history=updated_history,
            new_status="Interviewing",
            changed_by="admin_user",
            metadata={"interviewer": "John Smith", "interviewType": "technical"}
        )
        
        updated_history = StatusHistoryManager.add_status_change(
            current_history=updated_history,
            new_status="Hired",
            changed_by="admin_user",
            metadata={"startDate": "2025-06-01", "salary": "75000"}
        )
        
        assert len(updated_history) == 5  # New, Shortlisted, Technical Assessment, Interviewing, Hired
        assert StatusHistoryManager.get_current_status(updated_history) == "Hired"
        logger.info("✅ Complete status transition chain works correctly")
        
        # Test legacy migration
        legacy_data = {
            'appliedDate': datetime.now(timezone.utc) - timedelta(days=10),
            'shortlistedDate': datetime.now(timezone.utc) - timedelta(days=8),
            'assessmentDate': datetime.now(timezone.utc) - timedelta(days=5),
            'interviewDate': datetime.now(timezone.utc) - timedelta(days=2),
            'hireDate': datetime.now(timezone.utc),
            'assessmentScore': 85,
            'interviewer': 'Jane Doe'
        }
        
        migrated_history = StatusHistoryManager.migrate_legacy_dates(legacy_data)
        assert len(migrated_history) == 5
        assert migrated_history[0]['status'] == 'New'
        assert migrated_history[-1]['status'] == 'Hired'
        logger.info("✅ Legacy data migration works correctly")
        
        # Test syncing back to legacy fields
        synced_fields = StatusHistoryManager.sync_legacy_fields(migrated_history)
        assert 'appliedDate' in synced_fields
        assert 'shortlistedDate' in synced_fields
        assert 'hireDate' in synced_fields
        logger.info("✅ Legacy field synchronization works correctly")
        
        # Test 2: Database operations with real data
        logger.info("\n2. Testing database operations...")
        
        # Find a sample application to test with
        sample_app = await applications_collection.find_one({})
        
        if sample_app:
            app_id = sample_app['_id']
            logger.info(f"Testing with application ID: {app_id}")
            
            # Test adding status history to existing application
            if 'statusHistory' not in sample_app:
                # Initialize status history based on current data
                current_status = sample_app.get('status', 'New')
                applied_date = sample_app.get('appliedDate', datetime.now(timezone.utc))
                
                initial_history = StatusHistoryManager.initialize_status_history(
                    initial_status='New',
                    applied_date=applied_date,
                    user_id=sample_app.get('userId')
                )
                
                # If current status is not 'New', add that transition
                if current_status != 'New':
                    try:
                        initial_history = StatusHistoryManager.add_status_change(
                            current_history=initial_history,
                            new_status=current_status,
                            changed_by='migration_script',
                            reason=f'Migrated to current status: {current_status}',
                            metadata={'source': 'test_migration'}
                        )
                    except ValueError:
                        # If direct transition is not valid, create a basic history
                        initial_history.append({
                            'status': current_status,
                            'date': sample_app.get('updatedAt', datetime.now(timezone.utc)),
                            'changedBy': 'migration_script',
                            'reason': f'Current status: {current_status}',
                            'metadata': {'source': 'test_migration', 'note': 'Invalid transition, direct assignment'}
                        })
                
                # Update the application with status history
                result = await applications_collection.update_one(
                    {'_id': app_id},
                    {
                        '$set': {
                            'statusHistory': initial_history,
                            'testMigrationAt': datetime.now(timezone.utc)
                        }
                    }
                )
                
                if result.modified_count > 0:
                    logger.info("✅ Status history successfully added to sample application")
                else:
                    logger.warning("⚠️ Failed to update sample application")
            else:
                logger.info("✅ Sample application already has status history")
        
        # Test 3: Query performance with indexes
        logger.info("\n3. Testing query performance...")
        
        # Test status-based queries
        start_time = datetime.now()
        new_apps = await applications_collection.count_documents({'status': 'New'})
        end_time = datetime.now()
        query_time = (end_time - start_time).total_seconds() * 1000
        logger.info(f"✅ Status query completed in {query_time:.2f}ms (found {new_apps} 'New' applications)")
        
        # Test status history queries
        start_time = datetime.now()
        shortlisted_count = await applications_collection.count_documents({
            'statusHistory.status': 'Shortlisted'
        })
        end_time = datetime.now()
        query_time = (end_time - start_time).total_seconds() * 1000
        logger.info(f"✅ Status history query completed in {query_time:.2f}ms (found {shortlisted_count} applications that were shortlisted)")
        
        # Test 4: Data integrity validation
        logger.info("\n4. Testing data integrity...")
        
        # Check for applications with status history
        apps_with_history = await applications_collection.count_documents({
            'statusHistory': {'$exists': True, '$ne': []}
        })
        
        total_apps = await applications_collection.count_documents({})
        
        logger.info(f"Applications with status history: {apps_with_history}/{total_apps}")
        
        if apps_with_history > 0:
            # Sample a few applications and validate their status history
            sample_apps = await applications_collection.find({
                'statusHistory': {'$exists': True, '$ne': []}
            }).limit(5).to_list(length=5)
            
            for app in sample_apps:
                status_history = app.get('statusHistory', [])
                current_db_status = app.get('status')
                history_current_status = StatusHistoryManager.get_current_status(status_history)
                
                if current_db_status == history_current_status:
                    logger.info(f"✅ Application {app['_id']}: Status consistency maintained")
                else:
                    logger.warning(f"⚠️ Application {app['_id']}: Status inconsistency - DB: {current_db_status}, History: {history_current_status}")
        
        # Test 5: Performance benchmarks
        logger.info("\n5. Performance benchmarks...")
        
        # Benchmark status updates
        test_app_data = {
            'jobId': ObjectId(),
            'cvUrl': 'https://test.com/resume.pdf',
            'answers': [{'value': 'Test User'}, {'value': 'test@example.com'}],
            'appliedDate': datetime.now(timezone.utc),
            'status': 'New',
            'position': 'Test Position',
            'userId': ObjectId(),
            'statusHistory': StatusHistoryManager.initialize_status_history(
                initial_status='New',
                applied_date=datetime.now(timezone.utc),
                user_id='test_user'
            )
        }
        
        # Insert test application
        result = await applications_collection.insert_one(test_app_data)
        test_app_id = result.inserted_id
        
        try:
            # Benchmark status update
            start_time = datetime.now()
            
            # Simulate status changes
            statuses = ['Shortlisted', 'Technical Assessment', 'Interviewing', 'Hired']
            for status in statuses:
                current_app = await applications_collection.find_one({'_id': test_app_id})
                current_history = current_app.get('statusHistory', [])
                
                updated_history = StatusHistoryManager.add_status_change(
                    current_history=current_history,
                    new_status=status,
                    changed_by='test_admin',
                    reason=f'Test transition to {status}'
                )
                
                legacy_fields = StatusHistoryManager.sync_legacy_fields(updated_history)
                
                await applications_collection.update_one(
                    {'_id': test_app_id},
                    {
                        '$set': {
                            'status': status,
                            'statusHistory': updated_history,
                            'updatedAt': datetime.now(timezone.utc),
                            **legacy_fields
                        }
                    }
                )
            
            end_time = datetime.now()
            total_time = (end_time - start_time).total_seconds() * 1000
            avg_time = total_time / len(statuses)
            
            logger.info(f"✅ Status update benchmark: {len(statuses)} updates in {total_time:.2f}ms (avg: {avg_time:.2f}ms per update)")
            
        finally:
            # Clean up test application
            await applications_collection.delete_one({'_id': test_app_id})
        
        logger.info("\n=== ALL TESTS COMPLETED SUCCESSFULLY ===")
        return True
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def generate_test_report():
    """Generate a comprehensive test report"""
    try:
        await connect_to_database()
        db = get_database()
        
        if db is None:
            logger.error("Failed to connect to database")
            return
            
        applications_collection = db.applications
        
        logger.info("\n=== STATUS HISTORY SYSTEM REPORT ===")
        
        # Total applications
        total_apps = await applications_collection.count_documents({})
        
        # Applications with status history
        apps_with_history = await applications_collection.count_documents({
            'statusHistory': {'$exists': True, '$ne': []}
        })
        
        # Status distribution
        status_pipeline = [
            {'$group': {'_id': '$status', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        
        status_distribution = await applications_collection.aggregate(status_pipeline).to_list(length=None)
        
        # Applications by status history length
        history_length_pipeline = [
            {'$match': {'statusHistory': {'$exists': True}}},
            {'$project': {'historyLength': {'$size': '$statusHistory'}}},
            {'$group': {'_id': '$historyLength', 'count': {'$sum': 1}}},
            {'$sort': {'_id': 1}}
        ]
        
        history_lengths = await applications_collection.aggregate(history_length_pipeline).to_list(length=None)
        
        # Recent status changes
        recent_changes_pipeline = [
            {'$match': {'statusHistory': {'$exists': True}}},
            {'$unwind': '$statusHistory'},
            {'$match': {'statusHistory.date': {'$gte': datetime.now(timezone.utc) - timedelta(days=30)}}},
            {'$group': {'_id': '$statusHistory.status', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        
        recent_changes = await applications_collection.aggregate(recent_changes_pipeline).to_list(length=None)
        
        print(f"""
STATUS HISTORY SYSTEM REPORT
Generated: {datetime.now(timezone.utc)}

OVERVIEW:
- Total Applications: {total_apps}
- Applications with Status History: {apps_with_history} ({(apps_with_history/total_apps*100):.1f}%)
- Migration Coverage: {(apps_with_history/total_apps*100):.1f}%

CURRENT STATUS DISTRIBUTION:
{chr(10).join([f"- {item['_id']}: {item['count']}" for item in status_distribution])}

STATUS HISTORY COMPLEXITY:
{chr(10).join([f"- {item['_id']} status changes: {item['count']} applications" for item in history_lengths])}

RECENT ACTIVITY (Last 30 days):
{chr(10).join([f"- {item['_id']}: {item['count']} changes" for item in recent_changes]) if recent_changes else "No recent activity recorded"}

RECOMMENDATIONS:
- {'✅ Status history migration is complete' if apps_with_history == total_apps else f'⚠️ {total_apps - apps_with_history} applications still need migration'}
- {'✅ System is ready for production' if apps_with_history > total_apps * 0.9 else '⚠️ Complete migration before production deployment'}
""")
        
    except Exception as e:
        logger.error(f"Failed to generate report: {e}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Status History System Tests')
    parser.add_argument('--test', action='store_true', help='Run comprehensive tests')
    parser.add_argument('--report', action='store_true', help='Generate system report')
    parser.add_argument('--all', action='store_true', help='Run tests and generate report')
    
    args = parser.parse_args()
    
    if args.all or not any([args.test, args.report]):
        # Run both tests and report by default
        success = asyncio.run(test_status_history_system())
        asyncio.run(generate_test_report())
        sys.exit(0 if success else 1)
    elif args.test:
        success = asyncio.run(test_status_history_system())
        sys.exit(0 if success else 1)
    elif args.report:
        asyncio.run(generate_test_report())
        sys.exit(0)
