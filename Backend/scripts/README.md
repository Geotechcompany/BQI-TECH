# Scripts Documentation - BQI Tech Platform

This document provides an overview of all scripts organized in the `/Backend/scripts/` directory.

## 📁 Directory Structure

```
Backend/scripts/
├── migrations/              # Database migration scripts
├── analysis/               # Data analysis and investigation tools  
├── blog/                   # Blog-related utilities
└── utilities/              # General purpose scripts
```

## 🔄 Migration Scripts (`/scripts/migrations/`)

### **Core Migration Scripts**
1. **`create_backup.py`**
   - **Purpose:** Pre-migration database backup with integrity verification
   - **Features:** JSON export, metadata tracking, timestamp generation
   - **Usage:** `python create_backup.py`

2. **`fixed_status_history_migration.py`**
   - **Purpose:** Enhanced status history migration with date parsing fixes  
   - **Features:** Timezone handling, date normalization, rollback support
   - **Usage:** `python fixed_status_history_migration.py [--rollback]`

3. **`complete_job_reference_migration.py`**
   - **Purpose:** Full job reference normalization migration
   - **Features:** Missing job creation, legacy app updates, 100% coverage
   - **Usage:** `python complete_job_reference_migration.py`

4. **`fix_jobid_types.py`**
   - **Purpose:** ObjectId/string type mismatch resolver
   - **Features:** Type validation, automatic conversion, verification
   - **Usage:** `python fix_jobid_types.py`

### **Job Reference System Scripts**
5. **`job_reference_system.py`**
   - **Purpose:** Core job reference resolution functions
   - **Features:** Dynamic title lookup, data extraction, testing utilities
   - **Usage:** `python job_reference_system.py`

6. **`admin_job_reference_integration.py`**
   - **Purpose:** Backend API integration for job reference system
   - **Features:** Admin router enhancements, API endpoint updates
   - **Usage:** Integration script (run as part of deployment)

### **Legacy Migration Scripts**
7. **`add_status_history.py`**
   - **Purpose:** Original status history migration script
   - **Status:** Superseded by `fixed_status_history_migration.py`
   - **Note:** Kept for reference and rollback scenarios

8. **`implement_job_reference_system.py`**
   - **Purpose:** Initial job reference system implementation
   - **Status:** Replaced by `complete_job_reference_migration.py`

9. **`fix_job_reference_issues.py`**
   - **Purpose:** Job reference troubleshooting and fixes
   - **Features:** Issue detection, repair utilities

## 📊 Analysis Scripts (`/scripts/`)

### **Migration Analysis**
1. **`migration_summary.py`**
   - **Purpose:** Comprehensive migration reporting tool
   - **Features:** Coverage statistics, integrity checks, readiness assessment
   - **Usage:** `python migration_summary.py`

### **Data Investigation**
2. **`investigate_missing_jobids.py`**
   - **Purpose:** Job reference investigation and analysis
   - **Features:** Missing reference detection, type analysis
   - **Usage:** `python investigate_missing_jobids.py`

3. **`investigate_beatrice_app.py`**
   - **Purpose:** Specific application analysis tools
   - **Features:** Individual app deep-dive, data structure analysis
   - **Usage:** `python investigate_beatrice_app.py`

4. **`check_lucy.py`**
   - **Purpose:** Database investigation utilities
   - **Features:** Record lookup, data validation
   - **Usage:** `python check_lucy.py`

### **Data Validation**
5. **`check_position_consistency.py`**
   - **Purpose:** Position data validation
   - **Features:** Consistency checks, format validation
   - **Usage:** `python check_position_consistency.py`

6. **`analyze_data_evolution.py`**
   - **Purpose:** Data structure evolution analysis
   - **Features:** Schema change tracking, compatibility analysis
   - **Usage:** `python analyze_data_evolution.py`

7. **`check_shortlisted_data.py`**
   - **Purpose:** Shortlisted applications analysis
   - **Features:** Status-specific data validation
   - **Usage:** `python check_shortlisted_data.py`

8. **`check_trainee_apps.py`**
   - **Purpose:** Trainee application data validation
   - **Features:** Role-specific analysis, data structure verification
   - **Usage:** `python check_trainee_apps.py`

## 📝 Blog Scripts (`/scripts/`)

9. **`test_blog_endpoint.py`**
   - **Purpose:** Blog API endpoint testing
   - **Features:** CRUD operations testing
   - **Usage:** `python test_blog_endpoint.py`

10. **`check_blog_post.py`**
    - **Purpose:** Blog post validation
    - **Features:** Content validation, metadata checks
    - **Usage:** `python check_blog_post.py`

11. **`check_blog_structure.py`**
    - **Purpose:** Blog database structure validation
    - **Features:** Schema validation, relationship checks
    - **Usage:** `python check_blog_structure.py`

12. **`create_test_blog_post.py`**
    - **Purpose:** Test blog post creation utility
    - **Features:** Sample data generation
    - **Usage:** `python create_test_blog_post.py`

13. **`fix_blog_slug.py`**
    - **Purpose:** Blog slug repair utility
    - **Features:** URL slug generation and validation
    - **Usage:** `python fix_blog_slug.py`

## 🔧 Utility Scripts (`/scripts/`)

14. **`check_applications.py`**
    - **Purpose:** General application data validation
    - **Features:** Data integrity checks, format validation
    - **Usage:** `python check_applications.py`

15. **`check_posts.py`**
    - **Purpose:** Post data validation utility
    - **Features:** Content validation, metadata verification
    - **Usage:** `python check_posts.py`

16. **`link_applications_to_users.py`**
    - **Purpose:** User-application relationship management
    - **Features:** Relationship creation, validation
    - **Usage:** `python link_applications_to_users.py`

17. **`test_questions_api.py`**
    - **Purpose:** Questions API testing utility
    - **Features:** API endpoint validation
    - **Usage:** `python test_questions_api.py`

## 🏃‍♂️ Running Scripts

### **Prerequisites**
```bash
# Activate virtual environment
& "C:\Users\VictorOngeto\Documents\Github - BQI\BQI-TECH-WEBSITE\.venv\Scripts\Activate.ps1"

# Set Python path
$env:PYTHONPATH="C:\Users\VictorOngeto\Documents\Github - BQI\BQI-TECH-WEBSITE\Backend"

# Navigate to Backend directory
cd "C:\Users\VictorOngeto\Documents\Github - BQI\BQI-TECH-WEBSITE\Backend"
```

### **Common Usage Patterns**

#### **Migration Execution**
```bash
# 1. Create backup
python scripts/migrations/create_backup.py

# 2. Run job reference migration
python scripts/migrations/complete_job_reference_migration.py

# 3. Run status history migration  
python scripts/migrations/fixed_status_history_migration.py

# 4. Fix type mismatches
python scripts/migrations/fix_jobid_types.py

# 5. Generate summary
python scripts/migration_summary.py
```

#### **Data Analysis**
```bash
# System overview
python scripts/migration_summary.py

# Investigate specific issues
python scripts/investigate_missing_jobids.py
python scripts/check_position_consistency.py

# Validate data quality
python scripts/check_trainee_apps.py
python scripts/check_shortlisted_data.py
```

## 📋 Script Dependencies

### **Common Dependencies**
- MongoDB connection (`app.database`)
- Python 3.8+
- Virtual environment activation
- Environment variables (.env file)

### **Migration Scripts Dependencies**
- `bson` (ObjectId handling)
- `pymongo` (MongoDB operations)
- `python-dateutil` (Date parsing)
- `asyncio` (Async operations)

### **Analysis Scripts Dependencies**
- All migration dependencies
- `logging` (Output formatting)
- `json` (Data export/import)

## 🚨 Important Notes

### **Safety Guidelines**
1. **Always backup before migrations:** Use `create_backup.py`
2. **Test in development first:** Never run migrations directly on production
3. **Verify results:** Use analysis scripts to validate changes
4. **Keep scripts organized:** Follow the directory structure

### **Rollback Procedures**
- Status history migration: `python fixed_status_history_migration.py --rollback`
- Job reference migration: Restore from backup using MongoDB import
- Type fixes: Scripts are generally safe but backups recommended

### **Performance Considerations**
- Large migrations may take several minutes
- Index creation improves query performance
- Monitor database connections during long-running scripts

---

**Last Updated:** September 5, 2025  
**Maintainer:** Victor Ongeto  
**Total Scripts:** 17 organized scripts across 4 categories
