# Status History Migration Guide

This guide provides step-by-step instructions for implementing the enhanced status history tracking system for job applications.

## Overview

The new status history system provides:
- **Complete audit trail** of all status changes with timestamps
- **User tracking** for who made each change
- **Flexible metadata** for status-specific information
- **Backward compatibility** with existing date fields
- **Robust validation** for status transitions

## Migration Steps

### 1. Backup Current Data

Before starting the migration, create a backup of your current database:

```bash
# Create backup
mongoexport --uri="your_mongodb_connection_string" --collection=applications --out=applications_backup_$(date +%Y%m%d_%H%M%S).json

# Or using MongoDB Compass/Atlas backup features
```

### 2. Run Pre-Migration Tests

Test the migration on a copy of your data:

```bash
cd Backend
python test_status_history.py --test
```

### 3. Execute the Migration

Run the migration script to add status history to existing applications:

```bash
cd Backend
python migrations/add_status_history.py
```

The migration will:
- Add `statusHistory` array to all applications
- Preserve existing status date fields 
- Initialize history based on current status and dates
- Create necessary database indexes
- Validate data integrity

### 4. Verify Migration

Check that the migration completed successfully:

```bash
python test_status_history.py --report
```

This will show:
- Total applications migrated
- Status distribution
- Data integrity validation
- Performance metrics

### 5. Update Application Code

#### Backend Changes

1. **Update imports** in your application routers:
```python
from app.models.application import ApplicationStatusChange
from app.utils.status_history import StatusHistoryManager
```

2. **Replace status update logic** with the new history-aware methods:
```python
# Old way
await db.applications.update_one(
    {"_id": app_id},
    {"$set": {"status": new_status}}
)

# New way
updated_history = StatusHistoryManager.add_status_change(
    current_history=current_history,
    new_status=new_status,
    changed_by=user_id,
    reason="Reason for change"
)

await db.applications.update_one(
    {"_id": app_id},
    {"$set": {
        "status": new_status,
        "statusHistory": updated_history,
        "updatedAt": datetime.now(timezone.utc)
    }}
)
```

#### Frontend Changes

1. **Update TypeScript interfaces** to include status history fields

2. **Add status history components** to admin panels:
```tsx
import { StatusHistoryTimeline } from '@/components/admin/StatusHistoryTimeline';

// In your application view component
<StatusHistoryTimeline 
  statusHistory={application.statusHistory || []}
  showStats={true}
/>
```

3. **Update status change forms** to capture reason and metadata:
```tsx
const handleStatusChange = async (newStatus: string, reason?: string) => {
  await updateApplicationStatus(applicationId, {
    newStatus,
    changedBy: currentUser.id,
    reason,
    metadata: { /* additional context */ }
  });
};
```

### 6. Test the New System

After updating your code:

```bash
# Run comprehensive tests
python test_status_history.py --all

# Test specific application flows
python test_specific_scenarios.py
```

### 7. Monitor and Validate

Once deployed:

1. **Monitor status changes** to ensure they're being tracked correctly
2. **Check data consistency** between status field and status history
3. **Validate query performance** with the new indexes
4. **Review audit trail** for accuracy

## Rollback Procedure

If you need to rollback the migration:

```bash
# Remove status history fields
python migrations/add_status_history.py --rollback

# Restore from backup if necessary
mongoimport --uri="your_mongodb_connection_string" --collection=applications --file=applications_backup_YYYYMMDD_HHMMSS.json --drop
```

## New Features Available

After migration, you'll have access to:

### 1. Complete Audit Trail
```python
# Get all status changes for an application
history = StatusHistoryManager.get_status_summary(app['statusHistory'])
print(f"Total changes: {history['totalStatusChanges']}")
print(f"Current status: {history['currentStatus']}")
```

### 2. Status Transition Validation
```python
# Validate status changes
is_valid = StatusHistoryManager.is_valid_transition('New', 'Hired')  # False
is_valid = StatusHistoryManager.is_valid_transition('New', 'Shortlisted')  # True
```

### 3. Rich Metadata Support
```python
# Add detailed context to status changes
StatusHistoryManager.add_status_change(
    current_history=history,
    new_status='Technical Assessment',
    changed_by='admin_id',
    reason='Strong initial interview performance',
    metadata={
        'assessmentType': 'technical',
        'interviewer': 'John Smith',
        'interviewScore': 8.5,
        'scheduledDate': '2025-06-01'
    }
)
```

### 4. Timeline Visualization
```tsx
// Beautiful timeline component for admin interface
<StatusHistoryTimeline 
  statusHistory={application.statusHistory}
  showStats={true}
  compact={false}
/>
```

### 5. Analytics and Reporting
```python
# Get processing time statistics
avg_time = StatusHistoryManager.get_total_processing_time(history)
shortlist_time = StatusHistoryManager.get_status_duration(history, 'Shortlisted')
```

## Database Schema Changes

The migration adds these fields to the `applications` collection:

```javascript
{
  // ... existing fields ...
  
  // New status history tracking
  statusHistory: [
    {
      status: "Shortlisted",
      date: ISODate("2025-05-28T10:30:00Z"),
      changedBy: "admin_user_id",
      reason: "Strong technical background",
      metadata: {
        previousStatus: "New",
        reviewScore: 8.5,
        reviewerNotes: "Excellent experience"
      }
    }
  ],
  
  // Migration tracking
  migratedAt: ISODate("2025-05-29T15:45:00Z"),
  statusHistoryVersion: "1.0"
}
```

## Performance Considerations

The migration creates these indexes for optimal performance:

```javascript
// Status history indexes
db.applications.createIndex({"statusHistory.status": 1})
db.applications.createIndex({"statusHistory.date": -1})
db.applications.createIndex({"statusHistory.status": 1, "statusHistory.date": -1})
db.applications.createIndex({"statusHistory.changedBy": 1})
```

## Security and Access Control

Consider implementing:

1. **Role-based status changes** - only admins can change certain statuses
2. **Audit log protection** - prevent modification of status history
3. **Sensitive data handling** - encrypt personal information in metadata
4. **Access logging** - track who views status history

## Maintenance

### Regular Maintenance Tasks

1. **Monitor status history size** - large histories may impact performance
2. **Archive old applications** - consider archiving applications older than 2 years
3. **Validate data consistency** - run monthly integrity checks
4. **Update transition rules** - modify `VALID_TRANSITIONS` as business rules change

### Health Checks

```bash
# Weekly health check
python test_status_history.py --report

# Check for data inconsistencies
python validate_status_consistency.py
```

## Support and Troubleshooting

### Common Issues

1. **Status inconsistency**: Current status doesn't match latest in history
   - **Solution**: Run data consistency repair script

2. **Invalid transitions**: Applications have invalid status progressions
   - **Solution**: Review and correct transition rules

3. **Performance issues**: Slow status-based queries
   - **Solution**: Ensure indexes are properly created

4. **Missing history**: Some applications lack status history
   - **Solution**: Re-run migration for specific applications

### Getting Help

1. Check the test script output for detailed error messages
2. Review database logs for any migration errors
3. Use the provided utility functions for common operations
4. Contact development team for complex migration issues

---

**Note**: This migration is designed to be backward compatible. Existing functionality will continue to work while new features become available. The legacy date fields are maintained and automatically synced with the status history.
