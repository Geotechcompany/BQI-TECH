import { HelpArticle } from "@/lib/help/types";
import { HELP_PATHS } from "@/lib/help/urls";

export const adminApiArticle: HelpArticle = {
  slug: "admin-api",
  collection: "developers",
  title: "Admin API",
  summary:
    "Base URL, auth header, and the main admin endpoints for jobs, applications, and notifications.",
  author: "BQI Team",
  updatedAt: "2026-07-17",
  path: HELP_PATHS.adminApi,
  intro:
    "Use the Admin API when you integrate outside the BQI HR UI. All admin routes need a Bearer JWT.",
  blocks: [
    {
      type: "heading",
      id: "environment",
      text: "Environment",
    },
    {
      type: "list",
      items: [
        "Base URL: set NEXT_PUBLIC_PYTHON_API_URL (local default http://localhost:9000)",
        "Admin prefix: /api/admin",
        "Public prefix: /api",
        "Auth: Authorization: Bearer <token>",
      ],
    },
    {
      type: "heading",
      id: "authentication",
      text: "Authentication",
    },
    {
      type: "paragraph",
      text: "Admin endpoints require a valid access token. The admin app attaches it automatically. For external calls, send:",
    },
    {
      type: "rich",
      parts: [
        { kind: "code", text: "Authorization: Bearer <token>" },
      ],
    },
    {
      type: "heading",
      id: "endpoints",
      text: "Key endpoints",
    },
    {
      type: "list",
      items: [
        "GET /api/admin/overview",
        "GET /api/admin/applications?skip=0&limit=10",
        "GET|PUT /api/admin/applications/{id}",
        "DELETE /api/admin/applications/bulk",
        "GET|POST /api/admin/job-postings",
        "GET|PUT|DELETE /api/admin/job-postings/{id}",
        "PATCH /api/admin/job-postings/{id}/toggle-status",
        "GET /api/admin/notifications",
        "PUT /api/admin/notifications/{id}/read",
        "GET /api/jobs and GET /api/jobs/{id} (public)",
      ],
    },
    {
      type: "heading",
      id: "troubleshooting",
      text: "Troubleshooting",
    },
    {
      type: "list",
      items: [
        "401 Unauthorized — refresh your token or sign in again.",
        "404 Not Found — check admin vs public path and the resource ID.",
        "400/500 on updates — do not send immutable fields such as _id in the body.",
      ],
    },
  ],
};
