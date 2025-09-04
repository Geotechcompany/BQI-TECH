# BQI Tech Platform - MongoDB Database Schema Documentation

## Database Overview

**Database Name:** `BQITECH`  
**Connection:** MongoDB Atlas  
**Driver:** Motor (AsyncIO MongoDB driver for Python)

This document provides a comprehensive overview of the MongoDB collections and their schemas used in the BQI Tech Platform.

## Collections Overview

The database consists of the following main collections:

1. **users** - User accounts and profiles
2. **jobpostings** - Job listings and positions
3. **applications** - Job applications submitted by users
4. **questions** - Dynamic questions for job applications
5. **blog_posts** - Blog content management
6. **notifications** - System-wide notifications
7. **user_notifications** - User-specific notifications
8. **pending_registrations** - Temporary storage for pending user registrations
9. **verification_codes** - Email verification codes
10. **password_resets** - Password reset tokens

---

## Collection Schemas

### 1. Users Collection (`users`)

Stores user account information and profiles.

```javascript
{
  _id: ObjectId,                    // MongoDB ObjectId
  name: String,                     // User's full name
  email: String,                    // Email address (unique index)
  password: String,                 // Hashed password
  role: String,                     // User role: "user", "admin", etc.
  createdAt: Date,                  // Account creation timestamp
  updatedAt: Date,                  // Last update timestamp
  __v: Number,                      // Version field
  emailVerified: Date,              // Email verification timestamp (optional)
  is_verified: Boolean,             // Email verification status
  updated_at: Date                  // Additional update field (optional)
}
```

**Indexes:**
- `email` (unique)

**Example:**
```json
{
  "_id": "6833934f545a3e59dbff6c2c",
  "name": "Geoffrey Audia Aldwin",
  "email": "geoffrey@example.com",
  "password": "hashedpassword123",
  "role": "user",
  "createdAt": "2024-03-19T10:00:00Z",
  "updatedAt": "2024-03-19T10:00:00Z",
  "__v": 0,
  "is_verified": false
}
```

---

### 2. Job Postings Collection (`jobpostings`)

Contains all job listings and their details.

```javascript
{
  _id: ObjectId,                    // MongoDB ObjectId
  title: String,                    // Job title
  description: String,              // Job description
  requirements: [String],           // Array of job requirements
  responsibilities: [String],       // Array of job responsibilities
  location: String,                 // Job location
  type: String,                     // Employment type: "full-time", "part-time", "contract"
  status: String,                   // Job status: "active", "closed", "draft"
  department: String,               // Department (optional)
  salary_range: String,             // Salary range (optional)
  created_at: Date,                 // Creation timestamp
  updated_at: Date,                 // Last update timestamp
  expires_at: Date,                 // Job expiration date (optional)
  posted_at: Date,                  // Publication date (optional)
  questions: [String]               // Array of question IDs (optional)
}
```

**Example:**
```json
{
  "_id": "682b293a27eefc80eae4f51a",
  "title": "Junior Salesforce Developer",
  "description": "We are looking for a motivated Junior Salesforce Developer...",
  "requirements": ["Bachelor's degree", "Salesforce knowledge"],
  "responsibilities": ["Develop Salesforce solutions", "Support end users"],
  "location": "Remote",
  "type": "full-time",
  "status": "active",
  "department": "Engineering",
  "created_at": "2024-03-19T10:00:00Z"
}
```

---

### 3. Applications Collection (`applications`)

Stores job applications submitted by users.

```javascript
{
  _id: ObjectId,                    // MongoDB ObjectId
  jobId: ObjectId,                  // Reference to job posting
  userId: ObjectId,                 // Reference to user (optional)
  cvUrl: String,                    // URL to uploaded CV/resume
  answers: [                        // Array of question answers
    {
      value: Mixed                  // Answer value (any type)
    }
  ],
  appliedDate: Date,                // Application submission date
  status: String,                   // Application status: "New", "Reviewed", "Accepted", "Rejected"
  position: String                  // Job position title
}
```

**Example:**
```json
{
  "_id": "683558b1dd79cc67e0a4926a",
  "jobId": "682b293a27eefc80eae4f51a",
  "cvUrl": "https://dl.dropboxusercontent.com/scl/fi/f17p451wySnmgcdm4cGbc/Resume.pdf",
  "answers": [
    {"value": "5 years"},
    {"value": "JavaScript, Python, Salesforce"}
  ],
  "appliedDate": "2025-05-27T06:16:17.269Z",
  "status": "New",
  "position": "Junior Salesforce Developer",
  "userId": "6833934f545a3e59dbff6c2c"
}
```

---

### 4. Questions Collection (`questions`)

Dynamic questions for job applications.

```javascript
{
  _id: ObjectId,                    // MongoDB ObjectId
  text: String,                     // Question text
  type: String,                     // Question type: "text", "multiple_choice", "checkbox"
  required: Boolean,                // Whether question is required
  options: [String],                // Options for multiple choice (optional)
  order: Number,                    // Display order
  category: String,                 // Question category (optional)
  job_ids: [String],                // Associated job IDs
  created_at: Date,                 // Creation timestamp
  updated_at: Date                  // Last update timestamp
}
```

**Example:**
```json
{
  "_id": "question123",
  "text": "How many years of experience do you have?",
  "type": "text",
  "required": true,
  "order": 1,
  "job_ids": ["682b293a27eefc80eae4f51a"],
  "created_at": "2024-03-19T10:00:00Z"
}
```

---

### 5. Blog Posts Collection (`blog_posts`)

Content management for blog articles.

```javascript
{
  _id: ObjectId,                    // MongoDB ObjectId
  title: String,                    // Article title
  content: String,                  // Article content (HTML/Markdown)
  author: String,                   // Author name (backward compatibility)
  author_profile: {                 // Detailed author information (optional)
    name: String,
    bio: String,
    profile_image: String,
    title: String,
    social_links: {
      twitter: String,
      linkedin: String,
      github: String,
      website: String
    }
  },
  slug: String,                     // URL slug
  status: String,                   // Status: "draft", "published", "archived"
  featured_image: String,           // Featured image URL (optional)
  excerpt: String,                  // Article excerpt (optional)
  categories: [String],             // Article categories
  tags: [String],                   // Article tags
  created_at: Date,                 // Creation timestamp
  updated_at: Date,                 // Last update timestamp
  published_at: Date,               // Publication date (optional)
  meta_title: String,               // SEO meta title (optional)
  meta_description: String,         // SEO meta description (optional)
  views: Number                     // View count
}
```

---

### 6. Notifications Collection (`notifications`)

System-wide notifications.

```javascript
{
  _id: ObjectId,                    // MongoDB ObjectId
  title: String,                    // Notification title
  message: String,                  // Notification message
  type: String,                     // Type: "info", "warning", "error", "success"
  date: Date,                       // Notification date
  isRead: Boolean,                  // Read status
  userId: String,                   // Target user ID (optional)
  createdAt: Date,                  // Creation timestamp
  updatedAt: Date,                  // Last update timestamp
  __v: Number                       // Version field
}
```

---

### 7. User Notifications Collection (`user_notifications`)

User-specific notifications.

```javascript
{
  _id: ObjectId,                    // MongoDB ObjectId
  title: String,                    // Notification title
  message: String,                  // Notification message
  type: String,                     // Type: "info", "warning", "error", "success"
  userId: String,                   // Target user ID
  isRead: Boolean,                  // Read status
  link: String,                     // Action link (optional)
  priority: String,                 // Priority: "low", "normal", "high", "urgent"
  createdAt: Date,                  // Creation timestamp
  updatedAt: Date                   // Last update timestamp
}
```

---

### 8. Pending Registrations Collection (`pending_registrations`)

Temporary storage for user registrations awaiting email verification.

```javascript
{
  _id: ObjectId,                    // MongoDB ObjectId
  email: String,                    // Email address (unique index)
  name: String,                     // User's name
  password: String,                 // Hashed password
  role: String,                     // User role
  verification_code: String,        // Email verification code
  createdAt: Date,                  // Creation timestamp
  expiresAt: Date                   // Expiration timestamp (TTL index)
}
```

**Indexes:**
- `email` (unique)
- `expiresAt` (TTL index for auto-expiration)

---

### 9. Verification Codes Collection (`verification_codes`)

Email verification codes for various purposes.

```javascript
{
  _id: ObjectId,                    // MongoDB ObjectId
  email: String,                    // Email address (index)
  code: String,                     // Verification code
  type: String,                     // Code type: "registration", "password_reset"
  createdAt: Date,                  // Creation timestamp
  expiresAt: Date                   // Expiration timestamp (TTL index)
}
```

**Indexes:**
- `email` (index)
- `expiresAt` (TTL index for auto-expiration)

---

### 10. Password Resets Collection (`password_resets`)

Password reset tokens and requests.

```javascript
{
  _id: ObjectId,                    // MongoDB ObjectId
  email: String,                    // Email address
  token: String,                    // Reset token (unique index)
  userId: ObjectId,                 // Reference to user
  createdAt: Date,                  // Creation timestamp
  expiresAt: Date                   // Expiration timestamp (TTL index)
}
```

**Indexes:**
- `token` (unique)
- `expiresAt` (TTL index for auto-expiration)

---

## Database Relationships

### Primary Relationships

1. **Users ↔ Applications**: One-to-Many
   - `applications.userId` references `users._id`

2. **Jobs ↔ Applications**: One-to-Many
   - `applications.jobId` references `jobpostings._id`

3. **Jobs ↔ Questions**: Many-to-Many
   - `questions.job_ids` contains array of job IDs

4. **Users ↔ User Notifications**: One-to-Many
   - `user_notifications.userId` references `users._id`

### Data Flow

```
Registration Flow:
pending_registrations → verification_codes → users

Application Flow:
users → applications ← jobpostings
         ↓
    questions (via job_ids)

Password Reset Flow:
users → password_resets → verification_codes
```

---

## Indexes and Performance

### Configured Indexes

1. **users.email** (unique) - Fast user lookup and authentication
2. **pending_registrations.email** (unique) - Prevent duplicate registrations
3. **pending_registrations.expiresAt** (TTL) - Auto-cleanup expired registrations
4. **verification_codes.email** - Fast code lookup
5. **verification_codes.expiresAt** (TTL) - Auto-cleanup expired codes
6. **password_resets.token** (unique) - Fast token validation
7. **password_resets.expiresAt** (TTL) - Auto-cleanup expired tokens

### Recommended Additional Indexes

For production optimization, consider adding:

```javascript
// Applications collection
db.applications.createIndex({"jobId": 1, "status": 1})
db.applications.createIndex({"userId": 1, "appliedDate": -1})

// Job postings collection
db.jobpostings.createIndex({"status": 1, "created_at": -1})
db.jobpostings.createIndex({"type": 1, "location": 1})

// Blog posts collection
db.blog_posts.createIndex({"status": 1, "published_at": -1})
db.blog_posts.createIndex({"slug": 1}, {unique: true})

// Notifications collections
db.user_notifications.createIndex({"userId": 1, "isRead": 1, "createdAt": -1})
```

---

## Security Considerations

### Data Protection

1. **Password Hashing**: All passwords are hashed using bcrypt
2. **Email Uniqueness**: Enforced at database level
3. **TTL Indexes**: Automatic cleanup of sensitive temporary data
4. **ObjectId References**: Secure foreign key relationships

### Access Control

- Application-level authentication and authorization
- Role-based access control (RBAC) through user roles
- API endpoint protection with JWT tokens

---

## Backup and Maintenance

### Automated Cleanup

- **TTL Indexes**: Automatically remove expired documents
- **Pending Registrations**: Auto-expire after time limit
- **Verification Codes**: Auto-expire after time limit
- **Password Reset Tokens**: Auto-expire after time limit

### Backup Strategy

Consider implementing:
- Regular automated backups via MongoDB Atlas
- Point-in-time recovery capability
- Cross-region backup replication

---

## API Integration

The database schema directly supports the FastAPI backend with:

- **Pydantic Models**: Type-safe data validation
- **Motor Driver**: Async MongoDB operations
- **Aggregation Pipelines**: Complex queries for reporting
- **Change Streams**: Real-time data updates (if needed)

For detailed API documentation, refer to the FastAPI auto-generated docs at `/docs` endpoint.
